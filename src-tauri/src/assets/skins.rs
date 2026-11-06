//! Discovers and reads note-skin folders from the deployment and resource roots.
//!
//! A skin is data, not code: the host returns the manifest and relative file
//! bytes, and the frontend's note-skin parser validates and decodes the package.
//! The scanner never follows symlinks and stays inside the selected package root.

use base64::Engine;
use serde::Serialize;
use serde_json::Value;
use std::{
    collections::{hash_map::DefaultHasher, BTreeMap},
    fs,
    hash::{Hash, Hasher},
    path::{Path, PathBuf},
    time::UNIX_EPOCH,
};
use tauri::{AppHandle, Manager};

type Result<T> = std::result::Result<T, String>;

/// Largest accepted manifest file, in bytes.
const MAX_MANIFEST_BYTES: u64 = 64 * 1024;
/// File count cap for one skin package.
const MAX_FILES: usize = 257;
/// Total uncompressed size cap for one skin package, in bytes.
const MAX_TOTAL_BYTES: u64 = 64 * 1024 * 1024;

/// One note-skin package as the picker sees it.
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NoteSkinSummary {
    /// Package folder name, unique across the scanned roots.
    pub id: String,
    /// Manifest `name`, either an i18n object or a plain string.
    pub name: Value,
    /// Root the package was found in: `portable` or `resource`.
    pub source: String,
    /// Content signature so the picker and preview react to files changing on disk.
    pub fingerprint: String,
}

/// A discovered package with its manifest and canonical folder.
struct SkinPackage {
    id: String,
    folder: PathBuf,
    source: &'static str,
    manifest: Value,
}

/// Scanned package roots in precedence order: user first, then resource.
fn roots(app: &AppHandle) -> Vec<(PathBuf, &'static str)> {
    let mut roots = Vec::new();
    if let Ok(user) = crate::storage::user_root() {
        roots.push((user.join("skins"), "portable"));
    }
    if let Ok(resource) = app.path().resource_dir() {
        roots.push((resource.join("skins"), "resource"));
    }
    roots
}

/// Package ids are folder names of ASCII letters, digits, and `._-`.
fn valid_id(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= 64
        && value
            .chars()
            .all(|character| character.is_ascii_alphanumeric() || "._-".contains(character))
}

/// Manifest load order: `manifest.json`, then `skin.json`.
fn manifest_path(folder: &Path) -> Option<PathBuf> {
    for name in ["manifest.json", "skin.json"] {
        let path = folder.join(name);
        if path.is_file() {
            return Some(path);
        }
    }
    None
}

/// Validate one package folder and read its manifest.
///
/// Returns `None` for invalid ids, symlinks, oversized manifests, or a folder
/// that resolves outside `root`.
fn read_skin(root: &Path, folder: &Path, source: &'static str) -> Option<SkinPackage> {
    let id = folder.file_name()?.to_str()?.to_owned();
    if !valid_id(&id) {
        return None;
    }
    let metadata = fs::symlink_metadata(folder).ok()?;
    if !metadata.is_dir() || metadata.file_type().is_symlink() {
        return None;
    }
    let path = manifest_path(folder)?;
    let metadata = fs::symlink_metadata(&path).ok()?;
    if !metadata.is_file()
        || metadata.file_type().is_symlink()
        || metadata.len() > MAX_MANIFEST_BYTES
    {
        return None;
    }
    let bytes = fs::read(&path).ok()?;
    let manifest: Value = serde_json::from_slice(&bytes).ok()?;
    let canonical_root = root.canonicalize().ok()?;
    let canonical_folder = folder.canonicalize().ok()?;
    if !canonical_folder.starts_with(&canonical_root) {
        return None;
    }
    Some(SkinPackage {
        id,
        folder: canonical_folder,
        source,
        manifest,
    })
}

/// Every valid package, deduplicated by id in root precedence order.
fn packages(app: &AppHandle) -> Vec<SkinPackage> {
    let mut found = BTreeMap::<String, SkinPackage>::new();
    for (root, source) in roots(app) {
        let Ok(entries) = fs::read_dir(&root) else {
            continue;
        };
        for entry in entries.flatten() {
            if let Some(package) = read_skin(&root, &entry.path(), source) {
                found.entry(package.id.clone()).or_insert(package);
            }
        }
    }
    found.into_values().collect()
}

/// Display name from the manifest, falling back to the package id.
fn skin_name(manifest: &Value, id: &str) -> Value {
    let name = manifest.get("name").cloned();
    match name {
        Some(Value::String(text)) if !text.trim().is_empty() => Value::String(text),
        Some(value @ Value::Object(_)) => value,
        _ => Value::String(id.to_owned()),
    }
}

/// A cheap signature of every regular file's path, size, and mtime.
///
/// The folder poll compares this string, so editing a manifest or replacing a
/// texture reports a change without loading the package again.
fn folder_fingerprint(root: &Path) -> String {
    let mut rows = Vec::<(String, u64, u128)>::new();
    let mut stack = vec![root.to_path_buf()];
    while let Some(directory) = stack.pop() {
        let Ok(entries) = fs::read_dir(&directory) else {
            continue;
        };
        for entry in entries.flatten() {
            let path = entry.path();
            let Ok(metadata) = fs::symlink_metadata(&path) else {
                continue;
            };
            if metadata.file_type().is_symlink() {
                continue;
            }
            if metadata.is_dir() {
                stack.push(path);
                continue;
            }
            if !metadata.is_file() {
                continue;
            }
            let relative = path
                .strip_prefix(root)
                .unwrap_or(&path)
                .to_string_lossy()
                .replace('\\', "/");
            let modified = metadata
                .modified()
                .ok()
                .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
                .map(|duration| duration.as_millis())
                .unwrap_or(0);
            rows.push((relative, metadata.len(), modified));
        }
    }
    rows.sort();
    let mut hasher = DefaultHasher::new();
    rows.hash(&mut hasher);
    format!("{:016x}", hasher.finish())
}

/// Packages dropped into `skins/` beside the executable, ready for the picker.
#[tauri::command]
pub fn list_note_skins(app: AppHandle) -> Result<Vec<NoteSkinSummary>> {
    Ok(packages(&app)
        .into_iter()
        .map(|package| NoteSkinSummary {
            name: skin_name(&package.manifest, &package.id),
            fingerprint: folder_fingerprint(&package.folder),
            id: package.id,
            source: package.source.to_owned(),
        })
        .collect())
}

/// Read one package recursively as relative paths and base64-encoded bytes.
///
/// Symlinks are skipped and the per-file and total size caps abort the read.
fn collect_files(
    root: &Path,
    directory: &Path,
    files: &mut Vec<(String, Vec<u8>)>,
    total: &mut u64,
) -> Result<()> {
    for entry in fs::read_dir(directory).map_err(|error| error.to_string())? {
        let path = entry.map_err(|error| error.to_string())?.path();
        let metadata = fs::symlink_metadata(&path).map_err(|error| error.to_string())?;
        if metadata.file_type().is_symlink() {
            continue;
        }
        if metadata.is_dir() {
            collect_files(root, &path, files, total)?;
            continue;
        }
        if !metadata.is_file() {
            continue;
        }
        if *total + metadata.len() > MAX_TOTAL_BYTES {
            return Err("Note skin is too large".into());
        }
        *total += metadata.len();
        let relative = path
            .strip_prefix(root)
            .map_err(|error| error.to_string())?
            .to_string_lossy()
            .replace('\\', "/");
        if relative
            .split('/')
            .any(|part| part.is_empty() || part == "." || part == "..")
        {
            continue;
        }
        files.push((
            relative,
            fs::read(&path).map_err(|error| error.to_string())?,
        ));
        if files.len() > MAX_FILES {
            return Err("Note skin has too many files".into());
        }
    }
    Ok(())
}

/// Reads one package as relative paths plus base64 bytes.
#[tauri::command]
pub fn read_note_skin(app: AppHandle, id: String) -> Result<Value> {
    let package = packages(&app)
        .into_iter()
        .find(|package| package.id == id)
        .ok_or_else(|| format!("Note skin was not found: {id}"))?;
    let mut files = Vec::new();
    let mut total = 0;
    collect_files(&package.folder, &package.folder, &mut files, &mut total)?;
    let encoded = files
        .into_iter()
        .map(|(name, bytes)| {
            serde_json::json!({
                "name": name,
                "data": base64::engine::general_purpose::STANDARD.encode(bytes),
            })
        })
        .collect::<Vec<_>>();
    Ok(serde_json::json!({
        "manifest": package.manifest,
        "files": encoded,
    }))
}
