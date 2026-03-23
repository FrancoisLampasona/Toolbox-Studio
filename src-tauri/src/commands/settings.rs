use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::Manager;

const SETTINGS_FILE_NAME: &str = "settings.json";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
#[serde(default)]
pub struct OptimizeSettings {
    pub format: String,
    pub quality: u8,
    pub resize_mode: String,
    pub active_preset_keys: Vec<String>,
    pub use_custom: bool,
    pub custom_width: u32,
    pub custom_height: u32,
    pub naming_pattern: String,
}

impl Default for OptimizeSettings {
    fn default() -> Self {
        Self {
            format: "webp".to_string(),
            quality: 80,
            resize_mode: "cover".to_string(),
            active_preset_keys: Vec::new(),
            use_custom: false,
            custom_width: 800,
            custom_height: 600,
            naming_pattern: "{nome}{suffix}_{w}x{h}".to_string(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OptimizeProfile {
    pub id: String,
    pub name: String,
    pub output_path: Option<String>,
    pub settings: OptimizeSettings,
    pub updated_at_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveOptimizeProfileRequest {
    pub id: Option<String>,
    pub name: String,
    pub output_path: Option<String>,
    pub settings: OptimizeSettings,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OptimizeProfileExportEntry {
    pub name: String,
    pub output_path: Option<String>,
    pub settings: OptimizeSettings,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OptimizeProfilesExportDocument {
    pub version: u32,
    pub exported_at: u64,
    pub profiles: Vec<OptimizeProfileExportEntry>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportOptimizeProfilesRequest {
    pub destination_path: String,
    pub profile_ids: Vec<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportOptimizeProfilesRequest {
    pub source_paths: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OptimizeProfileImportFailure {
    pub source_path: String,
    pub error: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportOptimizeProfilesResult {
    pub profiles: Vec<OptimizeProfile>,
    pub imported_profiles: Vec<OptimizeProfile>,
    pub imported_count: usize,
    pub failed_files: Vec<OptimizeProfileImportFailure>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WordPressComponentPreset {
    pub id: String,
    pub name: String,
    pub description: String,
    pub width: u32,
    pub height: u32,
    pub suffix: String,
    #[serde(default)]
    pub default_enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WordPressProfile {
    pub id: String,
    pub name: String,
    pub description: String,
    pub note: String,
    pub components: Vec<WordPressComponentPreset>,
    pub updated_at_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
#[serde(default)]
pub struct WordPressSettings {
    pub selected_profile_id: Option<String>,
    pub active_component_ids: Vec<String>,
    pub project_slug: String,
    pub naming_pattern: String,
    pub format: String,
    pub quality: u8,
    pub resize_mode: String,
    pub use_fallback_chain: bool,
}

impl Default for WordPressSettings {
    fn default() -> Self {
        Self {
            selected_profile_id: Some("generic-editorial".to_string()),
            active_component_ids: Vec::new(),
            project_slug: "progetto-wordpress".to_string(),
            naming_pattern: "{profilo}-{componente}-{slug}-{w}x{h}".to_string(),
            format: "webp".to_string(),
            quality: 82,
            resize_mode: "cover".to_string(),
            use_fallback_chain: false,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
#[serde(default)]
pub struct SrcsetSettings {
    pub preset_id: String,
    pub widths: Vec<u32>,
    pub sizes: String,
    pub alt_text: String,
    pub naming_pattern: String,
    pub quality: u8,
    pub resize_mode: String,
    pub include_avif: bool,
    pub include_webp: bool,
    pub include_jpeg: bool,
}

impl Default for SrcsetSettings {
    fn default() -> Self {
        Self {
            preset_id: "editorial-hero".to_string(),
            widths: vec![320, 640, 768, 1024, 1440, 1920],
            sizes: "100vw".to_string(),
            alt_text: String::new(),
            naming_pattern: "{slug}-{w}w".to_string(),
            quality: 82,
            resize_mode: "fit".to_string(),
            include_avif: true,
            include_webp: true,
            include_jpeg: true,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
#[serde(default)]
pub struct FaviconSettings {
    pub app_name: String,
    pub short_name: String,
    pub asset_path: String,
    pub theme_color: String,
    pub background_color: String,
    pub padding_percent: u8,
    pub transparent_background: bool,
    pub include_manifest: bool,
    pub include_apple_touch: bool,
    pub include_ico: bool,
    pub include_android_icons: bool,
}

impl Default for FaviconSettings {
    fn default() -> Self {
        Self {
            app_name: "Toolbox Creative Studio".to_string(),
            short_name: "Toolbox".to_string(),
            asset_path: "/".to_string(),
            theme_color: "#111827".to_string(),
            background_color: "#ffffff".to_string(),
            padding_percent: 10,
            transparent_background: true,
            include_manifest: true,
            include_apple_touch: true,
            include_ico: true,
            include_android_icons: true,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveWordPressProfileRequest {
    pub id: Option<String>,
    pub name: String,
    pub description: String,
    pub note: String,
    pub components: Vec<WordPressComponentPreset>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WordPressProfileExportEntry {
    pub name: String,
    pub description: String,
    pub note: String,
    pub components: Vec<WordPressComponentPreset>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WordPressProfilesExportDocument {
    pub version: u32,
    pub exported_at: u64,
    pub profiles: Vec<WordPressProfileExportEntry>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportWordPressProfilesRequest {
    pub destination_path: String,
    pub profiles: Vec<WordPressProfileExportEntry>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportWordPressProfilesRequest {
    pub source_paths: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WordPressProfileImportFailure {
    pub source_path: String,
    pub error: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportWordPressProfilesResult {
    pub profiles: Vec<WordPressProfile>,
    pub imported_profiles: Vec<WordPressProfile>,
    pub imported_count: usize,
    pub failed_files: Vec<WordPressProfileImportFailure>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
#[serde(default)]
pub struct AppSettings {
    pub last_input_paths: Vec<String>,
    pub last_output_path: Option<String>,
    pub default_module: String,
    pub last_optimize_options: Option<OptimizeSettings>,
    pub optimize_profiles: Vec<OptimizeProfile>,
    pub last_wordpress_options: Option<WordPressSettings>,
    pub wordpress_profiles: Vec<WordPressProfile>,
    pub last_srcset_options: Option<SrcsetSettings>,
    pub last_favicon_options: Option<FaviconSettings>,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            last_input_paths: Vec::new(),
            last_output_path: None,
            default_module: "home".to_string(),
            last_optimize_options: None,
            optimize_profiles: Vec::new(),
            last_wordpress_options: None,
            wordpress_profiles: Vec::new(),
            last_srcset_options: None,
            last_favicon_options: None,
        }
    }
}

fn fallback_output_dir() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .map(|p| p.join("Convertite"))
        .unwrap_or_else(|| PathBuf::from("Convertite"))
}

fn settings_path(app_handle: &tauri::AppHandle) -> Result<PathBuf, String> {
    let base_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("Errore risoluzione app data dir: {}", e))?;

    Ok(base_dir.join(SETTINGS_FILE_NAME))
}

fn ensure_parent_dir(path: &Path) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Errore creazione cartella impostazioni: {}", e))?;
    }

    Ok(())
}

pub fn load_app_settings(app_handle: &tauri::AppHandle) -> Result<AppSettings, String> {
    let path = settings_path(app_handle)?;
    if !path.exists() {
        return Ok(AppSettings::default());
    }

    let raw = fs::read_to_string(&path)
        .map_err(|e| format!("Errore lettura impostazioni: {}", e))?;
    serde_json::from_str::<AppSettings>(&raw)
        .map_err(|e| format!("Errore parsing impostazioni: {}", e))
}

pub fn save_app_settings(app_handle: &tauri::AppHandle, settings: &AppSettings) -> Result<(), String> {
    let path = settings_path(app_handle)?;
    ensure_parent_dir(&path)?;

    let raw = serde_json::to_string_pretty(settings)
        .map_err(|e| format!("Errore serializzazione impostazioni: {}", e))?;
    let tmp_path = path.with_extension("json.tmp");

    fs::write(&tmp_path, raw)
        .map_err(|e| format!("Errore scrittura impostazioni temporanee: {}", e))?;
    if path.exists() {
        let _ = fs::remove_file(&path);
    }
    fs::rename(&tmp_path, &path)
        .map_err(|e| format!("Errore salvataggio impostazioni: {}", e))
}

pub fn resolve_output_dir(app_handle: &tauri::AppHandle) -> Result<PathBuf, String> {
    let settings = load_app_settings(app_handle).unwrap_or_default();
    if let Some(path) = settings.last_output_path {
        let output = PathBuf::from(path);
        if !output.as_os_str().is_empty() {
            return Ok(output);
        }
    }

    Ok(fallback_output_dir())
}

pub fn thumbnail_cache_dir(app_handle: &tauri::AppHandle) -> Result<PathBuf, String> {
    let base_dir = app_handle
        .path()
        .app_cache_dir()
        .map_err(|e| format!("Errore risoluzione cache dir: {}", e))?;

    Ok(base_dir.join("thumbnail-cache"))
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

fn normalize_profile_name(name: &str) -> String {
    name.split_whitespace().collect::<Vec<_>>().join(" ")
}

fn normalize_name_key(name: &str) -> String {
    normalize_profile_name(name).to_lowercase()
}

fn normalize_optional_path(path: Option<String>) -> Option<String> {
    path.and_then(|value| {
        let trimmed = value.trim();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed.to_string())
        }
    })
}

fn profile_id_from_name(name: &str) -> String {
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
    let base = if slug.is_empty() { "profilo" } else { slug };
    format!("{}-{}", base, now_ms())
}

fn sort_profiles(profiles: &mut [OptimizeProfile]) {
    profiles.sort_by(|left, right| {
        right
            .updated_at_ms
            .cmp(&left.updated_at_ms)
            .then_with(|| left.name.to_lowercase().cmp(&right.name.to_lowercase()))
    });
}

fn sort_wordpress_profiles(profiles: &mut [WordPressProfile]) {
    profiles.sort_by(|left, right| {
        right
            .updated_at_ms
            .cmp(&left.updated_at_ms)
            .then_with(|| left.name.to_lowercase().cmp(&right.name.to_lowercase()))
    });
}

fn validate_profile_name(name: &str) -> Result<String, String> {
    let normalized = normalize_profile_name(name);
    if normalized.is_empty() {
        return Err("Inserisci un nome profilo.".to_string());
    }

    Ok(normalized)
}

fn unique_import_profile_name(existing: &mut HashSet<String>, base_name: &str) -> String {
    let normalized_base = normalize_profile_name(base_name);
    let base_key = normalize_name_key(&normalized_base);

    if existing.insert(base_key.clone()) {
        return normalized_base;
    }

    let mut attempt = 1usize;
    loop {
        let candidate = if attempt == 1 {
            format!("{} - importato", normalized_base)
        } else {
            format!("{} - importato {}", normalized_base, attempt)
        };

        let candidate_key = normalize_name_key(&candidate);
        if existing.insert(candidate_key) {
            return candidate;
        }

        attempt += 1;
    }
}

fn build_export_bundle(profiles: Vec<OptimizeProfileExportEntry>) -> OptimizeProfilesExportDocument {
    OptimizeProfilesExportDocument {
        version: 1,
        exported_at: now_ms(),
        profiles,
    }
}

fn load_import_bundle(raw: &str) -> Result<OptimizeProfilesExportDocument, String> {
    let document = serde_json::from_str::<OptimizeProfilesExportDocument>(raw)
        .map_err(|e| format!("Errore parsing JSON profili: {}", e))?;

    if document.version != 1 {
        return Err(format!(
            "Versione export non supportata: {}",
            document.version
        ));
    }

    Ok(document)
}

fn build_wordpress_export_bundle(
    profiles: Vec<WordPressProfileExportEntry>,
) -> WordPressProfilesExportDocument {
    WordPressProfilesExportDocument {
        version: 1,
        exported_at: now_ms(),
        profiles,
    }
}

fn load_wordpress_import_bundle(raw: &str) -> Result<WordPressProfilesExportDocument, String> {
    let document = serde_json::from_str::<WordPressProfilesExportDocument>(raw)
        .map_err(|e| format!("Errore parsing JSON profili WordPress: {}", e))?;

    if document.version != 1 {
        return Err(format!(
            "Versione export WordPress non supportata: {}",
            document.version
        ));
    }

    Ok(document)
}

fn validate_wordpress_components(components: &[WordPressComponentPreset]) -> Result<(), String> {
    if components.is_empty() {
        return Err("Il profilo WordPress deve avere almeno un componente.".to_string());
    }

    for component in components {
        if component.id.trim().is_empty() || component.name.trim().is_empty() {
            return Err("Ogni componente WordPress deve avere id e nome.".to_string());
        }

        if component.width == 0 || component.height == 0 {
            return Err("Ogni componente WordPress deve avere dimensioni valide.".to_string());
        }
    }

    Ok(())
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
pub async fn get_app_settings(app_handle: tauri::AppHandle) -> Result<AppSettings, String> {
    load_app_settings(&app_handle)
}

#[tauri::command]
pub async fn set_app_settings(
    app_handle: tauri::AppHandle,
    settings: AppSettings,
) -> Result<(), String> {
    save_app_settings(&app_handle, &settings)
}

#[tauri::command]
pub async fn get_optimize_profiles(
    app_handle: tauri::AppHandle,
) -> Result<Vec<OptimizeProfile>, String> {
    let mut profiles = load_app_settings(&app_handle)?.optimize_profiles;
    sort_profiles(&mut profiles);
    Ok(profiles)
}

#[tauri::command]
pub async fn save_optimize_profile(
    app_handle: tauri::AppHandle,
    request: SaveOptimizeProfileRequest,
) -> Result<OptimizeProfile, String> {
    let mut settings = load_app_settings(&app_handle)?;
    let name = validate_profile_name(&request.name)?;
    let requested_id = request.id.filter(|value| !value.trim().is_empty());
    let name_key = normalize_name_key(&name);

    let duplicate_exists = settings.optimize_profiles.iter().any(|profile| {
        let is_same_profile = requested_id
            .as_ref()
            .is_some_and(|requested| requested == &profile.id);
        !is_same_profile && normalize_name_key(&profile.name) == name_key
    });

    if duplicate_exists {
        return Err("Esiste gia' un profilo con questo nome.".to_string());
    }

    let updated_at_ms = now_ms();
    let output_path = normalize_optional_path(request.output_path);

    let profile = if let Some(existing) = settings
        .optimize_profiles
        .iter_mut()
        .find(|profile| requested_id.as_ref().is_some_and(|requested| requested == &profile.id))
    {
        existing.name = name;
        existing.output_path = output_path;
        existing.settings = request.settings;
        existing.updated_at_ms = updated_at_ms;
        existing.clone()
    } else {
        let profile = OptimizeProfile {
            id: requested_id.unwrap_or_else(|| profile_id_from_name(&name)),
            name,
            output_path,
            settings: request.settings,
            updated_at_ms,
        };
        settings.optimize_profiles.push(profile.clone());
        profile
    };

    sort_profiles(&mut settings.optimize_profiles);
    save_app_settings(&app_handle, &settings)?;

    Ok(profile)
}

#[tauri::command]
pub async fn delete_optimize_profile(
    app_handle: tauri::AppHandle,
    id: String,
) -> Result<Vec<OptimizeProfile>, String> {
    let mut settings = load_app_settings(&app_handle)?;
    let before_len = settings.optimize_profiles.len();
    settings.optimize_profiles.retain(|profile| profile.id != id);

    if settings.optimize_profiles.len() == before_len {
        return Err("Profilo non trovato.".to_string());
    }

    sort_profiles(&mut settings.optimize_profiles);
    save_app_settings(&app_handle, &settings)?;
    Ok(settings.optimize_profiles)
}

#[tauri::command]
pub async fn export_optimize_profiles(
    app_handle: tauri::AppHandle,
    request: ExportOptimizeProfilesRequest,
) -> Result<String, String> {
    let destination = request.destination_path.trim();
    if destination.is_empty() {
        return Err("Percorso export mancante.".to_string());
    }

    if request.profile_ids.is_empty() {
        return Err("Seleziona almeno un profilo da esportare.".to_string());
    }

    let settings = load_app_settings(&app_handle)?;
    let profile_ids: HashSet<&str> = request.profile_ids.iter().map(|id| id.as_str()).collect();
    let profiles = settings
        .optimize_profiles
        .into_iter()
        .filter(|profile| profile_ids.contains(profile.id.as_str()))
        .map(|profile| OptimizeProfileExportEntry {
            name: profile.name,
            output_path: profile.output_path,
            settings: profile.settings,
        })
        .collect::<Vec<_>>();

    if profiles.is_empty() {
        return Err("Nessun profilo selezionato per l'esportazione.".to_string());
    }

    let bundle = build_export_bundle(profiles);
    let raw = serde_json::to_string_pretty(&bundle)
        .map_err(|e| format!("Errore serializzazione export profili: {}", e))?;

    let destination_path = PathBuf::from(destination);
    ensure_parent_dir(&destination_path)?;
    fs::write(&destination_path, raw)
        .map_err(|e| format!("Errore scrittura export profili {}: {}", destination_path.display(), e))?;

    Ok(destination_path.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn import_optimize_profiles(
    app_handle: tauri::AppHandle,
    request: ImportOptimizeProfilesRequest,
) -> Result<ImportOptimizeProfilesResult, String> {
    if request.source_paths.is_empty() {
        return Err("Seleziona almeno un file JSON da importare.".to_string());
    }

    let mut settings = load_app_settings(&app_handle)?;
    let mut available_names: HashSet<String> = settings
        .optimize_profiles
        .iter()
        .map(|profile| normalize_name_key(&profile.name))
        .collect();
    let mut imported_profiles = Vec::new();
    let mut failed_files = Vec::new();

    for source_path in request.source_paths {
        let path = PathBuf::from(&source_path);
        let raw = match fs::read_to_string(&path) {
            Ok(raw) => raw,
            Err(error) => {
                failed_files.push(OptimizeProfileImportFailure {
                    source_path: normalize_failed_path(&source_path),
                    error: format!("Errore lettura file: {}", error),
                });
                continue;
            }
        };

        let document = match load_import_bundle(&raw) {
            Ok(document) => document,
            Err(error) => {
                failed_files.push(OptimizeProfileImportFailure {
                    source_path: normalize_failed_path(&source_path),
                    error,
                });
                continue;
            }
        };

        if document.profiles.is_empty() {
            failed_files.push(OptimizeProfileImportFailure {
                source_path: normalize_failed_path(&source_path),
                error: "Nessun profilo trovato nel file JSON.".to_string(),
            });
            continue;
        }

        for entry in document.profiles {
            let Ok(valid_name) = validate_profile_name(&entry.name) else {
                failed_files.push(OptimizeProfileImportFailure {
                    source_path: normalize_failed_path(&source_path),
                    error: "Nome profilo mancante o non valido.".to_string(),
                });
                continue;
            };

            let name = unique_import_profile_name(&mut available_names, &valid_name);
            let profile = OptimizeProfile {
                id: profile_id_from_name(&name),
                name,
                output_path: normalize_optional_path(entry.output_path),
                settings: entry.settings,
                updated_at_ms: now_ms(),
            };
            imported_profiles.push(profile);
        }
    }

    if imported_profiles.is_empty() {
        if failed_files.is_empty() {
            return Err("Nessun profilo importabile trovato.".to_string());
        }

        let first_error = &failed_files[0];
        return Err(format!(
            "Import non riuscito: {} ({})",
            first_error.source_path, first_error.error
        ));
    }

    settings.optimize_profiles.extend(imported_profiles.iter().cloned());
    sort_profiles(&mut settings.optimize_profiles);
    save_app_settings(&app_handle, &settings)?;

    Ok(ImportOptimizeProfilesResult {
        profiles: settings.optimize_profiles,
        imported_profiles: imported_profiles.clone(),
        imported_count: imported_profiles.len(),
        failed_files,
    })
}

#[tauri::command]
pub async fn get_wordpress_profiles(
    app_handle: tauri::AppHandle,
) -> Result<Vec<WordPressProfile>, String> {
    let mut profiles = load_app_settings(&app_handle)?.wordpress_profiles;
    sort_wordpress_profiles(&mut profiles);
    Ok(profiles)
}

#[tauri::command]
pub async fn save_wordpress_profile(
    app_handle: tauri::AppHandle,
    request: SaveWordPressProfileRequest,
) -> Result<WordPressProfile, String> {
    let mut settings = load_app_settings(&app_handle)?;
    let name = validate_profile_name(&request.name)?;
    validate_wordpress_components(&request.components)?;
    let requested_id = request.id.filter(|value| !value.trim().is_empty());
    let name_key = normalize_name_key(&name);

    let duplicate_exists = settings.wordpress_profiles.iter().any(|profile| {
        let is_same_profile = requested_id
            .as_ref()
            .is_some_and(|requested| requested == &profile.id);
        !is_same_profile && normalize_name_key(&profile.name) == name_key
    });

    if duplicate_exists {
        return Err("Esiste gia' un profilo WordPress con questo nome.".to_string());
    }

    let updated_at_ms = now_ms();
    let description = request.description.trim().to_string();
    let note = request.note.trim().to_string();

    let profile = if let Some(existing) = settings
        .wordpress_profiles
        .iter_mut()
        .find(|profile| requested_id.as_ref().is_some_and(|requested| requested == &profile.id))
    {
        existing.name = name;
        existing.description = description;
        existing.note = note;
        existing.components = request.components;
        existing.updated_at_ms = updated_at_ms;
        existing.clone()
    } else {
        let profile = WordPressProfile {
            id: requested_id.unwrap_or_else(|| profile_id_from_name(&name)),
            name,
            description,
            note,
            components: request.components,
            updated_at_ms,
        };
        settings.wordpress_profiles.push(profile.clone());
        profile
    };

    sort_wordpress_profiles(&mut settings.wordpress_profiles);
    save_app_settings(&app_handle, &settings)?;

    Ok(profile)
}

#[tauri::command]
pub async fn delete_wordpress_profile(
    app_handle: tauri::AppHandle,
    id: String,
) -> Result<Vec<WordPressProfile>, String> {
    let mut settings = load_app_settings(&app_handle)?;
    let before_len = settings.wordpress_profiles.len();
    settings.wordpress_profiles.retain(|profile| profile.id != id);

    if settings.wordpress_profiles.len() == before_len {
        return Err("Profilo WordPress non trovato.".to_string());
    }

    sort_wordpress_profiles(&mut settings.wordpress_profiles);
    save_app_settings(&app_handle, &settings)?;
    Ok(settings.wordpress_profiles)
}

#[tauri::command]
pub async fn export_wordpress_profiles(
    request: ExportWordPressProfilesRequest,
) -> Result<String, String> {
    let destination = request.destination_path.trim();
    if destination.is_empty() {
        return Err("Percorso export WordPress mancante.".to_string());
    }

    if request.profiles.is_empty() {
        return Err("Seleziona almeno un profilo WordPress da esportare.".to_string());
    }

    for profile in &request.profiles {
        let _ = validate_profile_name(&profile.name)?;
        validate_wordpress_components(&profile.components)?;
    }

    let bundle = build_wordpress_export_bundle(request.profiles);
    let raw = serde_json::to_string_pretty(&bundle)
        .map_err(|e| format!("Errore serializzazione export profili WordPress: {}", e))?;

    let destination_path = PathBuf::from(destination);
    ensure_parent_dir(&destination_path)?;
    fs::write(&destination_path, raw).map_err(|e| {
        format!(
            "Errore scrittura export profili WordPress {}: {}",
            destination_path.display(),
            e
        )
    })?;

    Ok(destination_path.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn import_wordpress_profiles(
    app_handle: tauri::AppHandle,
    request: ImportWordPressProfilesRequest,
) -> Result<ImportWordPressProfilesResult, String> {
    if request.source_paths.is_empty() {
        return Err("Seleziona almeno un file JSON da importare.".to_string());
    }

    let mut settings = load_app_settings(&app_handle)?;
    let mut available_names: HashSet<String> = settings
        .wordpress_profiles
        .iter()
        .map(|profile| normalize_name_key(&profile.name))
        .collect();
    let mut imported_profiles = Vec::new();
    let mut failed_files = Vec::new();

    for source_path in request.source_paths {
        let path = PathBuf::from(&source_path);
        let raw = match fs::read_to_string(&path) {
            Ok(raw) => raw,
            Err(error) => {
                failed_files.push(WordPressProfileImportFailure {
                    source_path: normalize_failed_path(&source_path),
                    error: format!("Errore lettura file: {}", error),
                });
                continue;
            }
        };

        let document = match load_wordpress_import_bundle(&raw) {
            Ok(document) => document,
            Err(error) => {
                failed_files.push(WordPressProfileImportFailure {
                    source_path: normalize_failed_path(&source_path),
                    error,
                });
                continue;
            }
        };

        if document.profiles.is_empty() {
            failed_files.push(WordPressProfileImportFailure {
                source_path: normalize_failed_path(&source_path),
                error: "Nessun profilo WordPress trovato nel file JSON.".to_string(),
            });
            continue;
        }

        for entry in document.profiles {
            let Ok(valid_name) = validate_profile_name(&entry.name) else {
                failed_files.push(WordPressProfileImportFailure {
                    source_path: normalize_failed_path(&source_path),
                    error: "Nome profilo WordPress mancante o non valido.".to_string(),
                });
                continue;
            };

            if let Err(error) = validate_wordpress_components(&entry.components) {
                failed_files.push(WordPressProfileImportFailure {
                    source_path: normalize_failed_path(&source_path),
                    error,
                });
                continue;
            }

            let name = unique_import_profile_name(&mut available_names, &valid_name);
            let profile = WordPressProfile {
                id: profile_id_from_name(&name),
                name,
                description: entry.description.trim().to_string(),
                note: entry.note.trim().to_string(),
                components: entry.components,
                updated_at_ms: now_ms(),
            };
            imported_profiles.push(profile);
        }
    }

    if imported_profiles.is_empty() {
        if failed_files.is_empty() {
            return Err("Nessun profilo WordPress importabile trovato.".to_string());
        }

        let first_error = &failed_files[0];
        return Err(format!(
            "Import WordPress non riuscito: {} ({})",
            first_error.source_path, first_error.error
        ));
    }

    settings.wordpress_profiles.extend(imported_profiles.iter().cloned());
    sort_wordpress_profiles(&mut settings.wordpress_profiles);
    save_app_settings(&app_handle, &settings)?;

    Ok(ImportWordPressProfilesResult {
        profiles: settings.wordpress_profiles,
        imported_profiles: imported_profiles.clone(),
        imported_count: imported_profiles.len(),
        failed_files,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_settings() -> OptimizeSettings {
        OptimizeSettings {
            format: "webp".to_string(),
            quality: 82,
            resize_mode: "cover".to_string(),
            active_preset_keys: vec!["1200x630_hero".to_string()],
            use_custom: false,
            custom_width: 1200,
            custom_height: 630,
            naming_pattern: "{nome}-{preset}".to_string(),
        }
    }

    fn sample_wordpress_components() -> Vec<WordPressComponentPreset> {
        vec![WordPressComponentPreset {
            id: "hero-banner".to_string(),
            name: "Hero Banner".to_string(),
            description: "Visual principale homepage.".to_string(),
            width: 1920,
            height: 720,
            suffix: "_hero-banner".to_string(),
            default_enabled: true,
        }]
    }

    #[test]
    fn import_profile_names_gain_incremental_suffix_when_needed() {
        let mut existing = HashSet::from([
            "cliente demo".to_string(),
            "cliente demo - importato".to_string(),
        ]);

        let imported = unique_import_profile_name(&mut existing, "Cliente Demo");

        assert_eq!(imported, "Cliente Demo - importato 2");
    }

    #[test]
    fn export_bundle_uses_expected_shape() {
        let bundle = build_export_bundle(vec![OptimizeProfileExportEntry {
            name: "Cliente Demo".to_string(),
            output_path: Some("/tmp/out".to_string()),
            settings: sample_settings(),
        }]);

        assert_eq!(bundle.version, 1);
        assert_eq!(bundle.profiles.len(), 1);
        assert_eq!(bundle.profiles[0].name, "Cliente Demo");
    }

    #[test]
    fn import_bundle_rejects_unsupported_versions() {
        let raw = r#"{"version":2,"exportedAt":123,"profiles":[]}"#;
        let error = load_import_bundle(raw).expect_err("versione non supportata");

        assert!(error.contains("Versione export non supportata"));
    }

    #[test]
    fn import_bundle_parses_valid_documents() {
        let raw = r#"{
          "version": 1,
          "exportedAt": 123456,
          "profiles": [
            {
              "name": "Cliente Demo",
              "outputPath": "/tmp/out",
              "settings": {
                "format": "webp",
                "quality": 82,
                "resizeMode": "cover",
                "activePresetKeys": ["1200x630_hero"],
                "useCustom": false,
                "customWidth": 1200,
                "customHeight": 630,
                "namingPattern": "{nome}-{preset}"
              }
            }
          ]
        }"#;

        let document = load_import_bundle(raw).expect("documento valido");

        assert_eq!(document.version, 1);
        assert_eq!(document.profiles.len(), 1);
        assert_eq!(document.profiles[0].name, "Cliente Demo");
        assert_eq!(document.profiles[0].settings.naming_pattern, "{nome}-{preset}");
    }

    #[test]
    fn wordpress_export_bundle_uses_expected_shape() {
        let bundle = build_wordpress_export_bundle(vec![WordPressProfileExportEntry {
            name: "Tema Demo".to_string(),
            description: "Profilo custom".to_string(),
            note: "Nota".to_string(),
            components: sample_wordpress_components(),
        }]);

        assert_eq!(bundle.version, 1);
        assert_eq!(bundle.profiles.len(), 1);
        assert_eq!(bundle.profiles[0].name, "Tema Demo");
    }

    #[test]
    fn wordpress_import_bundle_rejects_unsupported_versions() {
        let raw = r#"{"version":2,"exportedAt":123,"profiles":[]}"#;
        let error = load_wordpress_import_bundle(raw).expect_err("versione non supportata");

        assert!(error.contains("Versione export WordPress non supportata"));
    }

    #[test]
    fn wordpress_components_must_be_valid() {
        let error = validate_wordpress_components(&[WordPressComponentPreset {
            id: "".to_string(),
            name: "Hero".to_string(),
            description: "".to_string(),
            width: 0,
            height: 720,
            suffix: "_hero".to_string(),
            default_enabled: true,
        }])
        .expect_err("componenti invalidi");

        assert!(error.contains("id e nome") || error.contains("dimensioni"));
    }

    #[test]
    fn wordpress_import_bundle_parses_valid_documents() {
        let raw = r#"{
          "version": 1,
          "exportedAt": 123456,
          "profiles": [
            {
              "name": "Tema Demo",
              "description": "Profilo custom",
              "note": "Nota",
              "components": [
                {
                  "id": "hero-banner",
                  "name": "Hero Banner",
                  "description": "Hero homepage",
                  "width": 1920,
                  "height": 720,
                  "suffix": "_hero-banner",
                  "defaultEnabled": true
                }
              ]
            }
          ]
        }"#;

        let document = load_wordpress_import_bundle(raw).expect("documento valido");

        assert_eq!(document.version, 1);
        assert_eq!(document.profiles.len(), 1);
        assert_eq!(document.profiles[0].components[0].id, "hero-banner");
    }
}
