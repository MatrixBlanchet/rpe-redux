//! Native window startup: resolves the portable webview profile, creates the
//! configured windows, and reports a startup failure to the user and the log.
use std::time::Duration;
use tauri::{AppHandle, Manager, WebviewWindowBuilder};
use tauri_plugin_dialog::DialogExt;

/// Move the WebView2 profile written under `user-data/` to `webview-data/`.
#[cfg(windows)]
fn migrate_legacy_webview_data() {
    let Ok(executable) = crate::storage::executable_directory() else {
        return;
    };
    let old = executable.join("user-data").join("EBWebView");
    let new_root = executable.join("webview-data");
    let new = new_root.join("EBWebView");
    if !old.is_dir() || new.exists() {
        return;
    }
    if std::fs::create_dir_all(&new_root).is_ok() {
        if let Err(error) = std::fs::rename(&old, &new) {
            eprintln!("Unable to migrate the legacy WebView2 profile: {error}");
        }
    }
}

/// Remove the sidecar runtime directory when it exists.
#[cfg(windows)]
fn remove_legacy_runtime_data() {
    let Ok(executable) = crate::storage::executable_directory() else {
        return;
    };
    let legacy = executable.join("user-data").join("runtime");
    if legacy.is_dir() {
        if let Err(error) = std::fs::remove_dir_all(&legacy) {
            eprintln!("Unable to remove the legacy sidecar runtime directory: {error}");
        }
    }
}

/// Point WebView2 at the deployment profile unless a launch option already
/// selected one. WebKitGTK takes the same directory through the window builder,
/// so no environment variable is needed there.
pub fn configure_user_data() {
    if std::env::var_os("REDUX_PROFILE_DIR").is_some() {
        return;
    }
    #[cfg(windows)]
    {
        migrate_legacy_webview_data();
        remove_legacy_runtime_data();
        if let Ok(directory) = crate::storage::webview_data_dir() {
            std::env::set_var("WEBVIEW2_USER_DATA_FOLDER", directory);
        }
    }
}

/// Whether a WebView2 failure is transient profile contention (`ERROR_BUSY`).
fn busy(error: &str) -> bool {
    // Only ERROR_BUSY is retryable; access, runtime, and configuration errors
    // fail the launch and leave the user's browser profile untouched.
    error.to_ascii_lowercase().contains("0x800700aa")
}

/// Disable WebView2 autofill and password saving; the editor is not a web form.
#[cfg(target_os = "windows")]
fn disable_browser_autofill(window: &tauri::WebviewWindow) {
    use webview2_com::Microsoft::Web::WebView2::Win32::ICoreWebView2Settings4;
    use windows_core::Interface;

    let _ = window.with_webview(|webview| {
        let Ok(core) = (unsafe { webview.controller().CoreWebView2() }) else {
            return;
        };
        let Ok(settings) = (unsafe { core.Settings() }) else {
            return;
        };
        let Ok(settings) = settings.cast::<ICoreWebView2Settings4>() else {
            return;
        };
        unsafe {
            let _ = settings.SetIsGeneralAutofillEnabled(false);
            let _ = settings.SetIsPasswordAutosaveEnabled(false);
        }
    });
}

/// No-op on hosts without WebView2 autofill settings.
#[cfg(not(target_os = "windows"))]
fn disable_browser_autofill(_window: &tauri::WebviewWindow) {}

/// Create every window declared in the app configuration.
///
/// A window build is retried up to seven times while WebView2 reports profile
/// contention; any other error aborts startup with its message.
pub fn create_windows(app: &AppHandle) -> Result<(), String> {
    let directory = crate::storage::webview_data_dir()?;
    let test_api = std::env::var_os("REDUX_TEST_API").is_some();
    let host_token = app.state::<crate::app::ipc_guard::HostToken>();
    for config in &app.config().app.windows {
        for attempt in 0..7 {
            let mut builder = WebviewWindowBuilder::from_config(app, config)
                .map_err(|error| error.to_string())?
                .data_directory(directory.clone())
                // Copy actions are explicit user gestures; the app never asks
                // for clipboard access in the background, so the WebView2
                // prompt would only interrupt the editor.
                .on_permission_request(|_, kind| match kind {
                    tauri::webview::PermissionKind::ClipboardRead => {
                        tauri::webview::PermissionResponse::Allow
                    }
                    _ => tauri::webview::PermissionResponse::Default,
                })
                // The token is scoped to the top frame; subframes (including
                // the extension sandbox) run the script but stop at the guard.
                .initialization_script(host_token.initialization_script());
            if test_api {
                builder = builder.initialization_script(
                    "Object.defineProperty(globalThis,'__REDUX_TEST_API__',{value:true,configurable:false,writable:false});",
                );
            }
            let result = builder.build();
            match result {
                Ok(window) => {
                    disable_browser_autofill(&window);
                    break;
                }
                Err(error) => {
                    let message = error.to_string();
                    if busy(&message) && attempt < 6 {
                        eprintln!(
                            "WebView2 temporarily busy; retry {}/6: {message}",
                            attempt + 1
                        );
                        std::thread::sleep(Duration::from_millis(500));
                    } else {
                        return Err(format!(
                            "Could not create the desktop window: {message}\nData directory: {}",
                            directory.display()
                        ));
                    }
                }
            }
        }
    }
    Ok(())
}

/// Record a startup failure in `logs/startup.log` and show it to the user before
/// the process exits with status 1.
pub fn report_failure(app: &AppHandle, error: &str) {
    eprintln!("{error}");
    if let Ok(directory) = crate::storage::data_dir(app) {
        let logs = directory.join("logs");
        if std::fs::create_dir_all(&logs).is_ok() {
            let _ = std::fs::write(logs.join("startup.log"), error);
        }
    }
    let handle = app.clone();
    app.dialog()
        .message(error)
        .title("RPE Redux failed to start")
        // Show asynchronously; the setup hook must not block the event loop.
        .show(move |_| handle.exit(1));
}
