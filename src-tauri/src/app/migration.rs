//! Data-format and post-update migration.
//!
//! This runs before the Go sidecar opens the database. It records the on-disk
//! data format, notices a completed installer update, and leaves a small result
//! file for the frontend to show the new changelog. Database schema migrations
//! remain owned by the sidecar's versioned `schema_version` table.

use serde::{Deserialize, Serialize};
use std::fs;
use tauri::AppHandle;

/// Current on-disk data format written to `data-version.json`.
const DATA_FORMAT: u32 = 1;
/// Records the format and app version that last touched the data root.
const DATA_VERSION_FILE: &str = "data-version.json";
/// Marker written before the installer handoff.
const PENDING_UPDATE_FILE: &str = "pending-update.json";
/// Result consumed by the frontend after a successful update.
const UPDATE_RESULT_FILE: &str = "update-result.json";

/// Persisted data-format record.
#[derive(Debug, Serialize, Deserialize)]
struct DataVersion {
    format: u32,
    app_version: String,
    updated_at: u64,
}

/// Update target recorded before the installer runs.
#[derive(Debug, Serialize, Deserialize)]
struct PendingUpdate {
    from_version: String,
    to_version: String,
    backup: String,
}

/// Mirrors `update-result.json`; the stored snake_case fields are also the shape
/// the frontend reads, so this one response does not use camelCase renaming.
#[derive(Debug, Serialize, Deserialize)]
pub struct UpdateApplied {
    pub from_version: String,
    pub to_version: String,
    pub backup: String,
}

/// Apply pending migrations and convert a completed installer update into a
/// frontend-visible result. Missing files are the normal first-run case.
pub fn run(app: &AppHandle) {
    let Ok(root) = crate::storage::data_dir(app) else {
        return;
    };
    let current_version = app.package_info().version.to_string();
    let version_path = root.join(DATA_VERSION_FILE);
    let format = crate::storage::read_json::<DataVersion>(&version_path)
        .map(|value| value.format)
        .unwrap_or(0);
    if format > DATA_FORMAT {
        eprintln!(
            "Data format {format} is newer than this build's format {DATA_FORMAT}; leaving it untouched."
        );
    } else if format < DATA_FORMAT {
        // Format steps run in ascending order; each one rewrites the version file.
        let _ = crate::storage::write_json(
            &version_path,
            &DataVersion {
                format: DATA_FORMAT,
                app_version: current_version.clone(),
                updated_at: crate::storage::now_ms(),
            },
        );
    }

    let pending_path = root.join(PENDING_UPDATE_FILE);
    let Some(pending) = crate::storage::read_json::<PendingUpdate>(&pending_path) else {
        return;
    };
    if pending.to_version != current_version {
        // Keep the marker until the launched build reports the target version.
        return;
    }
    let applied = UpdateApplied {
        from_version: pending.from_version,
        to_version: pending.to_version,
        backup: pending.backup,
    };
    if crate::storage::write_json(&root.join(UPDATE_RESULT_FILE), &applied).is_ok() {
        let _ = fs::remove_file(&pending_path);
    }
}

/// Record the target of an update immediately before the installer is launched.
pub fn write_pending_update(
    app: &AppHandle,
    from_version: &str,
    to_version: &str,
    backup: &str,
) -> Result<(), String> {
    let root = crate::storage::data_dir(app)?;
    crate::storage::write_json(
        &root.join(PENDING_UPDATE_FILE),
        &PendingUpdate {
            from_version: from_version.to_owned(),
            to_version: to_version.to_owned(),
            backup: backup.to_owned(),
        },
    )
}

/// Remove only the pending marker belonging to an unsuccessful handoff.
pub fn clear_pending_update(app: &AppHandle, version: &str) {
    let Ok(root) = crate::storage::data_dir(app) else {
        return;
    };
    let path = root.join(PENDING_UPDATE_FILE);
    if crate::storage::read_json::<PendingUpdate>(&path)
        .is_some_and(|pending| pending.to_version == version)
    {
        let _ = fs::remove_file(path);
    }
}

/// Read and clear the completed-update marker.
pub fn take_update_result(app: &AppHandle) -> Option<UpdateApplied> {
    let path = crate::storage::data_dir(app).ok()?.join(UPDATE_RESULT_FILE);
    let result = crate::storage::read_json::<UpdateApplied>(&path)?;
    let _ = fs::remove_file(path);
    Some(result)
}
