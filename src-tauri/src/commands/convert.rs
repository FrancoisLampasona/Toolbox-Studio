use crate::commands::settings;
use crate::processing::processor::{self, ConvertOptions, OutputFormat, ResizeMode};
use serde::{Deserialize, Serialize};
use rayon::prelude::*;
use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;
use tauri::Emitter;

#[derive(Debug, Deserialize)]
pub struct ConvertJob {
    pub width: u32,
    pub height: u32,
    pub quality: u8,
    pub format: String,
    pub resize_mode: String,
    pub suffix: String,
}

#[derive(Debug, Deserialize)]
pub struct ConvertRequest {
    pub files: Vec<String>,
    pub jobs: Vec<ConvertJob>,
    pub output_dir: Option<String>,
    pub naming_pattern: Option<String>,
    pub profile_name: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ConvertProgress {
    pub current: usize,
    pub total: usize,
    pub filename: String,
    pub status: String,
    pub input_size: u64,
    pub output_size: u64,
}

#[derive(Debug, Serialize)]
pub struct ConvertSummary {
    pub total_files: usize,
    pub total_operations: usize,
    pub successful: usize,
    pub failed: usize,
    pub total_input_size: u64,
    pub total_output_size: u64,
    pub results: Vec<FileResult>,
}

#[derive(Debug, Serialize)]
pub struct FileResult {
    pub filename: String,
    pub source_path: String,
    pub success: bool,
    pub input_size: u64,
    pub output_size: u64,
    pub output_path: String,
    pub error: Option<String>,
}

#[derive(Debug, Clone)]
struct PlannedConvertJob {
    job: ConvertOptions,
    output_path: PathBuf,
}

#[derive(Debug, Clone)]
struct PlannedFileBatch {
    file_path: String,
    planned_jobs: Vec<PlannedConvertJob>,
}

fn parse_job(job: &ConvertJob) -> ConvertOptions {
    let format = match job.format.to_lowercase().as_str() {
        "jpeg" | "jpg" => OutputFormat::Jpeg,
        "png" => OutputFormat::Png,
        "avif" => OutputFormat::Avif,
        _ => OutputFormat::WebP,
    };

    let resize_mode = match job.resize_mode.to_lowercase().as_str() {
        "fit" => ResizeMode::Fit,
        _ => ResizeMode::Cover,
    };

    ConvertOptions {
        width: job.width,
        height: job.height,
        quality: job.quality,
        format,
        resize_mode,
        suffix: job.suffix.clone(),
    }
}

fn resolve_output_dir(
    app_handle: &tauri::AppHandle,
    explicit_output_dir: &Option<String>,
) -> Result<PathBuf, String> {
    if let Some(output_dir) = explicit_output_dir {
        let trimmed = output_dir.trim();
        if !trimmed.is_empty() {
            return Ok(PathBuf::from(trimmed));
        }
    }

    settings::resolve_output_dir(app_handle)
}

fn save_conversion_settings(
    app_handle: &tauri::AppHandle,
    output_dir: &Path,
    jobs: &[ConvertOptions],
    naming_pattern: Option<&str>,
) {
    if let Ok(mut settings_value) = settings::load_app_settings(app_handle) {
        settings_value.last_output_path = Some(output_dir.to_string_lossy().to_string());
        settings_value.last_optimize_options = jobs.first().map(|job| settings::OptimizeSettings {
            format: match job.format {
                OutputFormat::WebP => "webp".to_string(),
                OutputFormat::Jpeg => "jpeg".to_string(),
                OutputFormat::Png => "png".to_string(),
                OutputFormat::Avif => "avif".to_string(),
            },
            quality: job.quality,
            resize_mode: match job.resize_mode {
                ResizeMode::Fit => "fit".to_string(),
                ResizeMode::Cover => "cover".to_string(),
            },
            active_preset_keys: jobs.iter().map(|job| {
                format!("{}x{}{}", job.width, job.height, job.suffix)
            }).collect(),
            use_custom: jobs
                .iter()
                .any(|job| job.suffix == "_custom"),
            custom_width: jobs.first().map(|job| job.width).unwrap_or(800),
            custom_height: jobs.first().map(|job| job.height).unwrap_or(600),
            naming_pattern: naming_pattern.unwrap_or("{nome}{suffix}_{w}x{h}").to_string(),
        });
        let _ = settings::save_app_settings(app_handle, &settings_value);
    }
}

fn emit_progress(
    app_handle: &tauri::AppHandle,
    current: usize,
    total: usize,
    filename: String,
    status: &str,
    input_size: u64,
    output_size: u64,
) {
    let _ = app_handle.emit(
        "convert-progress",
        ConvertProgress {
            current,
            total,
            filename,
            status: status.to_string(),
            input_size,
            output_size,
        },
    );
}

fn resolve_unique_output_path(
    candidate: PathBuf,
    assigned_paths: &mut HashSet<PathBuf>,
) -> PathBuf {
    let mut collision_index = 0usize;
    let mut resolved = candidate.clone();

    while assigned_paths.contains(&resolved) {
        collision_index += 1;
        resolved = processor::add_collision_suffix(&candidate, collision_index);
    }

    assigned_paths.insert(resolved.clone());
    resolved
}

fn plan_conversion_batches(
    files: &[String],
    options: &[ConvertOptions],
    output_dir: &Path,
    naming_pattern: Option<&str>,
    profile_name: Option<&str>,
) -> Vec<PlannedFileBatch> {
    let mut assigned_paths = HashSet::new();
    let mut sequence_number = 0usize;
    let mut planned_batches = Vec::with_capacity(files.len());

    for file_path in files {
        let input_path = PathBuf::from(file_path);
        let mut planned_jobs = Vec::with_capacity(options.len());

        for job in options {
            sequence_number += 1;
            let candidate = processor::build_output_path(
                &input_path,
                output_dir,
                job,
                naming_pattern,
                profile_name,
                sequence_number,
            );
            let output_path = resolve_unique_output_path(candidate, &mut assigned_paths);
            planned_jobs.push(PlannedConvertJob {
                job: job.clone(),
                output_path,
            });
        }

        planned_batches.push(PlannedFileBatch {
            file_path: file_path.clone(),
            planned_jobs,
        });
    }

    planned_batches
}

fn process_file_batch(
    file_path: &str,
    planned_jobs: &[PlannedConvertJob],
    progress: &Arc<AtomicUsize>,
    total: usize,
    app_handle: &tauri::AppHandle,
) -> Vec<FileResult> {
    let path = PathBuf::from(file_path);
    let filename = path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("unknown")
        .to_string();

    let input_size = match fs::metadata(&path) {
        Ok(metadata) => metadata.len(),
        Err(e) => {
            let error = format!("Errore metadati: {}", e);
            return planned_jobs
                .iter()
                .map(|planned_job| {
                    let output_path_str = planned_job.output_path.to_string_lossy().to_string();
                    let current = progress.fetch_add(1, Ordering::SeqCst) + 1;
                    emit_progress(
                        app_handle,
                        current,
                        total,
                        output_path_str.clone(),
                        "error",
                        0,
                        0,
                    );
                    FileResult {
                        filename: filename.clone(),
                        source_path: path.to_string_lossy().to_string(),
                        success: false,
                        input_size: 0,
                        output_size: 0,
                        output_path: output_path_str,
                        error: Some(error.clone()),
                    }
                })
                .collect();
        }
    };

    let img = match processor::load_image(&path) {
        Ok(img) => img,
        Err(error) => {
            return planned_jobs
                .iter()
                .map(|planned_job| {
                    let output_path_str = planned_job.output_path.to_string_lossy().to_string();
                    let current = progress.fetch_add(1, Ordering::SeqCst) + 1;
                    emit_progress(
                        app_handle,
                        current,
                        total,
                        output_path_str.clone(),
                        "error",
                        input_size,
                        0,
                    );
                    FileResult {
                        filename: filename.clone(),
                        source_path: path.to_string_lossy().to_string(),
                        success: false,
                        input_size,
                        output_size: 0,
                        output_path: output_path_str,
                        error: Some(error.clone()),
                    }
                })
                .collect();
        }
    };

    planned_jobs
        .iter()
        .map(|planned_job| {
            let job = &planned_job.job;
            let output_path_str = planned_job.output_path.to_string_lossy().to_string();
            let current = progress.load(Ordering::SeqCst);
            emit_progress(
                app_handle,
                current,
                total,
                output_path_str.clone(),
                "processing",
                input_size,
                0,
            );
            match processor::convert_loaded_image(input_size, &img, &planned_job.output_path, job) {
                Ok(result) => {
                    let current = progress.fetch_add(1, Ordering::SeqCst) + 1;
                    emit_progress(
                        app_handle,
                        current,
                        total,
                        result.output_path.clone(),
                        "done",
                        result.input_size,
                        result.output_size,
                    );

                    FileResult {
                        filename: filename.clone(),
                        source_path: path.to_string_lossy().to_string(),
                        success: true,
                        input_size: result.input_size,
                        output_size: result.output_size,
                        output_path: result.output_path,
                        error: None,
                    }
                }
                Err(error) => {
                    let current = progress.fetch_add(1, Ordering::SeqCst) + 1;
                    emit_progress(
                        app_handle,
                        current,
                        total,
                        output_path_str,
                        "error",
                        input_size,
                        0,
                    );

                    FileResult {
                        filename: filename.clone(),
                        source_path: path.to_string_lossy().to_string(),
                        success: false,
                        input_size,
                        output_size: 0,
                        output_path: planned_job.output_path.to_string_lossy().to_string(),
                        error: Some(error),
                    }
                }
            }
        })
        .collect()
}

#[tauri::command]
pub async fn convert_images(
    app_handle: tauri::AppHandle,
    request: ConvertRequest,
) -> Result<ConvertSummary, String> {
    let output_dir = resolve_output_dir(&app_handle, &request.output_dir)?;
    fs::create_dir_all(&output_dir)
        .map_err(|e| format!("Errore creazione cartella output: {}", e))?;

    let all_options: Vec<ConvertOptions> = request.jobs.iter().map(parse_job).collect();
    let total = request.files.len() * all_options.len();
    let progress = Arc::new(AtomicUsize::new(0));
    let app_handle_for_jobs = app_handle.clone();
    let naming_pattern = request.naming_pattern.clone();
    let profile_name = request.profile_name.clone();
    let planned_batches = plan_conversion_batches(
        &request.files,
        &all_options,
        &output_dir,
        naming_pattern.as_deref(),
        profile_name.as_deref(),
    );

    let results_by_file: Vec<Vec<FileResult>> = planned_batches
        .par_iter()
        .map({
            let progress = Arc::clone(&progress);
            let app_handle = app_handle_for_jobs.clone();
            move |planned_batch| {
                process_file_batch(
                    &planned_batch.file_path,
                    &planned_batch.planned_jobs,
                    &progress,
                    total,
                    &app_handle,
                )
            }
        })
        .collect();

    let results: Vec<FileResult> = results_by_file.into_iter().flatten().collect();
    let successful = results.iter().filter(|result| result.success).count();
    let failed = results.len().saturating_sub(successful);
    let mut seen_sources = std::collections::HashSet::new();
    let total_input_size = results
        .iter()
        .filter(|result| seen_sources.insert(result.source_path.clone()))
        .map(|result| result.input_size)
        .sum();
    let total_output_size = results
        .iter()
        .filter(|result| result.success)
        .map(|result| result.output_size)
        .sum();

    save_conversion_settings(
        &app_handle,
        &output_dir,
        &all_options,
        request.naming_pattern.as_deref(),
    );

    Ok(ConvertSummary {
        total_files: request.files.len(),
        total_operations: total,
        successful,
        failed,
        total_input_size,
        total_output_size,
        results,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::processing::processor::{OutputFormat, ResizeMode};

    fn build_job(width: u32, height: u32, suffix: &str) -> ConvertOptions {
        ConvertOptions {
            width,
            height,
            quality: 80,
            format: OutputFormat::WebP,
            resize_mode: ResizeMode::Cover,
            suffix: suffix.to_string(),
        }
    }

    #[test]
    fn resolves_unique_output_paths_inside_same_run() {
        let files = vec![
            "/tmp/client-a/hero.jpg".to_string(),
            "/tmp/client-b/hero.jpg".to_string(),
        ];
        let jobs = vec![build_job(1200, 630, "_hero")];

        let planned = plan_conversion_batches(
            &files,
            &jobs,
            Path::new("/tmp/out"),
            Some("{slug}-{preset}"),
            Some("Cliente Uno"),
        );

        let output_paths = planned
            .iter()
            .flat_map(|batch| batch.planned_jobs.iter())
            .map(|job| job.output_path.to_string_lossy().to_string())
            .collect::<Vec<_>>();

        assert_eq!(output_paths.len(), 2);
        assert_eq!(output_paths[0], "/tmp/out/hero-hero.webp");
        assert_eq!(output_paths[1], "/tmp/out/hero-hero-001.webp");
    }

    #[test]
    fn keeps_deterministic_order_for_multiple_jobs() {
        let files = vec!["/tmp/gallery/hero.jpg".to_string()];
        let jobs = vec![build_job(1200, 630, "_hero"), build_job(1200, 630, "_hero")];

        let planned = plan_conversion_batches(
            &files,
            &jobs,
            Path::new("/tmp/out"),
            Some("{slug}-{preset}"),
            Some("Cliente Uno"),
        );

        let output_paths = planned[0]
            .planned_jobs
            .iter()
            .map(|job| job.output_path.to_string_lossy().to_string())
            .collect::<Vec<_>>();

        assert_eq!(
            output_paths,
            vec![
                "/tmp/out/hero-hero.webp".to_string(),
                "/tmp/out/hero-hero-001.webp".to_string(),
            ]
        );
    }
}
