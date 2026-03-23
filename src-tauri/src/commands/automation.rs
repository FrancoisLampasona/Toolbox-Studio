use crate::commands::convert::{self, ConvertJob, ConvertRequest, ConvertSummary};
use crate::commands::settings;
use crate::processing::{presets, processor};
use notify::{Config, Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{mpsc, Arc, Mutex};
use std::thread;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

const LAST_OPTIMIZE_PROFILE_ID: &str = "__last_optimize__";
const MAX_RECENT_JOBS: usize = 18;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StartWatchFolderRequest {
    pub watch_path: String,
    pub output_path: String,
    pub selected_profile_id: Option<String>,
    pub recursive: bool,
    pub move_processed: bool,
    pub processed_dir_name: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WatchFolderJob {
    pub source_path: String,
    pub output_dir: String,
    pub status: String,
    pub processed_at: u64,
    pub output_count: usize,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WatchFolderStatus {
    pub active: bool,
    pub watch_path: Option<String>,
    pub output_path: Option<String>,
    pub selected_profile_id: Option<String>,
    pub recursive: bool,
    pub move_processed: bool,
    pub processed_dir_name: String,
    pub queue_length: usize,
    pub processing: bool,
    pub processed_count: usize,
    pub started_at: Option<u64>,
    pub last_error: Option<String>,
    pub recent_jobs: Vec<WatchFolderJob>,
}

impl Default for WatchFolderStatus {
    fn default() -> Self {
        Self {
            active: false,
            watch_path: None,
            output_path: None,
            selected_profile_id: None,
            recursive: true,
            move_processed: false,
            processed_dir_name: "Processati".to_string(),
            queue_length: 0,
            processing: false,
            processed_count: 0,
            started_at: None,
            last_error: None,
            recent_jobs: Vec::new(),
        }
    }
}

#[derive(Default)]
struct WatchFolderRuntime {
    status: WatchFolderStatus,
    stop_tx: Option<mpsc::Sender<()>>,
}

#[derive(Clone, Default)]
pub struct WatchFolderManager {
    inner: Arc<Mutex<WatchFolderRuntime>>,
}

#[derive(Debug, Clone)]
struct ResolvedAutomationProfile {
    selected_profile_id: Option<String>,
    profile_name: String,
    naming_pattern: Option<String>,
    jobs: Vec<ConvertJob>,
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

fn with_runtime<T>(
    manager: &WatchFolderManager,
    update: impl FnOnce(&mut WatchFolderRuntime) -> T,
) -> Result<T, String> {
    let mut runtime = manager
        .inner
        .lock()
        .map_err(|_| "Errore accesso stato watch folder.".to_string())?;
    Ok(update(&mut runtime))
}

fn normalize_non_empty_path(value: &str, label: &str) -> Result<PathBuf, String> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return Err(format!("{} mancante.", label));
    }

    Ok(PathBuf::from(trimmed))
}

fn build_jobs_from_optimize_settings(
    optimize_settings: &settings::OptimizeSettings,
) -> Result<Vec<ConvertJob>, String> {
    let available_presets = presets::get_presets();
    let mut jobs = Vec::new();

    for key in &optimize_settings.active_preset_keys {
        if let Some(preset) = available_presets
            .iter()
            .find(|preset| format!("{}x{}{}", preset.width, preset.height, preset.suffix) == *key)
        {
            jobs.push(ConvertJob {
                width: preset.width,
                height: preset.height,
                quality: optimize_settings.quality,
                format: optimize_settings.format.clone(),
                resize_mode: optimize_settings.resize_mode.clone(),
                suffix: preset.suffix.clone(),
            });
        }
    }

    if optimize_settings.use_custom {
        jobs.push(ConvertJob {
            width: optimize_settings.custom_width,
            height: optimize_settings.custom_height,
            quality: optimize_settings.quality,
            format: optimize_settings.format.clone(),
            resize_mode: optimize_settings.resize_mode.clone(),
            suffix: "_custom".to_string(),
        });
    }

    if jobs.is_empty() {
        return Err("Il profilo optimize selezionato non contiene preset attivi.".to_string());
    }

    Ok(jobs)
}

fn resolve_automation_profile(
    app_handle: &tauri::AppHandle,
    selected_profile_id: Option<&str>,
) -> Result<ResolvedAutomationProfile, String> {
    let app_settings = settings::load_app_settings(app_handle)?;
    let requested_id = selected_profile_id
        .map(str::trim)
        .filter(|value| !value.is_empty());

    if let Some(profile_id) = requested_id {
        if profile_id == LAST_OPTIMIZE_PROFILE_ID {
            let optimize_settings = app_settings
                .last_optimize_options
                .ok_or_else(|| "Non esistono ancora ultime impostazioni optimize da riusare.".to_string())?;

            return Ok(ResolvedAutomationProfile {
                selected_profile_id: Some(LAST_OPTIMIZE_PROFILE_ID.to_string()),
                profile_name: "watch-folder".to_string(),
                naming_pattern: Some(optimize_settings.naming_pattern.clone()),
                jobs: build_jobs_from_optimize_settings(&optimize_settings)?,
            });
        }

        if let Some(profile) = app_settings
            .optimize_profiles
            .iter()
            .find(|profile| profile.id == profile_id)
        {
            return Ok(ResolvedAutomationProfile {
                selected_profile_id: Some(profile.id.clone()),
                profile_name: profile.name.clone(),
                naming_pattern: Some(profile.settings.naming_pattern.clone()),
                jobs: build_jobs_from_optimize_settings(&profile.settings)?,
            });
        }

        return Err("Profilo optimize selezionato non trovato.".to_string());
    }

    let optimize_settings = app_settings
        .last_optimize_options
        .ok_or_else(|| "Configura prima il modulo optimize o scegli un profilo optimize.".to_string())?;

    Ok(ResolvedAutomationProfile {
        selected_profile_id: Some(LAST_OPTIMIZE_PROFILE_ID.to_string()),
        profile_name: "watch-folder".to_string(),
        naming_pattern: Some(optimize_settings.naming_pattern.clone()),
        jobs: build_jobs_from_optimize_settings(&optimize_settings)?,
    })
}

fn collect_supported_paths(
    event: &Event,
    processed_root: Option<&Path>,
    queue: &mut HashSet<PathBuf>,
) {
    if !matches!(event.kind, EventKind::Create(_) | EventKind::Modify(_)) {
        return;
    }

    for path in &event.paths {
        if let Some(root) = processed_root {
            if path.starts_with(root) {
                continue;
            }
        }

        if !path.exists() || path.is_dir() {
            continue;
        }

        let ext = processor::file_extension_lowercase(path);
        if processor::is_supported_extension(&ext) {
            queue.insert(path.clone());
        }
    }
}

fn unique_processed_destination(processed_root: &Path, source_path: &Path) -> PathBuf {
    let file_stem = source_path
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or("file");
    let extension = source_path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or("");

    let mut attempt = 0usize;
    loop {
        let filename = if extension.is_empty() {
            if attempt == 0 {
                file_stem.to_string()
            } else {
                format!("{}-{:03}", file_stem, attempt)
            }
        } else if attempt == 0 {
            format!("{}.{}", file_stem, extension)
        } else {
            format!("{}-{:03}.{}", file_stem, attempt, extension)
        };

        let destination = processed_root.join(filename);
        if !destination.exists() {
            return destination;
        }

        attempt += 1;
    }
}

fn move_to_processed(source_path: &Path, processed_root: &Path) -> Result<(), String> {
    fs::create_dir_all(processed_root)
        .map_err(|e| format!("Errore creazione cartella processati {}: {}", processed_root.display(), e))?;

    let destination = unique_processed_destination(processed_root, source_path);
    match fs::rename(source_path, &destination) {
        Ok(_) => Ok(()),
        Err(_) => {
            fs::copy(source_path, &destination).map_err(|e| {
                format!(
                    "Errore copia file processato {} -> {}: {}",
                    source_path.display(),
                    destination.display(),
                    e
                )
            })?;
            fs::remove_file(source_path).map_err(|e| {
                format!(
                    "Errore rimozione originale {} dopo copia: {}",
                    source_path.display(),
                    e
                )
            })?;
            Ok(())
        }
    }
}

fn push_recent_job(status: &mut WatchFolderStatus, job: WatchFolderJob) {
    status.recent_jobs.insert(0, job);
    if status.recent_jobs.len() > MAX_RECENT_JOBS {
        status.recent_jobs.truncate(MAX_RECENT_JOBS);
    }
}

fn process_path(
    app_handle: &tauri::AppHandle,
    resolved_profile: &ResolvedAutomationProfile,
    source_path: &Path,
    output_dir: &Path,
) -> Result<ConvertSummary, String> {
    let request = ConvertRequest {
        files: vec![source_path.to_string_lossy().to_string()],
        jobs: resolved_profile.jobs.clone(),
        output_dir: Some(output_dir.to_string_lossy().to_string()),
        naming_pattern: resolved_profile.naming_pattern.clone(),
        profile_name: Some(resolved_profile.profile_name.clone()),
    };

    convert::execute_convert_request(app_handle.clone(), &request, false, false)
}

fn run_watch_loop(
    manager: WatchFolderManager,
    app_handle: tauri::AppHandle,
    request: StartWatchFolderRequest,
    resolved_profile: ResolvedAutomationProfile,
    stop_rx: mpsc::Receiver<()>,
) {
    let watch_root = PathBuf::from(request.watch_path.clone());
    let output_root = PathBuf::from(request.output_path.clone());
    let processed_root = if request.move_processed {
        Some(watch_root.join(request.processed_dir_name.clone()))
    } else {
        None
    };

    let (event_tx, event_rx) = mpsc::channel::<Result<Event, notify::Error>>();
    let mut watcher = match RecommendedWatcher::new(
        move |event| {
            let _ = event_tx.send(event);
        },
        Config::default(),
    ) {
        Ok(watcher) => watcher,
        Err(error) => {
            let _ = with_runtime(&manager, |runtime| {
                runtime.status.active = false;
                runtime.status.processing = false;
                runtime.status.last_error =
                    Some(format!("Impossibile avviare il watcher: {}", error));
                runtime.stop_tx = None;
            });
            return;
        }
    };

    let recursive_mode = if request.recursive {
        RecursiveMode::Recursive
    } else {
        RecursiveMode::NonRecursive
    };

    if let Err(error) = watcher.watch(&watch_root, recursive_mode) {
        let _ = with_runtime(&manager, |runtime| {
            runtime.status.active = false;
            runtime.status.processing = false;
            runtime.status.last_error = Some(format!(
                "Impossibile sorvegliare {}: {}",
                watch_root.display(),
                error
            ));
            runtime.stop_tx = None;
        });
        return;
    }

    let mut pending_paths = HashSet::new();

    loop {
        if stop_rx.try_recv().is_ok() {
            break;
        }

        match event_rx.recv_timeout(Duration::from_millis(500)) {
            Ok(Ok(event)) => {
                collect_supported_paths(&event, processed_root.as_deref(), &mut pending_paths);
                let queue_len = pending_paths.len();
                let _ = with_runtime(&manager, |runtime| {
                    runtime.status.queue_length = queue_len;
                    runtime.status.last_error = None;
                });
            }
            Ok(Err(error)) => {
                let _ = with_runtime(&manager, |runtime| {
                    runtime.status.last_error = Some(format!("Errore watcher: {}", error));
                });
            }
            Err(mpsc::RecvTimeoutError::Disconnected) => break,
            Err(mpsc::RecvTimeoutError::Timeout) => {}
        }

        if pending_paths.is_empty() {
            continue;
        }

        let mut ready_paths = pending_paths.drain().collect::<Vec<_>>();
        ready_paths.sort();

        let _ = with_runtime(&manager, |runtime| {
            runtime.status.processing = true;
            runtime.status.queue_length = ready_paths.len();
        });

        for (index, source_path) in ready_paths.iter().enumerate() {
            if stop_rx.try_recv().is_ok() {
                break;
            }

            thread::sleep(Duration::from_millis(250));

            if !source_path.exists() || source_path.is_dir() {
                let _ = with_runtime(&manager, |runtime| {
                    runtime.status.queue_length = ready_paths.len().saturating_sub(index + 1);
                });
                continue;
            }

            match process_path(&app_handle, &resolved_profile, source_path, &output_root) {
                Ok(summary) => {
                    if request.move_processed
                        && summary.failed == 0
                        && summary.successful == summary.total_operations
                    {
                        if let Some(processed_root) = processed_root.as_deref() {
                            if let Err(error) = move_to_processed(source_path, processed_root) {
                                let _ = with_runtime(&manager, |runtime| {
                                    runtime.status.last_error = Some(error);
                                });
                            }
                        }
                    }

                    let output_count = summary.results.iter().filter(|result| result.success).count();
                    let job = WatchFolderJob {
                        source_path: source_path.to_string_lossy().to_string(),
                        output_dir: output_root.to_string_lossy().to_string(),
                        status: if summary.failed > 0 { "partial" } else { "done" }.to_string(),
                        processed_at: now_ms(),
                        output_count,
                        error: summary
                            .results
                            .iter()
                            .find_map(|result| result.error.clone()),
                    };

                    let _ = with_runtime(&manager, |runtime| {
                        runtime.status.processed_count += 1;
                        runtime.status.queue_length = ready_paths.len().saturating_sub(index + 1);
                        push_recent_job(&mut runtime.status, job);
                        runtime.status.last_error = None;
                    });
                }
                Err(error) => {
                    let job = WatchFolderJob {
                        source_path: source_path.to_string_lossy().to_string(),
                        output_dir: output_root.to_string_lossy().to_string(),
                        status: "error".to_string(),
                        processed_at: now_ms(),
                        output_count: 0,
                        error: Some(error.clone()),
                    };
                    let _ = with_runtime(&manager, |runtime| {
                        runtime.status.queue_length = ready_paths.len().saturating_sub(index + 1);
                        runtime.status.last_error = Some(error);
                        push_recent_job(&mut runtime.status, job);
                    });
                }
            }
        }

        let _ = with_runtime(&manager, |runtime| {
            runtime.status.processing = false;
            runtime.status.queue_length = 0;
        });
    }

    let _ = with_runtime(&manager, |runtime| {
        runtime.status.active = false;
        runtime.status.processing = false;
        runtime.status.queue_length = 0;
        runtime.stop_tx = None;
    });
}

#[tauri::command]
pub async fn get_watch_folder_status(
    manager: tauri::State<'_, WatchFolderManager>,
) -> Result<WatchFolderStatus, String> {
    with_runtime(&manager, |runtime| runtime.status.clone())
}

#[tauri::command]
pub async fn stop_watch_folder(
    manager: tauri::State<'_, WatchFolderManager>,
) -> Result<WatchFolderStatus, String> {
    with_runtime(&manager, |runtime| {
        if let Some(stop_tx) = runtime.stop_tx.take() {
            let _ = stop_tx.send(());
        }
        runtime.status.active = false;
        runtime.status.processing = false;
        runtime.status.queue_length = 0;
        runtime.status.clone()
    })
}

#[tauri::command]
pub async fn start_watch_folder(
    app_handle: tauri::AppHandle,
    manager: tauri::State<'_, WatchFolderManager>,
    request: StartWatchFolderRequest,
) -> Result<WatchFolderStatus, String> {
    let watch_path = normalize_non_empty_path(&request.watch_path, "Cartella watch")?;
    if !watch_path.exists() || !watch_path.is_dir() {
        return Err(format!(
            "Cartella watch non valida: {}",
            watch_path.display()
        ));
    }

    let output_path = normalize_non_empty_path(&request.output_path, "Cartella output")?;
    fs::create_dir_all(&output_path).map_err(|e| {
        format!(
            "Errore creazione cartella output {}: {}",
            output_path.display(),
            e
        )
    })?;

    let processed_dir_name = request.processed_dir_name.trim();
    if request.move_processed && processed_dir_name.is_empty() {
        return Err("Inserisci un nome cartella per i file processati.".to_string());
    }

    let resolved_profile =
        resolve_automation_profile(&app_handle, request.selected_profile_id.as_deref())?;

    let _ = stop_watch_folder(manager.clone()).await;

    let (stop_tx, stop_rx) = mpsc::channel::<()>();
    let manager_owned = manager.inner.clone();

    {
        let mut runtime = manager_owned
            .lock()
            .map_err(|_| "Errore accesso stato watch folder.".to_string())?;
        runtime.status = WatchFolderStatus {
            active: true,
            watch_path: Some(watch_path.to_string_lossy().to_string()),
            output_path: Some(output_path.to_string_lossy().to_string()),
            selected_profile_id: resolved_profile.selected_profile_id.clone(),
            recursive: request.recursive,
            move_processed: request.move_processed,
            processed_dir_name: if processed_dir_name.is_empty() {
                "Processati".to_string()
            } else {
                processed_dir_name.to_string()
            },
            queue_length: 0,
            processing: false,
            processed_count: 0,
            started_at: Some(now_ms()),
            last_error: None,
            recent_jobs: Vec::new(),
        };
        runtime.stop_tx = Some(stop_tx);
    }

    let manager_for_thread = WatchFolderManager {
        inner: manager_owned,
    };
    let request_for_thread = StartWatchFolderRequest {
        watch_path: watch_path.to_string_lossy().to_string(),
        output_path: output_path.to_string_lossy().to_string(),
        selected_profile_id: request.selected_profile_id.clone(),
        recursive: request.recursive,
        move_processed: request.move_processed,
        processed_dir_name: if processed_dir_name.is_empty() {
            "Processati".to_string()
        } else {
            processed_dir_name.to_string()
        },
    };

    thread::spawn(move || {
        run_watch_loop(
            manager_for_thread,
            app_handle,
            request_for_thread,
            resolved_profile,
            stop_rx,
        );
    });

    get_watch_folder_status(manager).await
}
