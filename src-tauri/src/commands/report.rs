use serde::Deserialize;
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug, Deserialize)]
pub struct ExportReportRequest {
    pub destination_path: String,
    pub summary: ConversionReportSummary,
}

#[derive(Debug, Deserialize)]
pub struct ConversionReportSummary {
    pub total_files: usize,
    pub total_operations: usize,
    pub successful: usize,
    pub failed: usize,
    pub total_input_size: u64,
    pub total_output_size: u64,
    pub results: Vec<ConversionReportRow>,
}

#[derive(Debug, Deserialize)]
pub struct ConversionReportRow {
    pub filename: String,
    pub source_path: String,
    pub success: bool,
    pub input_size: u64,
    pub output_size: u64,
    pub output_path: String,
    pub error: Option<String>,
}

fn escape_csv_field(value: &str) -> String {
    if value.contains([',', '"', '\n', '\r']) {
        format!("\"{}\"", value.replace('"', "\"\""))
    } else {
        value.to_string()
    }
}

fn size_delta_bytes(row: &ConversionReportRow) -> String {
    if !row.success {
        return String::new();
    }

    let delta = i128::from(row.output_size) - i128::from(row.input_size);
    delta.to_string()
}

fn size_delta_percent(row: &ConversionReportRow) -> String {
    if !row.success || row.input_size == 0 {
        return String::new();
    }

    let delta = row.output_size as f64 - row.input_size as f64;
    format!("{:.2}", (delta / row.input_size as f64) * 100.0)
}

fn build_results_csv(summary: &ConversionReportSummary) -> String {
    let mut csv = String::from(
        "filename,source_path,success,input_size_bytes,output_size_bytes,size_delta_bytes,size_delta_percent,output_path,error\n",
    );

    for row in &summary.results {
        let columns = [
            escape_csv_field(&row.filename),
            escape_csv_field(&row.source_path),
            row.success.to_string(),
            row.input_size.to_string(),
            row.output_size.to_string(),
            size_delta_bytes(row),
            size_delta_percent(row),
            escape_csv_field(&row.output_path),
            escape_csv_field(row.error.as_deref().unwrap_or("")),
        ];

        csv.push_str(&columns.join(","));
        csv.push('\n');
    }

    csv.push('\n');
    csv.push_str("summary_key,summary_value\n");
    csv.push_str(&format!("total_files,{}\n", summary.total_files));
    csv.push_str(&format!("total_operations,{}\n", summary.total_operations));
    csv.push_str(&format!("successful,{}\n", summary.successful));
    csv.push_str(&format!("failed,{}\n", summary.failed));
    csv.push_str(&format!("total_input_size_bytes,{}\n", summary.total_input_size));
    csv.push_str(&format!(
        "total_output_size_bytes,{}\n",
        summary.total_output_size
    ));

    csv
}

fn ensure_parent_dir(path: &Path) -> Result<(), String> {
    let Some(parent) = path.parent() else {
        return Ok(());
    };

    if parent.as_os_str().is_empty() {
        return Ok(());
    }

    fs::create_dir_all(parent)
        .map_err(|e| format!("Errore creazione cartella report {}: {}", parent.display(), e))
}

#[tauri::command]
pub async fn export_conversion_report(request: ExportReportRequest) -> Result<String, String> {
    let trimmed = request.destination_path.trim();
    if trimmed.is_empty() {
        return Err("Percorso report mancante".to_string());
    }

    let destination = PathBuf::from(trimmed);
    ensure_parent_dir(&destination)?;

    let csv = build_results_csv(&request.summary);
    fs::write(&destination, csv)
        .map_err(|e| format!("Errore scrittura report CSV {}: {}", destination.display(), e))?;

    Ok(destination.to_string_lossy().to_string())
}
