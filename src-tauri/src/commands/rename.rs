use crate::processing::processor;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PreviewBatchRenameRequest {
    pub paths: Vec<String>,
    pub naming_pattern: Option<String>,
    pub start_index: Option<usize>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RenamePlanItem {
    pub source_path: String,
    pub source_name: String,
    pub target_path: String,
    pub target_name: String,
    pub width: u32,
    pub height: u32,
    pub format: String,
    pub changed: bool,
    pub collision_resolved: bool,
    pub error: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ApplyBatchRenameRequest {
    pub items: Vec<RenamePlanItem>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RenameResultItem {
    pub source_path: String,
    pub source_name: String,
    pub target_path: String,
    pub target_name: String,
    pub changed: bool,
    pub collision_resolved: bool,
    pub success: bool,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RenameSummary {
    pub total_files: usize,
    pub renamed: usize,
    pub unchanged: usize,
    pub failed: usize,
    pub collisions_resolved: usize,
    pub results: Vec<RenameResultItem>,
}

#[derive(Debug)]
struct PreparedRename {
    index: usize,
    source_path: PathBuf,
    source_name: String,
    target_path: PathBuf,
    target_name: String,
    collision_resolved: bool,
}

#[derive(Debug)]
struct TempRename {
    index: usize,
    original_path: PathBuf,
    source_name: String,
    temp_path: PathBuf,
    target_path: PathBuf,
    target_name: String,
    collision_resolved: bool,
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

fn normalize_path(path: &Path) -> PathBuf {
    fs::canonicalize(path).unwrap_or_else(|_| path.to_path_buf())
}

fn dedupe_paths(paths: &[String]) -> Vec<PathBuf> {
    let mut seen = HashSet::new();
    let mut deduped = Vec::new();

    for path in paths {
        let trimmed = path.trim();
        if trimmed.is_empty() {
            continue;
        }

        let candidate = PathBuf::from(trimmed);
        let normalized = normalize_path(&candidate);
        if seen.insert(normalized) {
            deduped.push(candidate);
        }
    }

    deduped
}

fn build_preview_items(
    paths: &[String],
    naming_pattern: Option<&str>,
    start_index: usize,
) -> Vec<RenamePlanItem> {
    let source_paths = dedupe_paths(paths);
    let source_set: HashSet<PathBuf> = source_paths
        .iter()
        .map(|path| normalize_path(path))
        .collect();
    let mut assigned_targets = HashSet::new();

    source_paths
        .iter()
        .enumerate()
        .map(|(index, source_path)| {
            let source_name = source_path
                .file_name()
                .and_then(|value| value.to_str())
                .unwrap_or("file")
                .to_string();
            let format = processor::file_extension_lowercase(source_path);
            let probe = processor::probe_image(source_path);
            let (width, height, error) = match probe {
                Ok(info) => (info.width, info.height, None),
                Err(error) => (0, 0, Some(error)),
            };

            if error.is_some() {
                return RenamePlanItem {
                    source_path: source_path.to_string_lossy().to_string(),
                    source_name: source_name.clone(),
                    target_path: source_path.to_string_lossy().to_string(),
                    target_name: source_name,
                    width,
                    height,
                    format,
                    changed: false,
                    collision_resolved: false,
                    error,
                };
            }

            let source_stem = source_path
                .file_stem()
                .and_then(|value| value.to_str())
                .unwrap_or("image");
            let sequence_number = start_index.saturating_add(index);
            let stem = processor::build_named_stem(
                source_stem,
                width,
                height,
                &format,
                "",
                naming_pattern,
                None,
                sequence_number.max(1),
            );
            let target_name = match source_path.extension().and_then(|value| value.to_str()) {
                Some(ext) if !ext.is_empty() => format!("{}.{}", stem, ext),
                _ => stem,
            };
            let parent = source_path
                .parent()
                .map(Path::to_path_buf)
                .unwrap_or_default();
            let candidate = parent.join(&target_name);
            let (target_path, collision_resolved) =
                resolve_unique_target_path(candidate, &source_set, &mut assigned_targets);

            RenamePlanItem {
                source_path: source_path.to_string_lossy().to_string(),
                source_name,
                target_path: target_path.to_string_lossy().to_string(),
                target_name: target_path
                    .file_name()
                    .and_then(|value| value.to_str())
                    .unwrap_or("file")
                    .to_string(),
                width,
                height,
                format,
                changed: normalize_path(source_path) != normalize_path(&target_path),
                collision_resolved,
                error: None,
            }
        })
        .collect()
}

fn resolve_unique_target_path(
    candidate: PathBuf,
    source_set: &HashSet<PathBuf>,
    assigned_targets: &mut HashSet<PathBuf>,
) -> (PathBuf, bool) {
    let mut collision_index = 0usize;
    let mut resolved = candidate.clone();
    let mut collision_resolved = false;

    loop {
        let normalized_resolved = normalize_path(&resolved);
        let assigned_conflict = assigned_targets.contains(&normalized_resolved);
        let existing_conflict = resolved.exists() && !source_set.contains(&normalized_resolved);

        if !assigned_conflict && !existing_conflict {
            assigned_targets.insert(normalized_resolved);
            return (resolved, collision_resolved);
        }

        collision_index += 1;
        collision_resolved = true;
        resolved = processor::add_collision_suffix(&candidate, collision_index);
    }
}

fn unique_temp_path(source_path: &Path, reserved_paths: &mut HashSet<PathBuf>) -> PathBuf {
    let parent = source_path
        .parent()
        .map(Path::to_path_buf)
        .unwrap_or_default();
    let stem = source_path
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or("file");
    let extension = source_path.extension().and_then(|value| value.to_str());
    let seed = now_ms();

    let mut attempt = 0usize;
    loop {
        let filename = match extension {
            Some(ext) if !ext.is_empty() => {
                format!(".toolbox-rename-{}-{}-{:03}.{}", stem, seed, attempt, ext)
            }
            _ => format!(".toolbox-rename-{}-{}-{:03}", stem, seed, attempt),
        };
        let candidate = parent.join(filename);

        if !candidate.exists() && reserved_paths.insert(candidate.clone()) {
            return candidate;
        }

        attempt += 1;
    }
}

fn result_from_plan(plan: &RenamePlanItem, success: bool, error: Option<String>) -> RenameResultItem {
    RenameResultItem {
        source_path: plan.source_path.clone(),
        source_name: plan.source_name.clone(),
        target_path: plan.target_path.clone(),
        target_name: plan.target_name.clone(),
        changed: plan.changed,
        collision_resolved: plan.collision_resolved,
        success,
        error,
    }
}

#[tauri::command]
pub async fn preview_batch_rename(
    request: PreviewBatchRenameRequest,
) -> Result<Vec<RenamePlanItem>, String> {
    Ok(build_preview_items(
        &request.paths,
        request.naming_pattern.as_deref(),
        request.start_index.unwrap_or(1).max(1),
    ))
}

#[tauri::command]
pub async fn apply_batch_rename(
    request: ApplyBatchRenameRequest,
) -> Result<RenameSummary, String> {
    let mut results: Vec<Option<RenameResultItem>> = vec![None; request.items.len()];
    let mut prepared = Vec::new();
    let mut seen_sources = HashSet::new();
    let mut seen_targets = HashSet::new();

    for (index, item) in request.items.iter().enumerate() {
        let source_key = item.source_path.trim().to_string();
        let target_key = item.target_path.trim().to_string();

        if source_key.is_empty() || target_key.is_empty() {
            results[index] = Some(result_from_plan(
                item,
                false,
                Some("Percorsi di rinomina non validi.".to_string()),
            ));
            continue;
        }

        if item.error.is_some() {
            results[index] = Some(result_from_plan(
                item,
                false,
                item.error.clone(),
            ));
            continue;
        }

        if !seen_sources.insert(source_key.clone()) {
            results[index] = Some(result_from_plan(
                item,
                false,
                Some("Lo stesso file sorgente compare piu' volte nel batch.".to_string()),
            ));
            continue;
        }

        if !seen_targets.insert(target_key.clone()) {
            results[index] = Some(result_from_plan(
                item,
                false,
                Some("Due file puntano allo stesso nome finale.".to_string()),
            ));
            continue;
        }

        if !item.changed {
            results[index] = Some(result_from_plan(item, true, None));
            continue;
        }

        prepared.push(PreparedRename {
            index,
            source_path: PathBuf::from(&item.source_path),
            source_name: item.source_name.clone(),
            target_path: PathBuf::from(&item.target_path),
            target_name: item.target_name.clone(),
            collision_resolved: item.collision_resolved,
        });
    }

    let mut temp_paths = HashSet::new();
    let mut staged = Vec::new();

    for entry in prepared {
        if !entry.source_path.exists() {
            results[entry.index] = Some(RenameResultItem {
                source_path: entry.source_path.to_string_lossy().to_string(),
                source_name: entry.source_name,
                target_path: entry.target_path.to_string_lossy().to_string(),
                target_name: entry.target_name,
                changed: true,
                collision_resolved: entry.collision_resolved,
                success: false,
                error: Some("Il file sorgente non esiste piu'.".to_string()),
            });
            continue;
        }

        let temp_path = unique_temp_path(&entry.source_path, &mut temp_paths);
        match fs::rename(&entry.source_path, &temp_path) {
            Ok(_) => staged.push(TempRename {
                index: entry.index,
                original_path: entry.source_path,
                source_name: entry.source_name,
                temp_path,
                target_path: entry.target_path,
                target_name: entry.target_name,
                collision_resolved: entry.collision_resolved,
            }),
            Err(error) => {
                results[entry.index] = Some(RenameResultItem {
                    source_path: entry.source_path.to_string_lossy().to_string(),
                    source_name: entry.source_name,
                    target_path: entry.target_path.to_string_lossy().to_string(),
                    target_name: entry.target_name,
                    changed: true,
                    collision_resolved: entry.collision_resolved,
                    success: false,
                    error: Some(format!("Impossibile preparare la rinomina: {}", error)),
                });
            }
        }
    }

    for entry in staged {
        if entry.target_path.exists() {
            let rollback_error = fs::rename(&entry.temp_path, &entry.original_path)
                .err()
                .map(|error| format!(" Rollback fallito: {}", error))
                .unwrap_or_default();
            results[entry.index] = Some(RenameResultItem {
                source_path: entry.original_path.to_string_lossy().to_string(),
                source_name: entry.source_name,
                target_path: entry.target_path.to_string_lossy().to_string(),
                target_name: entry.target_name,
                changed: true,
                collision_resolved: entry.collision_resolved,
                success: false,
                error: Some(format!(
                    "Il nome finale esiste ancora sul disco.{}",
                    rollback_error
                )),
            });
            continue;
        }

        match fs::rename(&entry.temp_path, &entry.target_path) {
            Ok(_) => {
                results[entry.index] = Some(RenameResultItem {
                    source_path: entry.original_path.to_string_lossy().to_string(),
                    source_name: entry.source_name,
                    target_path: entry.target_path.to_string_lossy().to_string(),
                    target_name: entry.target_name,
                    changed: true,
                    collision_resolved: entry.collision_resolved,
                    success: true,
                    error: None,
                });
            }
            Err(error) => {
                let rollback_error = fs::rename(&entry.temp_path, &entry.original_path)
                    .err()
                    .map(|rollback| format!(" Rollback fallito: {}", rollback))
                    .unwrap_or_default();
                results[entry.index] = Some(RenameResultItem {
                    source_path: entry.original_path.to_string_lossy().to_string(),
                    source_name: entry.source_name,
                    target_path: entry.target_path.to_string_lossy().to_string(),
                    target_name: entry.target_name,
                    changed: true,
                    collision_resolved: entry.collision_resolved,
                    success: false,
                    error: Some(format!(
                        "Impossibile completare la rinomina: {}.{}",
                        error, rollback_error
                    )),
                });
            }
        }
    }

    let mut finalized_results = Vec::with_capacity(results.len());
    for (index, maybe_result) in results.into_iter().enumerate() {
        if let Some(result) = maybe_result {
            finalized_results.push(result);
        } else {
            let item = &request.items[index];
            finalized_results.push(result_from_plan(
                item,
                false,
                Some("Operazione non eseguita.".to_string()),
            ));
        }
    }

    let renamed = finalized_results
        .iter()
        .filter(|result| result.success && result.changed)
        .count();
    let unchanged = finalized_results
        .iter()
        .filter(|result| result.success && !result.changed)
        .count();
    let failed = finalized_results
        .iter()
        .filter(|result| !result.success)
        .count();
    let collisions_resolved = finalized_results
        .iter()
        .filter(|result| result.collision_resolved)
        .count();

    Ok(RenameSummary {
        total_files: finalized_results.len(),
        renamed,
        unchanged,
        failed,
        collisions_resolved,
        results: finalized_results,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use image::{Rgba, RgbaImage};

    fn unique_test_dir(label: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("toolbox-rename-{}-{}", label, now_ms()));
        fs::create_dir_all(&dir).expect("create temp dir");
        dir
    }

    fn write_test_image(path: &Path) {
        let image = RgbaImage::from_pixel(1, 1, Rgba([255, 0, 0, 255]));
        image.save(path).expect("save test image");
    }

    #[test]
    fn preview_adds_suffix_when_names_collide() {
        let dir = unique_test_dir("preview");
        let left = dir.join("Hero One.png");
        let right = dir.join("Hero Two.png");
        write_test_image(&left);
        write_test_image(&right);

        let plans = build_preview_items(
            &[
                left.to_string_lossy().to_string(),
                right.to_string_lossy().to_string(),
            ],
            Some("{profilo}"),
            1,
        );

        assert_eq!(plans.len(), 2);
        assert_eq!(plans[0].target_name, "profilo.png");
        assert_eq!(plans[1].target_name, "profilo-001.png");
        assert!(plans[1].collision_resolved);

        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn apply_batch_rename_moves_files_to_final_names() {
        let dir = unique_test_dir("apply");
        let first = dir.join("alpha.png");
        let second = dir.join("beta.png");
        write_test_image(&first);
        write_test_image(&second);

        let preview = build_preview_items(
            &[
                first.to_string_lossy().to_string(),
                second.to_string_lossy().to_string(),
            ],
            Some("{slug}-{n}"),
            1,
        );

        let summary = tauri::async_runtime::block_on(apply_batch_rename(ApplyBatchRenameRequest {
            items: preview.clone(),
        }))
        .expect("apply rename");

        assert_eq!(summary.renamed, 2);
        assert_eq!(summary.failed, 0);
        assert!(dir.join("alpha-001.png").exists());
        assert!(dir.join("beta-002.png").exists());

        let _ = fs::remove_dir_all(dir);
    }
}
