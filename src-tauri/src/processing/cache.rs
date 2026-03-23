use std::fs;
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;

fn stable_hash(input: &str) -> String {
    let mut hash: u64 = 0xcbf29ce484222325;
    for byte in input.as_bytes() {
        hash ^= u64::from(*byte);
        hash = hash.wrapping_mul(0x100000001b3);
    }
    format!("{:016x}", hash)
}

fn modified_nanos(metadata: &fs::Metadata) -> u128 {
    metadata
        .modified()
        .ok()
        .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
        .map(|duration| duration.as_nanos())
        .unwrap_or(0)
}

fn normalized_path(path: &Path) -> PathBuf {
    fs::canonicalize(path).unwrap_or_else(|_| path.to_path_buf())
}

pub fn thumbnail_cache_file(
    cache_dir: &Path,
    path: &Path,
    metadata: &fs::Metadata,
    max_size: u32,
) -> PathBuf {
    let canonical = normalized_path(path);
    let key = format!(
        "{}_{}_{}_{}",
        stable_hash(&canonical.to_string_lossy()),
        modified_nanos(metadata),
        metadata.len(),
        max_size
    );

    cache_dir.join(format!("{}.jpg", key))
}

pub fn read_thumbnail(cache_file: &Path) -> Result<Vec<u8>, String> {
    fs::read(cache_file).map_err(|e| format!("Errore lettura cache thumbnail: {}", e))
}

pub fn write_thumbnail(cache_file: &Path, bytes: &[u8]) -> Result<(), String> {
    if let Some(parent) = cache_file.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Errore creazione cache thumbnail: {}", e))?;
    }

    fs::write(cache_file, bytes)
        .map_err(|e| format!("Errore scrittura cache thumbnail: {}", e))
}
