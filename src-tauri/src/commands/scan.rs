use crate::commands::settings;
use crate::processing::{cache, processor};
use base64::Engine;
use rayon::prelude::*;
use serde::Serialize;
use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicUsize, Ordering};
use tauri::Emitter;

const THUMBNAIL_SIZE: u32 = 200;

#[derive(Debug, Clone, Serialize)]
pub struct ImageInfo {
    pub filename: String,
    pub path: String,
    pub width: u32,
    pub height: u32,
    pub size: u64,
    pub format: String,
    pub thumbnail_base64: String,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ScanProgress {
    pub current: usize,
    pub total: usize,
    pub filename: String,
    pub status: String,
}

pub fn output_dir() -> PathBuf {
    let dev_path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .map(|p| p.join("Convertite"))
        .unwrap_or_else(|| PathBuf::from("Convertite"));

    let _ = fs::create_dir_all(&dev_path);
    dev_path
}

fn normalize_path(path: &Path) -> PathBuf {
    fs::canonicalize(path).unwrap_or_else(|_| path.to_path_buf())
}

fn collect_all_files(path: &Path, paths: &mut Vec<PathBuf>) {
    if path.is_file() {
        paths.push(normalize_path(path));
        return;
    }

    if !path.is_dir() {
        return;
    }

    if let Ok(entries) = fs::read_dir(path) {
        for entry in entries.flatten() {
            collect_all_files(&entry.path(), paths);
        }
    }
}

fn collect_image_paths(paths_to_scan: &[PathBuf]) -> Vec<PathBuf> {
    let mut collected = Vec::new();
    for path in paths_to_scan {
        collect_all_files(path, &mut collected);
    }

    let mut seen = HashSet::new();
    let mut unique = Vec::new();
    for path in collected {
        if seen.insert(path.clone()) {
            unique.push(path);
        }
    }

    unique
}

fn metadata_for_file(path: &Path) -> ImageInfo {
    let filename = path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("")
        .to_string();
    let size = fs::metadata(path).map(|m| m.len()).unwrap_or(0);
    let format = processor::file_format_label(path);
    let ext = processor::file_extension_lowercase(path);

    if !processor::is_supported_extension(&ext) {
        return ImageInfo {
            filename,
            path: path.to_string_lossy().to_string(),
            width: 0,
            height: 0,
            size,
            format,
            thumbnail_base64: String::new(),
            error: Some(format!("Formato non supportato: {}", path.display())),
        };
    }

    match processor::probe_image(path) {
        Ok(probe) => ImageInfo {
            filename,
            path: path.to_string_lossy().to_string(),
            width: probe.width,
            height: probe.height,
            size,
            format: probe.format,
            thumbnail_base64: String::new(),
            error: None,
        },
        Err(e) => ImageInfo {
            filename,
            path: path.to_string_lossy().to_string(),
            width: 0,
            height: 0,
            size,
            format,
            thumbnail_base64: String::new(),
            error: Some(e),
        },
    }
}

fn thumbnail_from_cache_or_generate(
    path: &Path,
    cache_dir: &Path,
    max_size: u32,
) -> Result<Vec<u8>, String> {
    let metadata = fs::metadata(path)
        .map_err(|e| format!("Errore metadati thumbnail {}: {}", path.display(), e))?;
    let cache_file = cache::thumbnail_cache_file(cache_dir, path, &metadata, max_size);

    if cache_file.exists() {
        return cache::read_thumbnail(&cache_file);
    }

    let bytes = processor::generate_thumbnail(path, max_size)?;
    let _ = cache::write_thumbnail(&cache_file, &bytes);
    Ok(bytes)
}

fn scan_with_progress(paths_to_scan: Vec<PathBuf>, app_handle: &tauri::AppHandle) -> Vec<ImageInfo> {
    let all_paths = collect_image_paths(&paths_to_scan);
    let metadata_total = all_paths.len();
    if metadata_total == 0 {
        return Vec::new();
    }

    let app_handle = app_handle.clone();
    let started = AtomicUsize::new(0);
    let completed = AtomicUsize::new(0);

    all_paths
        .par_iter()
        .map(|path| {
            let filename = path
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("")
                .to_string();

            let started_current = started.fetch_add(1, Ordering::Relaxed) + 1;
            let _ = app_handle.emit(
                "scan-progress",
                ScanProgress {
                    current: started_current,
                    total: metadata_total,
                    filename: filename.clone(),
                    status: "metadata".to_string(),
                },
            );

            let info = metadata_for_file(path);
            let completed_current = completed.fetch_add(1, Ordering::Relaxed) + 1;

            let _ = app_handle.emit(
                "scan-progress",
                ScanProgress {
                    current: completed_current,
                    total: metadata_total,
                    filename,
                    status: if info.error.is_some() {
                        "error".to_string()
                    } else {
                        "ready".to_string()
                    },
                },
            );

            info
        })
        .collect()
}

fn update_last_input_paths(app_handle: &tauri::AppHandle, paths: &[String]) {
    if let Ok(mut settings_value) = settings::load_app_settings(app_handle) {
        settings_value.last_input_paths = paths.to_vec();
        let _ = settings::save_app_settings(app_handle, &settings_value);
    }
}

#[tauri::command]
pub async fn scan_images(app_handle: tauri::AppHandle) -> Result<Vec<ImageInfo>, String> {
    let input_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .map(|p| p.join("Daconvertire"))
        .unwrap_or_else(|| PathBuf::from("Daconvertire"));

    if !input_dir.exists() {
        return Ok(Vec::new());
    }

    let mut images = scan_with_progress(vec![input_dir], &app_handle);
    images.sort_by(|a, b| a.filename.cmp(&b.filename));
    Ok(images)
}

#[tauri::command]
pub async fn scan_paths(
    app_handle: tauri::AppHandle,
    paths: Vec<String>,
    remembered_paths: Option<Vec<String>>,
) -> Result<Vec<ImageInfo>, String> {
    let paths_to_remember = remembered_paths.unwrap_or_else(|| paths.clone());
    update_last_input_paths(&app_handle, &paths_to_remember);
    let path_bufs: Vec<PathBuf> = paths.iter().map(PathBuf::from).collect();
    let mut images = scan_with_progress(path_bufs, &app_handle);
    images.sort_by(|a, b| a.filename.cmp(&b.filename));
    Ok(images)
}

#[tauri::command]
pub async fn load_thumbnail(
    app_handle: tauri::AppHandle,
    path: String,
    max_size: Option<u32>,
) -> Result<String, String> {
    let cache_dir = settings::thumbnail_cache_dir(&app_handle)
        .unwrap_or_else(|_| std::env::temp_dir().join("toolbox-thumbnail-cache"));
    let _ = fs::create_dir_all(&cache_dir);

    let requested_size = max_size.unwrap_or(THUMBNAIL_SIZE);
    let bytes = thumbnail_from_cache_or_generate(Path::new(&path), &cache_dir, requested_size)?;

    Ok(format!(
        "data:image/jpeg;base64,{}",
        base64::engine::general_purpose::STANDARD.encode(bytes)
    ))
}
