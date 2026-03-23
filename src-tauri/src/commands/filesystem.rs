use crate::commands::scan;
use crate::commands::settings;
use crate::processing::presets;

#[tauri::command]
pub async fn open_output_folder(
    app_handle: tauri::AppHandle,
    path: Option<String>,
) -> Result<(), String> {
    let output_dir = path
        .filter(|value| !value.trim().is_empty())
        .map(std::path::PathBuf::from)
        .unwrap_or_else(|| {
            settings::resolve_output_dir(&app_handle)
                .unwrap_or_else(|_| scan::output_dir())
        });
    std::fs::create_dir_all(&output_dir)
        .map_err(|e| format!("Errore creazione cartella: {}", e))?;

    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&output_dir)
            .spawn()
            .map_err(|e| format!("Errore apertura Finder: {}", e))?;
    }

    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(&output_dir)
            .spawn()
            .map_err(|e| format!("Errore apertura Explorer: {}", e))?;
    }

    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&output_dir)
            .spawn()
            .map_err(|e| format!("Errore apertura file manager: {}", e))?;
    }

    Ok(())
}

#[tauri::command]
pub async fn get_app_output_dir(app_handle: tauri::AppHandle) -> Result<String, String> {
    let output_dir = settings::resolve_output_dir(&app_handle)?;
    Ok(output_dir.to_string_lossy().to_string())
}

#[tauri::command]
pub fn get_presets() -> Vec<presets::Preset> {
    presets::get_presets()
}
