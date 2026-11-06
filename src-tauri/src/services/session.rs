//! One-room-per-backend guard for multi-window or multi-process runs.
//!
//! Every process that shares the same application data directory shares the
//! same authority. Holding a named mutex for the duration of a room prevents a
//! second window from hosting or joining another room against that authority.
//! The kernel releases the claim when the owning process exits.

use std::sync::Mutex;
use tauri::{AppHandle, Manager};

#[cfg(windows)]
/// Owned Windows mutex handle; closed when the claim is released.
struct MutexHandle(windows_sys::Win32::Foundation::HANDLE);

#[cfg(windows)]
unsafe impl Send for MutexHandle {}

#[cfg(windows)]
impl Drop for MutexHandle {
    fn drop(&mut self) {
        use windows_sys::Win32::Foundation::CloseHandle;
        if !self.0.is_null() {
            unsafe {
                let _ = CloseHandle(self.0);
            }
        }
    }
}

#[cfg(not(windows))]
/// Placeholder claim used on hosts without named kernel mutexes.
struct MutexHandle;

/// Managed owner of the single cross-process room claim.
#[derive(Default)]
pub struct CollabSession {
    handle: Mutex<Option<MutexHandle>>,
}

#[cfg(windows)]
/// One machine-wide name: every instance that shares the sidecar shares one
/// room session.
fn claim_name(_app: &AppHandle) -> String {
    "Local\\rperedux-collab-session".to_string()
}

/// Claim this backend for one host/join session. Re-entrant for the same app.
#[tauri::command]
pub fn claim_collab_session(app: AppHandle) -> Result<bool, String> {
    let state = app.state::<CollabSession>();
    let mut guard = state.handle.lock().map_err(|error| error.to_string())?;
    if guard.is_some() {
        return Ok(true);
    }
    #[cfg(windows)]
    {
        use windows_sys::Win32::Foundation::{GetLastError, ERROR_ALREADY_EXISTS};
        use windows_sys::Win32::System::Threading::CreateMutexW;

        let name = claim_name(&app);
        let wide: Vec<u16> = name.encode_utf16().chain(std::iter::once(0)).collect();
        let handle = unsafe { CreateMutexW(std::ptr::null(), 0, wide.as_ptr()) };
        if handle.is_null() {
            return Err("Could not claim the collaboration session".into());
        }
        let already_exists = unsafe { GetLastError() } == ERROR_ALREADY_EXISTS;
        if already_exists {
            unsafe {
                let _ = windows_sys::Win32::Foundation::CloseHandle(handle);
            }
            return Ok(false);
        }
        *guard = Some(MutexHandle(handle));
        return Ok(true);
    }
    #[cfg(not(windows))]
    {
        *guard = Some(MutexHandle);
        Ok(true)
    }
}

/// Release the room claim when the host/guest leaves or the app shuts down.
#[tauri::command]
pub fn release_collab_session(app: AppHandle) {
    if let Some(state) = app.try_state::<CollabSession>() {
        if let Ok(mut guard) = state.handle.lock() {
            guard.take();
        }
    }
}
