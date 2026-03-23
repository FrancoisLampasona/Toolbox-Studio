use crate::processing::processor;
use ico::{IconDir, IconDirEntry, IconImage, ResourceType};
use image::imageops::{self, FilterType};
use image::{DynamicImage, GenericImageView, ImageFormat, Rgba, RgbaImage};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::fs;
use std::fs::File;
use std::io::BufWriter;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GenerateFaviconsRequest {
    pub source_path: String,
    pub output_dir: String,
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

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GeneratedFaviconFile {
    pub label: String,
    pub filename: String,
    pub path: String,
    pub bytes: u64,
    pub size: u32,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GenerateFaviconsResult {
    pub source_path: String,
    pub output_dir: String,
    pub source_size: u64,
    pub files: Vec<GeneratedFaviconFile>,
    pub html_snippet: String,
    pub manifest_path: Option<String>,
}

fn clamp_padding(value: u8) -> u8 {
    value.min(35)
}

fn parse_hex_color(value: &str) -> Result<Rgba<u8>, String> {
    let hex = value.trim().trim_start_matches('#');
    let expanded = match hex.len() {
        3 => {
            let mut parts = String::with_capacity(6);
            for ch in hex.chars() {
                parts.push(ch);
                parts.push(ch);
            }
            parts
        }
        6 => hex.to_string(),
        _ => {
            return Err(format!(
                "Colore non valido: {}. Usa formato #RRGGBB o #RGB.",
                value
            ))
        }
    };

    let r = u8::from_str_radix(&expanded[0..2], 16)
        .map_err(|_| format!("Colore non valido: {}", value))?;
    let g = u8::from_str_radix(&expanded[2..4], 16)
        .map_err(|_| format!("Colore non valido: {}", value))?;
    let b = u8::from_str_radix(&expanded[4..6], 16)
        .map_err(|_| format!("Colore non valido: {}", value))?;

    Ok(Rgba([r, g, b, 255]))
}

fn normalize_asset_path(value: &str) -> String {
    let trimmed = value.trim();
    if trimmed.is_empty() || trimmed == "/" {
        return "/".to_string();
    }

    let without_trailing = trimmed.trim_end_matches('/');
    if without_trailing.starts_with('/') {
        format!("{}/", without_trailing)
    } else {
        format!("/{}/", without_trailing)
    }
}

fn join_asset_path(base: &str, filename: &str) -> String {
    if base == "/" {
        format!("/{}", filename)
    } else {
        format!("{}{}", base, filename)
    }
}

fn build_square_image(
    source: &DynamicImage,
    size: u32,
    padding_percent: u8,
    background: Rgba<u8>,
    transparent_background: bool,
) -> RgbaImage {
    let mut canvas = if transparent_background {
        RgbaImage::from_pixel(size, size, Rgba([0, 0, 0, 0]))
    } else {
        RgbaImage::from_pixel(size, size, background)
    };

    let padding_percent = clamp_padding(padding_percent) as f32 / 100.0;
    let safe_area = (size as f32 * (1.0 - padding_percent * 2.0)).max(1.0);
    let (source_width, source_height) = source.dimensions();
    let scale = (safe_area / source_width as f32).min(safe_area / source_height as f32);
    let target_width = ((source_width as f32 * scale).round() as u32).max(1);
    let target_height = ((source_height as f32 * scale).round() as u32).max(1);
    let resized = source
        .resize(target_width, target_height, FilterType::Lanczos3)
        .to_rgba8();
    let offset_x = ((size - target_width) / 2) as i64;
    let offset_y = ((size - target_height) / 2) as i64;
    imageops::overlay(&mut canvas, &resized, offset_x, offset_y);

    canvas
}

fn save_png(path: &Path, image: &RgbaImage) -> Result<u64, String> {
    DynamicImage::ImageRgba8(image.clone())
        .save_with_format(path, ImageFormat::Png)
        .map_err(|e| format!("Errore scrittura PNG {}: {}", path.display(), e))?;

    fs::metadata(path)
        .map_err(|e| format!("Errore metadati output {}: {}", path.display(), e))
        .map(|metadata| metadata.len())
}

fn write_ico(path: &Path, source: &DynamicImage, padding_percent: u8, background: Rgba<u8>) -> Result<u64, String> {
    let mut icon_dir = IconDir::new(ResourceType::Icon);

    for size in [16, 32, 48] {
        let image = build_square_image(source, size, padding_percent, background, true);
        let icon = IconImage::from_rgba_data(size, size, image.into_raw());
        let entry = IconDirEntry::encode(&icon)
            .map_err(|e| format!("Errore encoding favicon.ico: {}", e))?;
        icon_dir.add_entry(entry);
    }

    let file = File::create(path)
        .map_err(|e| format!("Errore creazione favicon.ico {}: {}", path.display(), e))?;
    let mut writer = BufWriter::new(file);
    icon_dir
        .write(&mut writer)
        .map_err(|e| format!("Errore scrittura favicon.ico {}: {}", path.display(), e))?;

    fs::metadata(path)
        .map_err(|e| format!("Errore metadati favicon.ico {}: {}", path.display(), e))
        .map(|metadata| metadata.len())
}

fn build_html_snippet(
    asset_path: &str,
    theme_color: &str,
    include_ico: bool,
    include_apple_touch: bool,
    include_manifest: bool,
) -> String {
    let mut lines = Vec::new();

    if include_ico {
        lines.push(format!(
            r#"<link rel="icon" href="{}" sizes="any">"#,
            join_asset_path(asset_path, "favicon.ico")
        ));
    }

    lines.push(format!(
        r#"<link rel="icon" type="image/png" sizes="32x32" href="{}">"#,
        join_asset_path(asset_path, "favicon-32x32.png")
    ));
    lines.push(format!(
        r#"<link rel="icon" type="image/png" sizes="16x16" href="{}">"#,
        join_asset_path(asset_path, "favicon-16x16.png")
    ));

    if include_apple_touch {
        lines.push(format!(
            r#"<link rel="apple-touch-icon" sizes="180x180" href="{}">"#,
            join_asset_path(asset_path, "apple-touch-icon.png")
        ));
    }

    if include_manifest {
        lines.push(format!(
            r#"<link rel="manifest" href="{}">"#,
            join_asset_path(asset_path, "site.webmanifest")
        ));
    }

    lines.push(format!(r#"<meta name="theme-color" content="{}">"#, theme_color));
    lines.join("\n")
}

#[tauri::command]
pub async fn generate_favicons(
    request: GenerateFaviconsRequest,
) -> Result<GenerateFaviconsResult, String> {
    let source_path = PathBuf::from(request.source_path.trim());
    if request.source_path.trim().is_empty() {
        return Err("Sorgente favicon mancante.".to_string());
    }
    if !source_path.exists() {
        return Err(format!(
            "Sorgente favicon non trovata: {}",
            source_path.display()
        ));
    }

    let output_dir = PathBuf::from(request.output_dir.trim());
    if request.output_dir.trim().is_empty() {
        return Err("Cartella output mancante.".to_string());
    }
    fs::create_dir_all(&output_dir)
        .map_err(|e| format!("Errore creazione cartella output {}: {}", output_dir.display(), e))?;

    let background = parse_hex_color(&request.background_color)?;
    let source = processor::load_image(&source_path)?;
    let source_size = fs::metadata(&source_path)
        .map_err(|e| format!("Errore metadati sorgente {}: {}", source_path.display(), e))?
        .len();

    let include_android_icons = request.include_android_icons || request.include_manifest;
    let include_manifest = request.include_manifest;
    let asset_path = normalize_asset_path(&request.asset_path);
    let mut generated_files = Vec::new();

    let png_targets = [
        ("favicon-16x16.png", "PNG 16", 16u32),
        ("favicon-32x32.png", "PNG 32", 32u32),
    ];

    for (filename, label, size) in png_targets {
        let path = output_dir.join(filename);
        let image = build_square_image(
            &source,
            size,
            request.padding_percent,
            background,
            request.transparent_background,
        );
        let bytes = save_png(&path, &image)?;
        generated_files.push(GeneratedFaviconFile {
            label: label.to_string(),
            filename: filename.to_string(),
            path: path.to_string_lossy().to_string(),
            bytes,
            size,
        });
    }

    if request.include_apple_touch {
        let filename = "apple-touch-icon.png";
        let path = output_dir.join(filename);
        let image = build_square_image(
            &source,
            180,
            request.padding_percent,
            background,
            false,
        );
        let bytes = save_png(&path, &image)?;
        generated_files.push(GeneratedFaviconFile {
            label: "Apple Touch".to_string(),
            filename: filename.to_string(),
            path: path.to_string_lossy().to_string(),
            bytes,
            size: 180,
        });
    }

    if include_android_icons {
        for (filename, label, size) in [
            ("android-chrome-192x192.png", "Android 192", 192u32),
            ("android-chrome-512x512.png", "Android 512", 512u32),
        ] {
            let path = output_dir.join(filename);
            let image = build_square_image(
                &source,
                size,
                request.padding_percent,
                background,
                false,
            );
            let bytes = save_png(&path, &image)?;
            generated_files.push(GeneratedFaviconFile {
                label: label.to_string(),
                filename: filename.to_string(),
                path: path.to_string_lossy().to_string(),
                bytes,
                size,
            });
        }
    }

    if request.include_ico {
        let filename = "favicon.ico";
        let path = output_dir.join(filename);
        let bytes = write_ico(&path, &source, request.padding_percent, background)?;
        generated_files.push(GeneratedFaviconFile {
            label: "ICO".to_string(),
            filename: filename.to_string(),
            path: path.to_string_lossy().to_string(),
            bytes,
            size: 48,
        });
    }

    let manifest_path = if include_manifest {
        let manifest_target = output_dir.join("site.webmanifest");
        let manifest_icons = generated_files
            .iter()
            .filter(|file| matches!(file.filename.as_str(), "android-chrome-192x192.png" | "android-chrome-512x512.png"))
            .map(|file| {
                json!({
                    "src": join_asset_path(&asset_path, &file.filename),
                    "sizes": format!("{}x{}", file.size, file.size),
                    "type": "image/png",
                    "purpose": if file.size >= 512 { "any maskable" } else { "any" },
                })
            })
            .collect::<Vec<_>>();

        let manifest = json!({
            "name": request.app_name.trim(),
            "short_name": if request.short_name.trim().is_empty() { request.app_name.trim() } else { request.short_name.trim() },
            "icons": manifest_icons,
            "theme_color": request.theme_color.trim(),
            "background_color": request.background_color.trim(),
            "display": "standalone",
        });

        let raw = serde_json::to_string_pretty(&manifest)
            .map_err(|e| format!("Errore serializzazione manifest: {}", e))?;
        fs::write(&manifest_target, raw).map_err(|e| {
            format!(
                "Errore scrittura manifest {}: {}",
                manifest_target.display(),
                e
            )
        })?;
        Some(manifest_target.to_string_lossy().to_string())
    } else {
        None
    };

    Ok(GenerateFaviconsResult {
        source_path: source_path.to_string_lossy().to_string(),
        output_dir: output_dir.to_string_lossy().to_string(),
        source_size,
        files: generated_files,
        html_snippet: build_html_snippet(
            &asset_path,
            request.theme_color.trim(),
            request.include_ico,
            request.include_apple_touch,
            include_manifest,
        ),
        manifest_path,
    })
}

#[cfg(test)]
mod tests {
    use super::{normalize_asset_path, parse_hex_color};

    #[test]
    fn normalize_asset_path_adds_leading_and_trailing_slash() {
        assert_eq!(normalize_asset_path("assets/favicons"), "/assets/favicons/");
        assert_eq!(normalize_asset_path("/assets/favicons/"), "/assets/favicons/");
        assert_eq!(normalize_asset_path(""), "/");
    }

    #[test]
    fn parse_hex_color_accepts_short_and_long_forms() {
        assert_eq!(parse_hex_color("#fff").unwrap().0, [255, 255, 255, 255]);
        assert_eq!(parse_hex_color("#111827").unwrap().0, [17, 24, 39, 255]);
        assert!(parse_hex_color("not-a-color").is_err());
    }
}
