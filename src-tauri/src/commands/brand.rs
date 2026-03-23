use crate::commands::settings::{load_app_settings, save_app_settings, BrandSettings};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::Manager;

const BRAND_KITS_FILE_NAME: &str = "brand-kits.json";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
#[serde(default)]
pub struct BrandKit {
    pub id: String,
    pub name: String,
    pub primary_color: String,
    pub secondary_color: String,
    pub accent_color: String,
    pub text_color: String,
    pub background_color: String,
    pub logo_path: String,
    pub icon_path: String,
    pub font_heading: String,
    pub font_body: String,
    pub watermark_path: String,
    pub updated_at_ms: u64,
}

impl Default for BrandKit {
    fn default() -> Self {
        Self {
            id: String::new(),
            name: String::new(),
            primary_color: "#2563EB".to_string(),
            secondary_color: "#7C3AED".to_string(),
            accent_color: "#F59E0B".to_string(),
            text_color: "#1F2937".to_string(),
            background_color: "#F9FAFB".to_string(),
            logo_path: String::new(),
            icon_path: String::new(),
            font_heading: "Inter".to_string(),
            font_body: "Inter".to_string(),
            watermark_path: String::new(),
            updated_at_ms: 0,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveBrandKitRequest {
    pub id: Option<String>,
    pub name: String,
    pub primary_color: String,
    pub secondary_color: String,
    pub accent_color: String,
    pub text_color: String,
    pub background_color: String,
    pub logo_path: String,
    pub icon_path: String,
    pub font_heading: String,
    pub font_body: String,
    pub watermark_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BrandKitExportEntry {
    pub name: String,
    pub primary_color: String,
    pub secondary_color: String,
    pub accent_color: String,
    pub text_color: String,
    pub background_color: String,
    pub logo_path: String,
    pub icon_path: String,
    pub font_heading: String,
    pub font_body: String,
    pub watermark_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BrandKitsExportDocument {
    pub version: u32,
    pub exported_at: u64,
    pub kits: Vec<BrandKitExportEntry>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportBrandKitsRequest {
    pub destination_path: String,
    pub kit_ids: Vec<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportBrandKitsRequest {
    pub source_paths: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BrandKitImportFailure {
    pub source_path: String,
    pub error: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportBrandKitsResult {
    pub kits: Vec<BrandKit>,
    pub imported_kits: Vec<BrandKit>,
    pub imported_count: usize,
    pub failed_files: Vec<BrandKitImportFailure>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
#[serde(default)]
pub struct BrandKitStore {
    pub version: u32,
    pub kits: Vec<BrandKit>,
}

impl Default for BrandKitStore {
    fn default() -> Self {
        Self {
            version: 1,
            kits: Vec::new(),
        }
    }
}

fn brand_store_path(app_handle: &tauri::AppHandle) -> Result<PathBuf, String> {
    let base_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("Errore risoluzione app data dir brand: {}", e))?;

    Ok(base_dir.join(BRAND_KITS_FILE_NAME))
}

fn ensure_parent_dir(path: &Path) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Errore creazione cartella brand: {}", e))?;
    }

    Ok(())
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

fn normalize_name(name: &str) -> String {
    name.split_whitespace().collect::<Vec<_>>().join(" ")
}

fn normalize_name_key(name: &str) -> String {
    normalize_name(name).to_lowercase()
}

fn normalize_optional_path(path: &str) -> String {
    path.trim().to_string()
}

fn validate_brand_name(name: &str) -> Result<String, String> {
    let normalized = normalize_name(name);
    if normalized.is_empty() {
        return Err("Inserisci un nome brand kit.".to_string());
    }

    Ok(normalized)
}

fn validate_hex_color(value: &str, field: &str) -> Result<String, String> {
    let trimmed = value.trim();
    let hex = trimmed.trim_start_matches('#');

    let valid = matches!(hex.len(), 3 | 6) && hex.chars().all(|ch| ch.is_ascii_hexdigit());
    if !valid {
        return Err(format!(
            "Colore non valido per {}: {}. Usa formato #RRGGBB o #RGB.",
            field, value
        ));
    }

    Ok(format!("#{}", hex.to_uppercase()))
}

fn brand_kit_id_from_name(name: &str) -> String {
    let mut slug = String::new();
    let mut previous_dash = false;

    for ch in name.chars() {
        if ch.is_ascii_alphanumeric() {
            slug.push(ch.to_ascii_lowercase());
            previous_dash = false;
        } else if !previous_dash {
            slug.push('-');
            previous_dash = true;
        }
    }

    let slug = slug.trim_matches('-');
    let base = if slug.is_empty() { "brand-kit" } else { slug };
    format!("{}-{}", base, now_ms())
}

fn sort_brand_kits(kits: &mut [BrandKit]) {
    kits.sort_by(|left, right| {
        right
            .updated_at_ms
            .cmp(&left.updated_at_ms)
            .then_with(|| left.name.to_lowercase().cmp(&right.name.to_lowercase()))
    });
}

fn unique_import_brand_name(existing: &mut HashSet<String>, base_name: &str) -> String {
    let normalized = normalize_name(base_name);
    let base_key = normalize_name_key(&normalized);

    if existing.insert(base_key.clone()) {
        return normalized;
    }

    let mut attempt = 1usize;
    loop {
        let candidate = if attempt == 1 {
            format!("{} - importato", normalized)
        } else {
            format!("{} - importato {}", normalized, attempt)
        };

        if existing.insert(normalize_name_key(&candidate)) {
            return candidate;
        }

        attempt += 1;
    }
}

fn build_export_bundle(kits: Vec<BrandKitExportEntry>) -> BrandKitsExportDocument {
    BrandKitsExportDocument {
        version: 1,
        exported_at: now_ms(),
        kits,
    }
}

fn load_import_bundle(raw: &str) -> Result<BrandKitsExportDocument, String> {
    let document = serde_json::from_str::<BrandKitsExportDocument>(raw)
        .map_err(|e| format!("Errore parsing JSON brand kit: {}", e))?;

    if document.version != 1 {
        return Err(format!(
            "Versione export brand kit non supportata: {}",
            document.version
        ));
    }

    Ok(document)
}

fn load_brand_store(app_handle: &tauri::AppHandle) -> Result<BrandKitStore, String> {
    let path = brand_store_path(app_handle)?;
    if !path.exists() {
        return Ok(BrandKitStore::default());
    }

    let raw = fs::read_to_string(&path)
        .map_err(|e| format!("Errore lettura brand kit: {}", e))?;
    serde_json::from_str::<BrandKitStore>(&raw)
        .map_err(|e| format!("Errore parsing brand kit: {}", e))
}

fn save_brand_store(app_handle: &tauri::AppHandle, store: &BrandKitStore) -> Result<(), String> {
    let path = brand_store_path(app_handle)?;
    ensure_parent_dir(&path)?;

    let raw = serde_json::to_string_pretty(store)
        .map_err(|e| format!("Errore serializzazione brand kit: {}", e))?;
    let tmp_path = path.with_extension("json.tmp");

    fs::write(&tmp_path, raw)
        .map_err(|e| format!("Errore scrittura brand kit temporaneo: {}", e))?;
    if path.exists() {
        let _ = fs::remove_file(&path);
    }
    fs::rename(&tmp_path, &path)
        .map_err(|e| format!("Errore salvataggio brand kit: {}", e))
}

fn remember_selected_kit(app_handle: &tauri::AppHandle, selected_kit_id: Option<String>) {
    if let Ok(mut settings) = load_app_settings(app_handle) {
        let current = settings.last_brand_options.unwrap_or_default();
        settings.last_brand_options = Some(BrandSettings {
            selected_brand_kit_id: selected_kit_id,
            last_output_path: current.last_output_path,
        });
        let _ = save_app_settings(app_handle, &settings);
    }
}

fn remember_brand_export_path(app_handle: &tauri::AppHandle, destination_path: Option<String>) {
    if let Ok(mut settings) = load_app_settings(app_handle) {
        let current = settings.last_brand_options.unwrap_or_default();
        settings.last_brand_options = Some(BrandSettings {
            selected_brand_kit_id: current.selected_brand_kit_id,
            last_output_path: destination_path,
        });
        let _ = save_app_settings(app_handle, &settings);
    }
}

fn normalize_failed_path(path: &str) -> String {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        "Percorso sconosciuto".to_string()
    } else {
        trimmed.to_string()
    }
}

#[tauri::command]
pub async fn get_brand_kits(app_handle: tauri::AppHandle) -> Result<Vec<BrandKit>, String> {
    let mut store = load_brand_store(&app_handle)?;
    sort_brand_kits(&mut store.kits);
    Ok(store.kits)
}

#[tauri::command]
pub async fn save_brand_kit(
    app_handle: tauri::AppHandle,
    request: SaveBrandKitRequest,
) -> Result<BrandKit, String> {
    let mut store = load_brand_store(&app_handle)?;
    let name = validate_brand_name(&request.name)?;
    let requested_id = request.id.filter(|value| !value.trim().is_empty());
    let name_key = normalize_name_key(&name);

    let duplicate_exists = store.kits.iter().any(|kit| {
        let is_same_kit = requested_id
            .as_ref()
            .is_some_and(|requested| requested == &kit.id);
        !is_same_kit && normalize_name_key(&kit.name) == name_key
    });

    if duplicate_exists {
        return Err("Esiste gia' un brand kit con questo nome.".to_string());
    }

    let primary_color = validate_hex_color(&request.primary_color, "primaryColor")?;
    let secondary_color = validate_hex_color(&request.secondary_color, "secondaryColor")?;
    let accent_color = validate_hex_color(&request.accent_color, "accentColor")?;
    let text_color = validate_hex_color(&request.text_color, "textColor")?;
    let background_color = validate_hex_color(&request.background_color, "backgroundColor")?;
    let logo_path = normalize_optional_path(&request.logo_path);
    let icon_path = normalize_optional_path(&request.icon_path);
    let font_heading = normalize_name(&request.font_heading);
    let font_body = normalize_name(&request.font_body);
    let watermark_path = normalize_optional_path(&request.watermark_path);
    let updated_at_ms = now_ms();

    let kit = if let Some(existing) = store
        .kits
        .iter_mut()
        .find(|kit| requested_id.as_ref().is_some_and(|requested| requested == &kit.id))
    {
        existing.name = name;
        existing.primary_color = primary_color;
        existing.secondary_color = secondary_color;
        existing.accent_color = accent_color;
        existing.text_color = text_color;
        existing.background_color = background_color;
        existing.logo_path = logo_path;
        existing.icon_path = icon_path;
        existing.font_heading = font_heading;
        existing.font_body = font_body;
        existing.watermark_path = watermark_path;
        existing.updated_at_ms = updated_at_ms;
        existing.clone()
    } else {
        let kit = BrandKit {
            id: requested_id.unwrap_or_else(|| brand_kit_id_from_name(&name)),
            name,
            primary_color,
            secondary_color,
            accent_color,
            text_color,
            background_color,
            logo_path,
            icon_path,
            font_heading,
            font_body,
            watermark_path,
            updated_at_ms,
        };
        store.kits.push(kit.clone());
        kit
    };

    sort_brand_kits(&mut store.kits);
    save_brand_store(&app_handle, &store)?;
    remember_selected_kit(&app_handle, Some(kit.id.clone()));

    Ok(kit)
}

#[tauri::command]
pub async fn delete_brand_kit(
    app_handle: tauri::AppHandle,
    id: String,
) -> Result<Vec<BrandKit>, String> {
    let mut store = load_brand_store(&app_handle)?;
    let before_len = store.kits.len();
    store.kits.retain(|kit| kit.id != id);

    if store.kits.len() == before_len {
        return Err("Brand kit non trovato.".to_string());
    }

    sort_brand_kits(&mut store.kits);
    save_brand_store(&app_handle, &store)?;

    if let Ok(settings) = load_app_settings(&app_handle) {
        let should_clear = settings
            .last_brand_options
            .as_ref()
            .and_then(|options| options.selected_brand_kit_id.as_ref())
            .is_some_and(|selected| selected == &id);
        if should_clear {
            remember_selected_kit(&app_handle, None);
        }
    }

    Ok(store.kits)
}

#[tauri::command]
pub async fn export_brand_kits(
    app_handle: tauri::AppHandle,
    request: ExportBrandKitsRequest,
) -> Result<String, String> {
    let destination = request.destination_path.trim();
    if destination.is_empty() {
        return Err("Percorso export brand kit mancante.".to_string());
    }

    if request.kit_ids.is_empty() {
        return Err("Seleziona almeno un brand kit da esportare.".to_string());
    }

    let store = load_brand_store(&app_handle)?;
    let kit_ids: HashSet<&str> = request.kit_ids.iter().map(|id| id.as_str()).collect();
    let kits = store
        .kits
        .into_iter()
        .filter(|kit| kit_ids.contains(kit.id.as_str()))
        .map(|kit| BrandKitExportEntry {
            name: kit.name,
            primary_color: kit.primary_color,
            secondary_color: kit.secondary_color,
            accent_color: kit.accent_color,
            text_color: kit.text_color,
            background_color: kit.background_color,
            logo_path: kit.logo_path,
            icon_path: kit.icon_path,
            font_heading: kit.font_heading,
            font_body: kit.font_body,
            watermark_path: kit.watermark_path,
        })
        .collect::<Vec<_>>();

    if kits.is_empty() {
        return Err("Nessun brand kit selezionato per l'esportazione.".to_string());
    }

    let bundle = build_export_bundle(kits);
    let raw = serde_json::to_string_pretty(&bundle)
        .map_err(|e| format!("Errore serializzazione export brand kit: {}", e))?;

    let destination_path = PathBuf::from(destination);
    ensure_parent_dir(&destination_path)?;
    fs::write(&destination_path, raw)
        .map_err(|e| format!("Errore scrittura export brand kit {}: {}", destination_path.display(), e))?;
    remember_brand_export_path(&app_handle, Some(destination_path.to_string_lossy().to_string()));

    Ok(destination_path.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn import_brand_kits(
    app_handle: tauri::AppHandle,
    request: ImportBrandKitsRequest,
) -> Result<ImportBrandKitsResult, String> {
    if request.source_paths.is_empty() {
        return Err("Seleziona almeno un file JSON da importare.".to_string());
    }

    let mut store = load_brand_store(&app_handle)?;
    let mut available_names: HashSet<String> = store
        .kits
        .iter()
        .map(|kit| normalize_name_key(&kit.name))
        .collect();
    let mut imported_kits = Vec::new();
    let mut failed_files = Vec::new();

    for source_path in request.source_paths {
        let path = PathBuf::from(&source_path);
        let raw = match fs::read_to_string(&path) {
            Ok(raw) => raw,
            Err(error) => {
                failed_files.push(BrandKitImportFailure {
                    source_path: normalize_failed_path(&source_path),
                    error: format!("Errore lettura file: {}", error),
                });
                continue;
            }
        };

        let document = match load_import_bundle(&raw) {
            Ok(document) => document,
            Err(error) => {
                failed_files.push(BrandKitImportFailure {
                    source_path: normalize_failed_path(&source_path),
                    error,
                });
                continue;
            }
        };

        if document.kits.is_empty() {
            failed_files.push(BrandKitImportFailure {
                source_path: normalize_failed_path(&source_path),
                error: "Nessun brand kit trovato nel file JSON.".to_string(),
            });
            continue;
        }

        for entry in document.kits {
            let Ok(valid_name) = validate_brand_name(&entry.name) else {
                failed_files.push(BrandKitImportFailure {
                    source_path: normalize_failed_path(&source_path),
                    error: "Nome brand kit mancante o non valido.".to_string(),
                });
                continue;
            };

            let name = unique_import_brand_name(&mut available_names, &valid_name);
            let primary_color = match validate_hex_color(&entry.primary_color, "primaryColor") {
                Ok(value) => value,
                Err(error) => {
                    failed_files.push(BrandKitImportFailure {
                        source_path: normalize_failed_path(&source_path),
                        error,
                    });
                    continue;
                }
            };
            let secondary_color = match validate_hex_color(&entry.secondary_color, "secondaryColor") {
                Ok(value) => value,
                Err(error) => {
                    failed_files.push(BrandKitImportFailure {
                        source_path: normalize_failed_path(&source_path),
                        error,
                    });
                    continue;
                }
            };
            let accent_color = match validate_hex_color(&entry.accent_color, "accentColor") {
                Ok(value) => value,
                Err(error) => {
                    failed_files.push(BrandKitImportFailure {
                        source_path: normalize_failed_path(&source_path),
                        error,
                    });
                    continue;
                }
            };
            let text_color = match validate_hex_color(&entry.text_color, "textColor") {
                Ok(value) => value,
                Err(error) => {
                    failed_files.push(BrandKitImportFailure {
                        source_path: normalize_failed_path(&source_path),
                        error,
                    });
                    continue;
                }
            };
            let background_color =
                match validate_hex_color(&entry.background_color, "backgroundColor") {
                    Ok(value) => value,
                    Err(error) => {
                        failed_files.push(BrandKitImportFailure {
                            source_path: normalize_failed_path(&source_path),
                            error,
                        });
                        continue;
                    }
                };
            let kit = BrandKit {
                id: brand_kit_id_from_name(&name),
                name,
                primary_color,
                secondary_color,
                accent_color,
                text_color,
                background_color,
                logo_path: normalize_optional_path(&entry.logo_path),
                icon_path: normalize_optional_path(&entry.icon_path),
                font_heading: normalize_name(&entry.font_heading),
                font_body: normalize_name(&entry.font_body),
                watermark_path: normalize_optional_path(&entry.watermark_path),
                updated_at_ms: now_ms(),
            };
            imported_kits.push(kit);
        }
    }

    if imported_kits.is_empty() {
        if failed_files.is_empty() {
            return Err("Nessun brand kit importabile trovato.".to_string());
        }

        let first_error = &failed_files[0];
        return Err(format!(
            "Import brand kit non riuscito: {} ({})",
            first_error.source_path, first_error.error
        ));
    }

    store.kits.extend(imported_kits.iter().cloned());
    sort_brand_kits(&mut store.kits);
    save_brand_store(&app_handle, &store)?;
    remember_selected_kit(&app_handle, Some(imported_kits[0].id.clone()));

    Ok(ImportBrandKitsResult {
        kits: store.kits,
        imported_kits: imported_kits.clone(),
        imported_count: imported_kits.len(),
        failed_files,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_kit() -> BrandKit {
        BrandKit {
            id: "brand-kit-1".to_string(),
            name: "Studio Demo".to_string(),
            primary_color: "#2563EB".to_string(),
            secondary_color: "#7C3AED".to_string(),
            accent_color: "#F59E0B".to_string(),
            text_color: "#1F2937".to_string(),
            background_color: "#F9FAFB".to_string(),
            logo_path: "/assets/logo.png".to_string(),
            icon_path: "/assets/icon.png".to_string(),
            font_heading: "Montserrat".to_string(),
            font_body: "Inter".to_string(),
            watermark_path: "/assets/watermark.png".to_string(),
            updated_at_ms: 1,
        }
    }

    #[test]
    fn store_serializes_expected_shape() {
        let store = BrandKitStore {
            version: 1,
            kits: vec![sample_kit()],
        };

        let raw = serde_json::to_string(&store).expect("serializzazione valida");
        assert!(raw.contains("\"brandKit-1\"") || raw.contains("\"brand-kit-1\""));
        assert!(raw.contains("\"version\":1"));
    }

    #[test]
    fn import_bundle_rejects_unsupported_versions() {
        let raw = r#"{"version":2,"exportedAt":123,"kits":[]}"#;
        let error = load_import_bundle(raw).expect_err("versione non supportata");

        assert!(error.contains("Versione export brand kit non supportata"));
    }

    #[test]
    fn import_bundle_parses_valid_documents() {
        let raw = r##"{
          "version": 1,
          "exportedAt": 123456,
          "kits": [
            {
              "name": "Studio Demo",
              "primaryColor": "#2563EB",
              "secondaryColor": "#7C3AED",
              "accentColor": "#F59E0B",
              "textColor": "#1F2937",
              "backgroundColor": "#F9FAFB",
              "logoPath": "/assets/logo.png",
              "iconPath": "/assets/icon.png",
              "fontHeading": "Montserrat",
              "fontBody": "Inter",
              "watermarkPath": "/assets/watermark.png"
            }
          ]
        }"##;

        let document = load_import_bundle(raw).expect("documento valido");

        assert_eq!(document.version, 1);
        assert_eq!(document.kits.len(), 1);
        assert_eq!(document.kits[0].name, "Studio Demo");
    }

    #[test]
    fn import_names_gain_incremental_suffix_when_needed() {
        let mut existing = HashSet::from([
            "studio demo".to_string(),
            "studio demo - importato".to_string(),
        ]);

        let imported = unique_import_brand_name(&mut existing, "Studio Demo");

        assert_eq!(imported, "Studio Demo - importato 2");
    }

    #[test]
    fn validates_hex_colors_and_names() {
        assert!(validate_brand_name("  ").is_err());
        assert_eq!(
            validate_hex_color("#2563eb", "primaryColor").expect("colore valido"),
            "#2563EB"
        );
        assert!(validate_hex_color("not-a-color", "primaryColor").is_err());
    }
}
