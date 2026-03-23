use image::imageops::FilterType;
use image::{DynamicImage, GenericImageView, ImageReader};
use std::fs;
use std::io::Cursor;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone)]
pub struct ConvertOptions {
    pub width: u32,
    pub height: u32,
    pub quality: u8,
    pub format: OutputFormat,
    pub resize_mode: ResizeMode,
    pub suffix: String,
}

#[derive(Debug, Clone, PartialEq)]
pub enum OutputFormat {
    WebP,
    Jpeg,
    Png,
    Avif,
}

#[derive(Debug, Clone, PartialEq)]
pub enum ResizeMode {
    Cover,
    Fit,
}

#[derive(Debug, Clone)]
pub struct ImageProbe {
    pub width: u32,
    pub height: u32,
    pub format: String,
}

#[derive(Debug, Clone)]
pub struct ConvertResult {
    pub output_path: String,
    pub input_size: u64,
    pub output_size: u64,
}

pub const DEFAULT_NAMING_PATTERN: &str = "{nome}{suffix}_{w}x{h}";

pub fn is_supported_extension(ext: &str) -> bool {
    matches!(ext, "jpg" | "jpeg" | "png" | "heic" | "heif" | "tif" | "tiff")
}

pub fn file_extension_lowercase(path: &Path) -> String {
    path.extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_lowercase())
        .unwrap_or_default()
}

pub fn file_format_label(path: &Path) -> String {
    let ext = file_extension_lowercase(path);
    if ext.is_empty() {
        "UNKNOWN".to_string()
    } else {
        ext.to_uppercase()
    }
}

pub fn probe_image(path: &Path) -> Result<ImageProbe, String> {
    let ext = file_extension_lowercase(path);
    if !is_supported_extension(&ext) {
        return Err(format!("Formato non supportato: {}", path.display()));
    }

    match ext.as_str() {
        "heic" | "heif" => {
            let img = load_image(path)?;
            let (width, height) = img.dimensions();
            Ok(ImageProbe {
                width,
                height,
                format: file_format_label(path),
            })
        }
        _ => {
            let reader = ImageReader::open(path)
                .map_err(|e| format!("Errore apertura {}: {}", path.display(), e))?
                .with_guessed_format()
                .map_err(|e| format!("Errore riconoscimento formato {}: {}", path.display(), e))?;
            let (width, height) = reader
                .into_dimensions()
                .map_err(|e| format!("Errore lettura dimensioni {}: {}", path.display(), e))?;

            Ok(ImageProbe {
                width,
                height,
                format: file_format_label(path),
            })
        }
    }
}

pub fn load_image(path: &Path) -> Result<DynamicImage, String> {
    let extension = file_extension_lowercase(path);

    match extension.as_str() {
        "heic" | "heif" => {
            #[cfg(target_os = "macos")]
            {
                load_heic(path)
            }
            #[cfg(not(target_os = "macos"))]
            {
                Err(format!("HEIC non supportato su questa piattaforma: {}", path.display()))
            }
        }
        _ => image::open(path).map_err(|e| format!("Errore caricamento {}: {}", path.display(), e)),
    }
}

#[cfg(target_os = "macos")]
fn load_heic(path: &Path) -> Result<DynamicImage, String> {
    let temp_path = std::env::temp_dir().join(format!(
        "convertitore_heic_{}.jpg",
        path.file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("temp")
    ));

    let output = std::process::Command::new("sips")
        .args([
            "-s",
            "format",
            "jpeg",
            &path.to_string_lossy(),
            "--out",
            &temp_path.to_string_lossy(),
        ])
        .output()
        .map_err(|e| format!("Errore conversione HEIC con sips: {}", e))?;

    if !output.status.success() {
        return Err(format!(
            "sips fallito: {}",
            String::from_utf8_lossy(&output.stderr)
        ));
    }

    let img = image::open(&temp_path)
        .map_err(|e| format!("Errore lettura HEIC convertito: {}", e))?;

    let _ = fs::remove_file(&temp_path);
    Ok(img)
}

pub fn convert_loaded_image(
    input_size: u64,
    img: &DynamicImage,
    output_path: &Path,
    options: &ConvertOptions,
) -> Result<ConvertResult, String> {
    save_image(img, output_path, options)?;

    let output_size = fs::metadata(output_path)
        .map_err(|e| format!("Errore metadati output: {}", e))?
        .len();

    Ok(ConvertResult {
        output_path: output_path.to_string_lossy().to_string(),
        input_size,
        output_size,
    })
}

pub fn estimate_output_size(path: &Path, options: &ConvertOptions) -> Result<(u64, u64), String> {
    let input_size = fs::metadata(path)
        .map_err(|e| format!("Errore metadati input {}: {}", path.display(), e))?
        .len();
    let img = load_image(path)?;
    let encoded = encode_image_bytes(&img, options)?;
    Ok((input_size, encoded.len() as u64))
}

pub fn add_collision_suffix(path: &Path, collision_index: usize) -> PathBuf {
    if collision_index == 0 {
        return path.to_path_buf();
    }

    let suffix = format!("-{:03}", collision_index);
    let stem = path
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or("image");
    let extension = path.extension().and_then(|value| value.to_str());
    let filename = match extension {
        Some(ext) if !ext.is_empty() => format!("{}{}.{}", stem, suffix, ext),
        _ => format!("{}{}", stem, suffix),
    };

    path.parent()
        .map(|parent| parent.join(&filename))
        .unwrap_or_else(|| PathBuf::from(filename))
}

pub fn build_named_stem(
    original_stem: &str,
    width: u32,
    height: u32,
    format_label: &str,
    suffix: &str,
    naming_pattern: Option<&str>,
    profile_name: Option<&str>,
    sequence_number: usize,
) -> String {
    let pattern = naming_pattern
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or(DEFAULT_NAMING_PATTERN);
    let preset_label = preset_label_from_suffix(suffix);
    let sequence_label = format!("{:03}", sequence_number.max(1));
    let profile_slug = slugify_component(profile_name.unwrap_or(""));
    let replacements = [
        ("{nome}", sanitize_filename_component(original_stem)),
        ("{slug}", slugify_component(original_stem)),
        ("{suffix}", sanitize_suffix_token(suffix)),
        ("{preset}", preset_label.clone()),
        ("{componente}", preset_label),
        ("{w}", width.to_string()),
        ("{h}", height.to_string()),
        ("{formato}", format_label.to_string()),
        ("{n}", sequence_label),
        (
            "{profilo}",
            if profile_slug.is_empty() {
                "profilo".to_string()
            } else {
                profile_slug
            },
        ),
    ];

    let mut output_stem = pattern.to_string();
    for (token, value) in replacements {
        output_stem = output_stem.replace(token, &value);
    }

    let output_stem = {
        let sanitized = sanitize_filename_component(&output_stem);
        if sanitized.is_empty() {
            sanitize_filename_component(&format!(
                "{}{}_{}x{}",
                original_stem, suffix, width, height
            ))
        } else {
            sanitized
        }
    };

    if output_stem.is_empty() {
        "image".to_string()
    } else {
        output_stem
    }
}

pub fn build_output_path(
    input_path: &Path,
    output_dir: &Path,
    options: &ConvertOptions,
    naming_pattern: Option<&str>,
    profile_name: Option<&str>,
    sequence_number: usize,
) -> PathBuf {
    let original_stem = input_path
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("image");
    let format_label = output_extension(options);
    let output_stem = build_named_stem(
        original_stem,
        options.width,
        options.height,
        format_label,
        &options.suffix,
        naming_pattern,
        profile_name,
        sequence_number,
    );
    let output_filename = format!("{}.{}", output_stem, format_label);

    output_dir.join(output_filename)
}

fn output_extension(options: &ConvertOptions) -> &'static str {
    match options.format {
        OutputFormat::WebP => "webp",
        OutputFormat::Jpeg => "jpg",
        OutputFormat::Png => "png",
        OutputFormat::Avif => "avif",
    }
}

fn preset_label_from_suffix(suffix: &str) -> String {
    let trimmed = suffix.trim().trim_start_matches('_').replace('_', "-");
    let compact = trimmed.trim_matches('-');
    if compact.is_empty() {
        "custom".to_string()
    } else {
        compact.to_string()
    }
}

pub fn sanitize_filename_component(value: &str) -> String {
    let mut sanitized = String::with_capacity(value.len());
    let mut last_was_separator = false;

    for ch in value.chars() {
        if ch.is_control() {
            continue;
        }

        let normalized = match ch {
            '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*' => '-',
            _ => ch,
        };

        let is_separator = matches!(normalized, '-' | '_' | ' ');
        if is_separator && last_was_separator {
            continue;
        }

        sanitized.push(normalized);
        last_was_separator = is_separator;
    }

    sanitized
        .trim_matches(|ch: char| ch.is_whitespace() || matches!(ch, '.' | '-' | '_'))
        .to_string()
}

pub fn sanitize_suffix_token(value: &str) -> String {
    let mut sanitized = String::with_capacity(value.len());

    for ch in value.chars() {
        if ch.is_control() {
            continue;
        }

        let normalized = match ch {
            '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*' => '-',
            _ => ch,
        };

        sanitized.push(normalized);
    }

    sanitized
        .trim_matches(|ch: char| ch.is_whitespace() || ch == '.')
        .to_string()
}

pub fn slugify_component(value: &str) -> String {
    let mut slug = String::new();
    let mut last_was_dash = false;

    for ch in value.chars() {
        if ch.is_ascii_alphanumeric() {
            slug.push(ch.to_ascii_lowercase());
            last_was_dash = false;
        } else if !last_was_dash {
            slug.push('-');
            last_was_dash = true;
        }
    }

    slug.trim_matches('-').to_string()
}

fn resize_image(img: &DynamicImage, options: &ConvertOptions) -> DynamicImage {
    let (src_w, src_h) = img.dimensions();
    let target_w = options.width;
    let target_h = options.height;

    match options.resize_mode {
        ResizeMode::Cover => {
            let scale_w = target_w as f64 / src_w as f64;
            let scale_h = target_h as f64 / src_h as f64;
            let scale = scale_w.max(scale_h);

            let new_w = (src_w as f64 * scale).ceil() as u32;
            let new_h = (src_h as f64 * scale).ceil() as u32;

            let scaled = img.resize_exact(new_w, new_h, FilterType::Lanczos3);
            let x = (new_w.saturating_sub(target_w)) / 2;
            let y = (new_h.saturating_sub(target_h)) / 2;

            scaled.crop_imm(x, y, target_w.min(new_w), target_h.min(new_h))
        }
        ResizeMode::Fit => img.resize(target_w, target_h, FilterType::Lanczos3),
    }
}

fn save_image(img: &DynamicImage, path: &Path, options: &ConvertOptions) -> Result<(), String> {
    let bytes = encode_image_bytes(img, options)?;
    fs::write(path, bytes).map_err(|e| format!("Errore salvataggio immagine: {}", e))
}

fn encode_image_bytes(img: &DynamicImage, options: &ConvertOptions) -> Result<Vec<u8>, String> {
    let resized = resize_image(img, options);

    match options.format {
        OutputFormat::WebP => {
            let rgb = resized.to_rgb8();
            let (w, h) = (rgb.width(), rgb.height());
            let encoder = webp::Encoder::from_rgb(rgb.as_raw(), w, h);
            let webp_data = encoder.encode(options.quality as f32);

            Ok(webp_data.to_vec())
        }
        OutputFormat::Jpeg => {
            let rgb = resized.to_rgb8();
            let mut buf = Cursor::new(Vec::new());
            image::codecs::jpeg::JpegEncoder::new_with_quality(&mut buf, options.quality)
                .encode(
                    &rgb,
                    rgb.width(),
                    rgb.height(),
                    image::ExtendedColorType::Rgb8,
                )
                .map_err(|e| format!("Errore encoding JPEG: {}", e))?;

            Ok(buf.into_inner())
        }
        OutputFormat::Png => {
            let rgba = resized.to_rgba8();
            let mut buf = Cursor::new(Vec::new());
            let encoder = image::codecs::png::PngEncoder::new_with_quality(
                &mut buf,
                image::codecs::png::CompressionType::Best,
                image::codecs::png::FilterType::Adaptive,
            );
            image::ImageEncoder::write_image(
                encoder,
                &rgba,
                rgba.width(),
                rgba.height(),
                image::ExtendedColorType::Rgba8,
            )
            .map_err(|e| format!("Errore encoding PNG: {}", e))?;

            Ok(buf.into_inner())
        }
        OutputFormat::Avif => {
            let rgba = resized.to_rgba8();
            let mut buf = Cursor::new(Vec::new());
            let encoder = image::codecs::avif::AvifEncoder::new_with_speed_quality(
                &mut buf,
                6,
                options.quality,
            );
            image::ImageEncoder::write_image(
                encoder,
                &rgba,
                rgba.width(),
                rgba.height(),
                image::ExtendedColorType::Rgba8,
            )
            .map_err(|e| format!("Errore encoding AVIF: {}", e))?;

            Ok(buf.into_inner())
        }
    }
}

pub fn generate_thumbnail(input_path: &Path, max_size: u32) -> Result<Vec<u8>, String> {
    let img = load_image(input_path)?;
    generate_thumbnail_from_image(&img, max_size)
}

pub fn generate_thumbnail_from_image(
    img: &DynamicImage,
    max_size: u32,
) -> Result<Vec<u8>, String> {
    let thumb = img.thumbnail(max_size, max_size);
    let rgb = thumb.to_rgb8();
    let mut buf = Cursor::new(Vec::new());
    image::codecs::jpeg::JpegEncoder::new_with_quality(&mut buf, 75)
        .encode(
            &rgb,
            rgb.width(),
            rgb.height(),
            image::ExtendedColorType::Rgb8,
        )
        .map_err(|e| format!("Errore thumbnail: {}", e))?;
    Ok(buf.into_inner())
}

#[cfg(test)]
mod tests {
    use super::*;
    use image::{ImageBuffer, Rgba};
    use std::fs;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn now_ms() -> u128 {
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis()
    }

    fn unique_test_dir(label: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("toolbox-processor-{}-{}", label, now_ms()));
        fs::create_dir_all(&dir).expect("create temp dir");
        dir
    }

    fn build_test_job() -> ConvertOptions {
        ConvertOptions {
            width: 120,
            height: 80,
            quality: 72,
            format: OutputFormat::WebP,
            resize_mode: ResizeMode::Cover,
            suffix: "_hero".to_string(),
        }
    }

    #[test]
    fn estimate_output_size_returns_bytes_for_supported_image() {
        let dir = unique_test_dir("estimate");
        let path = dir.join("sample.png");
        let image = ImageBuffer::<Rgba<u8>, Vec<u8>>::from_pixel(32, 32, Rgba([12, 34, 56, 255]));
        image.save(&path).expect("save test image");

        let (input_size, estimated_output_size) =
            estimate_output_size(&path, &build_test_job()).expect("estimate size");

        assert!(input_size > 0);
        assert!(estimated_output_size > 0);

        let _ = fs::remove_dir_all(dir);
    }
}
