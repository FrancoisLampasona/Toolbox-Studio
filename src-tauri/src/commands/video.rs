use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::Instant;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FfmpegStatus {
    pub installed: bool,
    pub binary_path: Option<String>,
    pub version: Option<String>,
    pub message: Option<String>,
}

#[derive(Debug, Clone)]
struct CompressionPreset {
    key: &'static str,
    label: &'static str,
    ffmpeg_preset: &'static str,
    crf: u8,
    audio_bitrate: &'static str,
}

const COMPRESSION_PRESETS: &[CompressionPreset] = &[
    CompressionPreset {
        key: "draft",
        label: "Bozza",
        ffmpeg_preset: "veryfast",
        crf: 32,
        audio_bitrate: "96k",
    },
    CompressionPreset {
        key: "balanced",
        label: "Bilanciato",
        ffmpeg_preset: "medium",
        crf: 26,
        audio_bitrate: "128k",
    },
    CompressionPreset {
        key: "quality",
        label: "Qualita",
        ffmpeg_preset: "slow",
        crf: 20,
        audio_bitrate: "160k",
    },
];

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CompressVideoRequest {
    pub input_path: String,
    pub output_path: Option<String>,
    pub output_dir: Option<String>,
    pub preset: Option<String>,
    pub overwrite: Option<bool>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CompressVideoResult {
    pub input_path: String,
    pub output_path: String,
    pub preset: String,
    pub preset_label: String,
    pub crf: u8,
    pub ffmpeg_preset: String,
    pub input_size: u64,
    pub output_size: u64,
    pub saved_bytes: i64,
    pub savings_percent: f64,
    pub duration_ms: u128,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExtractFrameRequest {
    pub input_path: String,
    pub output_path: Option<String>,
    pub output_dir: Option<String>,
    pub timestamp_seconds: Option<f64>,
    pub image_format: Option<String>,
    pub overwrite: Option<bool>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExtractFrameResult {
    pub input_path: String,
    pub output_path: String,
    pub timestamp_seconds: f64,
    pub image_format: String,
    pub bytes: u64,
    pub duration_ms: u128,
}

fn ffmpeg_install_hint() -> String {
    #[cfg(target_os = "macos")]
    {
        "FFmpeg non trovato nel PATH. Installa con `brew install ffmpeg` e riapri l'app."
            .to_string()
    }

    #[cfg(target_os = "windows")]
    {
        "FFmpeg non trovato nel PATH. Installa FFmpeg e aggiungilo alle variabili d'ambiente."
            .to_string()
    }

    #[cfg(all(not(target_os = "macos"), not(target_os = "windows")))]
    {
        "FFmpeg non trovato nel PATH. Installa FFmpeg e riapri l'app.".to_string()
    }
}

fn probe_ffmpeg() -> FfmpegStatus {
    match Command::new("ffmpeg").arg("-version").output() {
        Ok(output) if output.status.success() => {
            let stdout = String::from_utf8_lossy(&output.stdout);
            let version = stdout
                .lines()
                .next()
                .map(str::trim)
                .filter(|line| !line.is_empty())
                .map(ToOwned::to_owned);

            FfmpegStatus {
                installed: true,
                binary_path: Some("ffmpeg".to_string()),
                version,
                message: Some("FFmpeg disponibile".to_string()),
            }
        }
        Ok(output) => FfmpegStatus {
            installed: false,
            binary_path: None,
            version: None,
            message: Some({
                let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
                if stderr.is_empty() {
                    ffmpeg_install_hint()
                } else {
                    stderr
                }
            }),
        },
        Err(error) => FfmpegStatus {
            installed: false,
            binary_path: None,
            version: None,
            message: Some(if error.kind() == std::io::ErrorKind::NotFound {
                ffmpeg_install_hint()
            } else {
                format!("Impossibile avviare FFmpeg: {}", error)
            }),
        },
    }
}

fn ensure_ffmpeg() -> Result<(), String> {
    let status = probe_ffmpeg();
    if status.installed {
        Ok(())
    } else {
        Err(status.message.unwrap_or_else(ffmpeg_install_hint))
    }
}

fn normalize_path(path: &Path) -> PathBuf {
    fs::canonicalize(path).unwrap_or_else(|_| path.to_path_buf())
}

fn stem_from_path(path: &Path) -> String {
    path.file_stem()
        .and_then(|stem| stem.to_str())
        .filter(|value| !value.trim().is_empty())
        .unwrap_or("video")
        .to_string()
}

fn extension_from_path(path: &Path) -> Option<String> {
    path.extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| ext.to_lowercase())
}

fn preset_from_name(value: Option<&str>) -> CompressionPreset {
    let normalized = value.unwrap_or("balanced").trim().to_lowercase();

    COMPRESSION_PRESETS
        .iter()
        .find(|preset| {
            preset.key == normalized
                || (normalized == "medium" && preset.key == "balanced")
                || (normalized == "web" && preset.key == "balanced")
                || (normalized == "preview" && preset.key == "draft")
                || (normalized == "high" && preset.key == "quality")
        })
        .cloned()
        .unwrap_or_else(|| COMPRESSION_PRESETS[1].clone())
}

fn build_output_dir(input_path: &Path, output_dir: Option<&str>) -> PathBuf {
    if let Some(dir) = output_dir {
        let trimmed = dir.trim();
        if !trimmed.is_empty() {
            return PathBuf::from(trimmed);
        }
    }

    input_path
        .parent()
        .map(Path::to_path_buf)
        .unwrap_or_else(|| PathBuf::from("."))
}

fn build_compress_output_path(
    input_path: &Path,
    output_dir: Option<&str>,
    output_path: Option<&str>,
    preset: &CompressionPreset,
) -> PathBuf {
    if let Some(path) = output_path {
        let candidate = PathBuf::from(path.trim());
        if !candidate.as_os_str().is_empty() {
            if candidate.extension().is_none() {
                return candidate.with_extension("mp4");
            }
            return candidate;
        }
    }

    let base_dir = build_output_dir(input_path, output_dir);
    let stem = stem_from_path(input_path);
    base_dir.join(format!("{}-{}.mp4", stem, preset.key))
}

fn build_extract_output_path(
    input_path: &Path,
    output_dir: Option<&str>,
    output_path: Option<&str>,
    format: &str,
    timestamp_seconds: f64,
) -> PathBuf {
    if let Some(path) = output_path {
        let candidate = PathBuf::from(path.trim());
        if !candidate.as_os_str().is_empty() {
            if candidate.extension().is_none() {
                return candidate.with_extension(format);
            }
            return candidate;
        }
    }

    let base_dir = build_output_dir(input_path, output_dir);
    let stem = stem_from_path(input_path);
    let timestamp_ms = (timestamp_seconds.max(0.0) * 1000.0).round() as u64;
    base_dir.join(format!("{}-frame-{:06}.{}", stem, timestamp_ms, format))
}

fn run_ffmpeg(mut command: Command) -> Result<(), String> {
    let output = command
        .output()
        .map_err(|error| format!("Errore avvio FFmpeg: {}", error))?;
    if output.status.success() {
        return Ok(());
    }

    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let details = if stderr.is_empty() {
        stdout
    } else if stdout.is_empty() {
        stderr
    } else {
        format!("{}\n{}", stderr, stdout)
    };

    Err(if details.is_empty() {
        "FFmpeg ha restituito un errore sconosciuto.".to_string()
    } else {
        details
    })
}

#[tauri::command]
pub async fn get_ffmpeg_status() -> Result<FfmpegStatus, String> {
    Ok(probe_ffmpeg())
}

#[tauri::command]
pub async fn compress_video(request: CompressVideoRequest) -> Result<CompressVideoResult, String> {
    ensure_ffmpeg()?;

    let input_path = normalize_path(Path::new(request.input_path.trim()));
    if !input_path.exists() {
        return Err(format!("Video non trovato: {}", input_path.display()));
    }

    let preset = preset_from_name(request.preset.as_deref());
    let output_path = build_compress_output_path(
        &input_path,
        request.output_dir.as_deref(),
        request.output_path.as_deref(),
        &preset,
    );
    if let Some(parent) = output_path.parent() {
        fs::create_dir_all(parent).map_err(|error| {
            format!(
                "Errore creazione cartella output {}: {}",
                parent.display(),
                error
            )
        })?;
    }
    if output_path.exists() && !request.overwrite.unwrap_or(true) {
        return Err(format!(
            "Il file di output esiste gia': {}",
            output_path.display()
        ));
    }

    let input_size = fs::metadata(&input_path)
        .map_err(|error| format!("Errore metadati input {}: {}", input_path.display(), error))?
        .len();
    let started = Instant::now();

    let mut command = Command::new("ffmpeg");
    command
        .arg("-y")
        .arg("-hide_banner")
        .arg("-loglevel")
        .arg("error")
        .arg("-i")
        .arg(&input_path)
        .arg("-map")
        .arg("0:v:0")
        .arg("-map")
        .arg("0:a?")
        .arg("-c:v")
        .arg("libx264")
        .arg("-preset")
        .arg(preset.ffmpeg_preset)
        .arg("-crf")
        .arg(preset.crf.to_string())
        .arg("-pix_fmt")
        .arg("yuv420p")
        .arg("-movflags")
        .arg("+faststart")
        .arg("-c:a")
        .arg("aac")
        .arg("-b:a")
        .arg(preset.audio_bitrate)
        .arg(&output_path);

    run_ffmpeg(command)?;

    let output_size = fs::metadata(&output_path)
        .map_err(|error| {
            format!(
                "Errore metadati output {}: {}",
                output_path.display(),
                error
            )
        })?
        .len();
    let saved_bytes = input_size as i64 - output_size as i64;
    let savings_percent = if input_size > 0 {
        ((1.0 - (output_size as f64 / input_size as f64)) * 100.0).max(0.0)
    } else {
        0.0
    };

    Ok(CompressVideoResult {
        input_path: input_path.to_string_lossy().to_string(),
        output_path: output_path.to_string_lossy().to_string(),
        preset: preset.key.to_string(),
        preset_label: preset.label.to_string(),
        crf: preset.crf,
        ffmpeg_preset: preset.ffmpeg_preset.to_string(),
        input_size,
        output_size,
        saved_bytes,
        savings_percent,
        duration_ms: started.elapsed().as_millis(),
    })
}

#[tauri::command]
pub async fn extract_frame(request: ExtractFrameRequest) -> Result<ExtractFrameResult, String> {
    ensure_ffmpeg()?;

    let input_path = normalize_path(Path::new(request.input_path.trim()));
    if !input_path.exists() {
        return Err(format!("Video non trovato: {}", input_path.display()));
    }

    let timestamp_seconds = request.timestamp_seconds.unwrap_or(1.0).max(0.0);
    let image_format = request
        .image_format
        .as_deref()
        .map(|value| value.trim().to_lowercase())
        .unwrap_or_else(|| {
            request
                .output_path
                .as_deref()
                .and_then(|value| extension_from_path(Path::new(value)))
                .unwrap_or_else(|| "png".to_string())
        });
    let image_format = match image_format.as_str() {
        "jpg" | "jpeg" => "jpg",
        _ => "png",
    };
    let output_path = build_extract_output_path(
        &input_path,
        request.output_dir.as_deref(),
        request.output_path.as_deref(),
        image_format,
        timestamp_seconds,
    );
    if let Some(parent) = output_path.parent() {
        fs::create_dir_all(parent).map_err(|error| {
            format!(
                "Errore creazione cartella output {}: {}",
                parent.display(),
                error
            )
        })?;
    }
    if output_path.exists() && !request.overwrite.unwrap_or(true) {
        return Err(format!(
            "Il file di output esiste gia': {}",
            output_path.display()
        ));
    }

    let started = Instant::now();
    let mut command = Command::new("ffmpeg");
    command
        .arg("-y")
        .arg("-hide_banner")
        .arg("-loglevel")
        .arg("error")
        .arg("-ss")
        .arg(format!("{:.3}", timestamp_seconds))
        .arg("-i")
        .arg(&input_path)
        .arg("-frames:v")
        .arg("1");

    if image_format == "jpg" {
        command.arg("-q:v").arg("2");
    }

    command.arg(&output_path);
    run_ffmpeg(command)?;

    let bytes = fs::metadata(&output_path)
        .map_err(|error| {
            format!(
                "Errore metadati output {}: {}",
                output_path.display(),
                error
            )
        })?
        .len();

    Ok(ExtractFrameResult {
        input_path: input_path.to_string_lossy().to_string(),
        output_path: output_path.to_string_lossy().to_string(),
        timestamp_seconds,
        image_format: image_format.to_string(),
        bytes,
        duration_ms: started.elapsed().as_millis(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn presets_include_expected_quality_profiles() {
        let draft = preset_from_name(Some("draft"));
        let balanced = preset_from_name(Some("balanced"));
        let quality = preset_from_name(Some("quality"));

        assert_eq!(draft.crf, 32);
        assert_eq!(balanced.ffmpeg_preset, "medium");
        assert_eq!(quality.audio_bitrate, "160k");
    }

    #[test]
    fn output_paths_fall_back_to_source_dir_when_missing() {
        let input = Path::new("/tmp/sample/clip.mov");
        let output =
            build_compress_output_path(input, None, None, &preset_from_name(Some("balanced")));
        assert!(output.to_string_lossy().ends_with("clip-balanced.mp4"));

        let frame = build_extract_output_path(input, None, None, "png", 12.345);
        assert!(frame.to_string_lossy().ends_with("clip-frame-012345.png"));
    }

    #[test]
    fn ffmpeg_status_has_clear_message_when_missing() {
        let status = probe_ffmpeg();
        if !status.installed {
            assert!(status.message.is_some());
        }
    }
}
