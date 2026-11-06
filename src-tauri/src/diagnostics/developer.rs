//! Developer-only host capabilities.
//!
//! Release builds keep the commands registered so the frontend can report a
//! structured unavailable result, but the DevTools API is compiled out unless
//! debug assertions are enabled.

use tauri::AppHandle;
#[cfg(debug_assertions)]
use tauri::Manager;

/// Whether this host build may expose the developer menu.
#[tauri::command]
pub fn developer_mode() -> bool {
    cfg!(debug_assertions)
}

/// Host operating system identifier (`windows`, `linux`, `macos`).
///
/// The shell uses it for platform-specific chrome; the web build has no host
/// and never calls this command.
#[tauri::command]
pub fn host_platform() -> &'static str {
    std::env::consts::OS
}

/// Toggle the main WebView's native DevTools window.
#[tauri::command]
pub fn developer_toggle_devtools(app: AppHandle) -> Result<bool, String> {
    #[cfg(debug_assertions)]
    {
        let window = app
            .get_webview_window("main")
            .ok_or_else(|| "unavailable:desktop_window".to_owned())?;
        if window.is_devtools_open() {
            window.close_devtools();
            Ok(false)
        } else {
            window.open_devtools();
            Ok(true)
        }
    }

    #[cfg(not(debug_assertions))]
    {
        let _ = app;
        Err("unavailable:devtools".to_owned())
    }
}
