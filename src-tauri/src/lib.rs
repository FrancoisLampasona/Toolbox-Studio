mod commands;
mod processing;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(commands::automation::WatchFolderManager::default())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            commands::automation::get_watch_folder_status,
            commands::automation::start_watch_folder,
            commands::automation::stop_watch_folder,
            commands::brand::get_brand_kits,
            commands::brand::save_brand_kit,
            commands::brand::delete_brand_kit,
            commands::brand::export_brand_kits,
            commands::brand::import_brand_kits,
            commands::scan::scan_images,
            commands::scan::scan_paths,
            commands::scan::load_thumbnail,
            commands::convert::convert_images,
            commands::convert::estimate_output_size,
            commands::favicon::generate_favicons,
            commands::report::export_conversion_report,
            commands::rename::preview_batch_rename,
            commands::rename::apply_batch_rename,
            commands::video::get_ffmpeg_status,
            commands::video::compress_video,
            commands::video::extract_frame,
            commands::filesystem::open_output_folder,
            commands::filesystem::get_presets,
            commands::filesystem::get_app_output_dir,
            commands::settings::get_app_settings,
            commands::settings::set_app_settings,
            commands::settings::get_optimize_profiles,
            commands::settings::save_optimize_profile,
            commands::settings::delete_optimize_profile,
            commands::settings::export_optimize_profiles,
            commands::settings::import_optimize_profiles,
            commands::settings::get_wordpress_profiles,
            commands::settings::save_wordpress_profile,
            commands::settings::delete_wordpress_profile,
            commands::settings::export_wordpress_profiles,
            commands::settings::import_wordpress_profiles,
        ])
        .setup(|app| {
            let icon_path = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
                .join("icons")
                .join("icon.png");
            if icon_path.exists() {
                if let Ok(icon_data) = std::fs::read(&icon_path) {
                    // Decode PNG to raw RGBA using the image crate
                    if let Ok(img) = image::load_from_memory(&icon_data) {
                        let rgba = img.to_rgba8();
                        let (w, h) = (rgba.width(), rgba.height());
                        let icon = tauri::image::Image::new_owned(rgba.into_raw(), w, h);
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.set_icon(icon);
                        }
                    }
                }
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("Errore avvio applicazione");
}
