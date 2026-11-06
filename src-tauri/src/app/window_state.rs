//! Restores and persists the main window's size, position, and maximized state.
//!
//! The window manager owns the platform behavior; this module only remembers the
//! last user-chosen geometry so a restart does not reset a 16:9 working window or
//! move it back to the primary monitor.

use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager, PhysicalPosition, PhysicalSize, WebviewWindow};

const STATE_FILE: &str = "window-state.json";
const MIN_WIDTH: u32 = 1000;
const MIN_HEIGHT: u32 = 680;

/// Persisted window geometry. Older files may still carry a removed `enabled`
/// field; serde ignores it and geometry restoration is always on.
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
struct WindowState {
    width: u32,
    height: u32,
    x: i32,
    y: i32,
    maximized: bool,
}

/// Durable state file under the application data root.
fn state_path(app: &AppHandle) -> Option<PathBuf> {
    crate::storage::data_dir(app)
        .ok()
        .map(|dir| dir.join(STATE_FILE))
}

/// Previous platform data directory, read only when the durable file is absent.
fn legacy_state_path(app: &AppHandle) -> Option<PathBuf> {
    app.path()
        .app_data_dir()
        .ok()
        .map(|dir| dir.join(STATE_FILE))
}

/// Read the durable state file, falling back to the previous location.
fn read_any_state(app: &AppHandle) -> Option<WindowState> {
    let path = state_path(app)?;
    read_state(&path).or_else(|| legacy_state_path(app).and_then(|legacy| read_state(&legacy)))
}

/// Reject implausible geometry.
fn valid_state(state: WindowState) -> Option<WindowState> {
    if state.width < MIN_WIDTH
        || state.height < MIN_HEIGHT
        || state.width > 10_000
        || state.height > 10_000
    {
        return None;
    }
    Some(state)
}

#[cfg(test)]
/// Parse state bytes through the same validation as the startup path.
fn parse_state(bytes: &[u8]) -> Option<WindowState> {
    valid_state(serde_json::from_slice(bytes).ok()?)
}

/// Read and validate one state file.
fn read_state(path: &Path) -> Option<WindowState> {
    valid_state(crate::storage::read_json(path)?)
}

/// Write one state file, creating the data directory when needed.
fn write_state(path: &Path, state: WindowState) -> Result<(), String> {
    crate::storage::write_json(path, &state)
}

/// Current outer size, position, and maximized flag, with the minimum size applied.
fn current_geometry(window: &WebviewWindow) -> Result<(u32, u32, i32, i32, bool), String> {
    let size = window.outer_size().map_err(|error| error.to_string())?;
    let position = window.outer_position().map_err(|error| error.to_string())?;
    Ok((
        size.width.max(MIN_WIDTH),
        size.height.max(MIN_HEIGHT),
        position.x,
        position.y,
        window.is_maximized().unwrap_or(false),
    ))
}

/// Whether the stored rectangle overlaps at least one connected monitor.
fn visible_on_monitor(window: &WebviewWindow, state: WindowState) -> bool {
    let Ok(monitors) = window.available_monitors() else {
        return false;
    };
    monitors.iter().any(|monitor| {
        let origin = monitor.position();
        let size = monitor.size();
        let right = state.x.saturating_add(state.width as i32);
        let bottom = state.y.saturating_add(state.height as i32);
        right > origin.x
            && state.x < origin.x.saturating_add(size.width as i32)
            && bottom > origin.y
            && state.y < origin.y.saturating_add(size.height as i32)
    })
}

/// Apply the stored size, position, and maximized state.
///
/// The position is applied only when the stored rectangle is still visible on a
/// connected monitor.
pub fn restore(window: &WebviewWindow) {
    let app = window.app_handle().clone();
    let Some(state) = read_any_state(&app) else {
        return;
    };
    let _ = window.set_size(PhysicalSize::new(state.width, state.height));
    if visible_on_monitor(window, state) {
        let _ = window.set_position(PhysicalPosition::new(state.x, state.y));
    }
    if state.maximized {
        let _ = window.maximize();
    }
}

/// Persist the current geometry unless the window is minimized.
pub fn save(app: &AppHandle, window: &WebviewWindow) {
    if window.is_minimized().unwrap_or(false) {
        return;
    }
    let Some(path) = state_path(app) else {
        return;
    };
    let Ok((width, height, x, y, maximized)) = current_geometry(window) else {
        return;
    };
    let _ = write_state(
        &path,
        WindowState {
            width,
            height,
            x,
            y,
            maximized,
        },
    );
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn legacy_state_ignores_the_removed_enabled_field() {
        let state = parse_state(
            br#"{"width":1440,"height":810,"x":20,"y":30,"maximized":false,"enabled":false}"#,
        )
        .expect("legacy state");
        assert_eq!(state.width, 1440);
        assert_eq!(state.height, 810);
    }

    #[test]
    fn removed_enabled_field_does_not_bypass_geometry_validation() {
        assert!(parse_state(
            br#"{"width":500,"height":400,"x":0,"y":0,"maximized":false,"enabled":false}"#,
        )
        .is_none());
    }

    #[test]
    fn too_small_geometry_is_rejected() {
        assert!(
            parse_state(br#"{"width":500,"height":400,"x":0,"y":0,"maximized":false}"#,).is_none()
        );
    }
}
