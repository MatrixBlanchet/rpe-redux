//! Chart-library import: scans an RPE library folder, inspects its projects, and
//! packs one project into a `.pez` document.

use super::{
    error, normalize_resource_name, path_within, read_file_limited, remap_chart, resolve_reference,
    resource_names, zip_name, Result, MAX_CHART_BYTES, MAX_RESOURCE_BYTES,
    MAX_RESOURCE_TOTAL_BYTES,
};
use serde_json::Value;
use std::{
    collections::HashMap,
    fs::{self, File},
    io::{Read, Write},
    path::{Path, PathBuf},
};
use tauri::{ipc::Request, State};
use zip::{write::SimpleFileOptions, ZipWriter};

/// Largest number of files copied from one library project.
const MAX_LIBRARY_FILES: usize = 50_000;
/// Largest settings sidecar read while inspecting a library.
const MAX_LIBRARY_TEXT_BYTES: u64 = 16 * 1024 * 1024;

/// Scan an RPE library root and report its projects and shared settings files.
#[tauri::command]
pub fn inspect_library(
    token: State<'_, crate::app::ipc_guard::HostToken>,
    request: Request<'_>,
    root: String,
) -> Result<Value> {
    crate::app::ipc_guard::HostToken::require(token.inner(), request.headers())?;
    let root = fs::canonicalize(root).map_err(error)?;
    let resources = root.join("Resources");
    let mut projects = Vec::new();
    for directory in fs::read_dir(resources).map_err(error)? {
        let directory = directory.map_err(error)?;
        if !directory.file_type().map_err(error)?.is_dir() {
            continue;
        }
        let folder = directory.file_name().to_string_lossy().into_owned();
        let primary = directory.path().join(format!("{folder}.json"));
        let mut candidates = if primary.exists() {
            vec![primary]
        } else {
            fs::read_dir(directory.path())
                .map_err(error)?
                .filter_map(|e| e.ok())
                .map(|e| e.path())
                .filter(|p| {
                    p.extension().and_then(|e| e.to_str()) == Some("json")
                        && !p
                            .file_name()
                            .unwrap_or_default()
                            .to_string_lossy()
                            .to_ascii_lowercase()
                            .starts_with("autosave_")
                })
                .collect()
        };
        candidates.sort();
        for path in candidates {
            if let Ok(bytes) = read_file_limited(&path, MAX_CHART_BYTES, "library_chart_too_large")
            {
                if let Ok(chart) = serde_json::from_slice::<Value>(&bytes) {
                    if chart.get("META").is_some() && chart.get("BPMList").is_some() {
                        projects.push(
                            serde_json::json!({"path":path,"name":chart["META"]["name"],"bytes":bytes.len()}),
                        );
                    }
                }
            }
        }
    }
    let sidecar = |name: &str| {
        read_file_limited(
            &root.join(name),
            MAX_LIBRARY_TEXT_BYTES,
            "library_sidecar_too_large",
        )
        .unwrap_or_default()
    };
    Ok(serde_json::json!({
        "projects": projects,
        "settings": sidecar("Settings.json"),
        "hotkeys": sidecar("Hotkey.txt"),
        "ui": sidecar("UI.txt")
    }))
}

/// Collect every project file under `directory` as archive-relative names.
///
/// Autosave files and symlinks are skipped.
fn collect_project_files(
    root: &Path,
    directory: &Path,
    files: &mut Vec<(String, PathBuf)>,
) -> Result<()> {
    for entry in fs::read_dir(directory).map_err(error)? {
        let entry = entry.map_err(error)?;
        let kind = entry.file_type().map_err(error)?;
        if kind.is_symlink() {
            continue;
        }
        let path = entry.path();
        if kind.is_dir() {
            collect_project_files(root, &path, files)?;
        } else if kind.is_file() {
            let name = path
                .strip_prefix(root)
                .map_err(error)?
                .to_string_lossy()
                .replace('\\', "/");
            if !entry
                .file_name()
                .to_string_lossy()
                .to_ascii_lowercase()
                .starts_with("autosave_")
            {
                zip_name(&name)?;
                if files.len() >= MAX_LIBRARY_FILES {
                    return Err("library_file_count_limit".into());
                }
                if entry.metadata().map_err(error)?.len() > MAX_RESOURCE_BYTES {
                    return Err("library_file_too_large".into());
                }
                files.push((name, path));
            }
        }
    }
    Ok(())
}

/// Pack one library project and its resources into a `.pez` at `target`.
///
/// Chart references are normalized to project-relative names before they are
/// resolved. A reference outside the project folder is rejected rather than
/// copied into the archive.
fn package_library_project(source: &Path, target: &Path) -> Result<()> {
    let source = fs::canonicalize(source).map_err(error)?;
    let root = source.parent().ok_or("Invalid chart location")?;
    let chart_bytes = read_file_limited(&source, MAX_CHART_BYTES, "library_chart_too_large")?;
    let mut chart: Value = serde_json::from_slice(&chart_bytes).map_err(error)?;
    if chart.get("META").is_none() || chart.get("BPMList").is_none() {
        return Err("Not an RPE chart.".into());
    }
    if target.exists() {
        return Err("The target file already exists. Choose a different name or directory.".into());
    }
    let mut files = Vec::new();
    collect_project_files(root, root, &mut files)?;
    let mut remap = HashMap::new();
    for name in resource_names(&chart) {
        let normalized =
            normalize_resource_name(&name).map_err(|_| "unsafe_save_asset_path".to_string())?;
        let reference = resolve_reference(root, &normalized)
            .map_err(|_| "unsafe_save_asset_path".to_string())?;
        if !path_within(root, &reference.path) {
            return Err("unsafe_save_asset_path".into());
        }
        if normalized != name {
            remap.insert(name, normalized);
        }
    }
    remap_chart(&mut chart, &remap);
    let chart_name = source.file_name().unwrap().to_string_lossy().into_owned();
    let mut temp = tempfile::NamedTempFile::new_in(target.parent().unwrap_or(Path::new(".")))
        .map_err(error)?;
    let mut zip = ZipWriter::new(temp.as_file_mut());
    let options = SimpleFileOptions::default().compression_method(zip::CompressionMethod::Deflated);
    let mut written = 0u64;
    for (name, path) in files {
        if name == chart_name {
            continue;
        }
        let length = fs::metadata(&path).map_err(error)?.len();
        if length > MAX_RESOURCE_BYTES {
            return Err("library_file_too_large".into());
        }
        written = written
            .checked_add(length)
            .filter(|total| *total <= MAX_RESOURCE_TOTAL_BYTES)
            .ok_or("library_total_too_large")?;
        zip.start_file(name, options).map_err(error)?;
        let copied = std::io::copy(
            &mut File::open(path)
                .map_err(error)?
                .take(length.saturating_add(1)),
            &mut zip,
        )
        .map_err(error)?;
        if copied != length {
            return Err("library_file_size_changed".into());
        }
    }
    let chart_json = serde_json::to_vec(&chart).map_err(error)?;
    written
        .checked_add(chart_json.len() as u64)
        .filter(|total| *total <= MAX_RESOURCE_TOTAL_BYTES)
        .ok_or("library_total_too_large")?;
    // The chart entry is taken from the source file name; recheck it so a
    // package written here always reopens under the shared archive policy.
    super::save::save_zip_name(&chart_name)?;
    zip.start_file(chart_name, options).map_err(error)?;
    zip.write_all(&chart_json).map_err(error)?;
    zip.finish().map_err(error)?;
    temp.as_file().sync_all().map_err(error)?;
    temp.persist(target).map_err(error)?;
    Ok(())
}

/// Pack one library project into `target` and return that path.
#[tauri::command]
pub async fn import_library_project(
    token: State<'_, crate::app::ipc_guard::HostToken>,
    request: Request<'_>,
    path: String,
    target: String,
) -> Result<String> {
    crate::app::ipc_guard::HostToken::require(token.inner(), request.headers())?;
    let output = PathBuf::from(&target);
    tauri::async_runtime::spawn_blocking(move || {
        package_library_project(Path::new(&path), &output)
    })
    .await
    .map_err(error)??;

    Ok(target)
}
