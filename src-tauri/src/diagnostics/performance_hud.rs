//! Floating performance HUD window: creates the always-on-top webview and
//! reports its edge snapping state back to the frontend.

use serde::Serialize;
use tauri::{AppHandle, Manager, PhysicalPosition, Position, WebviewUrl, WebviewWindowBuilder};

/// Window label of the companion HUD webview.
pub const PERFORMANCE_HUD_WINDOW_LABEL: &str = "performance-hud";
/// Distance in physical pixels at which the HUD reports an edge snap.
const SNAP_DISTANCE: i32 = 28;

/// Main-window edges the HUD is currently aligned with.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PerformanceHudSnapEdges {
    pub top: bool,
    pub right: bool,
    pub bottom: bool,
    pub left: bool,
}

/// Placement feedback returned to the HUD renderer.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PerformanceHudWindowState {
    /// True while the HUD center is inside the main window rectangle.
    pub should_redock: bool,
    pub snap_edges: PerformanceHudSnapEdges,
}

/// Neutral placement used when either window is unavailable.
fn empty_window_state() -> PerformanceHudWindowState {
    PerformanceHudWindowState {
        should_redock: false,
        snap_edges: PerformanceHudSnapEdges {
            top: false,
            right: false,
            bottom: false,
            left: false,
        },
    }
}

/// Compare the HUD rectangle with the main window in physical pixels.
///
/// `should_redock` is true when the HUD center lies inside the main window;
/// each snap edge is true when the rectangles overlap on the other axis and the
/// gap is within [`SNAP_DISTANCE`].
fn window_state_for_geometry(
    main_position: (i32, i32),
    main_size: (i32, i32),
    hud_position: (i32, i32),
    hud_size: (i32, i32),
) -> PerformanceHudWindowState {
    let main_right = main_position.0 + main_size.0;
    let main_bottom = main_position.1 + main_size.1;
    let hud_right = hud_position.0 + hud_size.0;
    let hud_bottom = hud_position.1 + hud_size.1;
    let hud_center = (
        hud_position.0 + hud_size.0 / 2,
        hud_position.1 + hud_size.1 / 2,
    );
    let horizontal_overlap = hud_position.0 < main_right && hud_right > main_position.0;
    let vertical_overlap = hud_position.1 < main_bottom && hud_bottom > main_position.1;
    let within_snap_distance = |distance: i32| (0..=SNAP_DISTANCE).contains(&distance);

    PerformanceHudWindowState {
        should_redock: hud_center.0 >= main_position.0
            && hud_center.0 <= main_right
            && hud_center.1 >= main_position.1
            && hud_center.1 <= main_bottom,
        snap_edges: PerformanceHudSnapEdges {
            top: horizontal_overlap && within_snap_distance(main_position.1 - hud_bottom),
            right: vertical_overlap && within_snap_distance(hud_position.0 - main_right),
            bottom: horizontal_overlap && within_snap_distance(hud_position.1 - main_bottom),
            left: vertical_overlap && within_snap_distance(main_position.0 - hud_right),
        },
    }
}

/// Show the HUD at `(x, y)`, creating the companion window on first use.
#[tauri::command]
pub fn open_performance_hud_window(app: AppHandle, x: i32, y: i32) -> Result<(), String> {
    if let Some(window) = app.get_webview_window(PERFORMANCE_HUD_WINDOW_LABEL) {
        window
            .set_position(Position::Physical(PhysicalPosition::new(x, y)))
            .map_err(|error| error.to_string())?;
        window.show().map_err(|error| error.to_string())?;
        window.set_focus().map_err(|error| error.to_string())?;
        return Ok(());
    }

    std::thread::spawn(move || {
        let result = (|| -> Result<(), String> {
            let data_directory = crate::storage::webview_data_dir()?.join("performance-hud");
            let window = WebviewWindowBuilder::new(
                &app,
                PERFORMANCE_HUD_WINDOW_LABEL,
                WebviewUrl::App("index.html?window=performance-hud".into()),
            )
            .title("RPE Redux Performance")
            .inner_size(300.0, 430.0)
            .min_inner_size(260.0, 320.0)
            .decorations(false)
            .resizable(true)
            .always_on_top(true)
            .skip_taskbar(true)
            .data_directory(data_directory)
            .build()
            .map_err(|error| error.to_string())?;
            window
                .set_position(Position::Physical(PhysicalPosition::new(x, y)))
                .map_err(|error| error.to_string())?;
            window.show().map_err(|error| error.to_string())?;
            window.set_focus().map_err(|error| error.to_string())?;
            Ok(())
        })();
        if let Err(error) = result {
            eprintln!("Unable to open the performance HUD companion window: {error}");
        }
    });
    Ok(())
}

/// Close the HUD window when it exists.
#[tauri::command]
pub fn close_performance_hud_window(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window(PERFORMANCE_HUD_WINDOW_LABEL) {
        window.close().map_err(|error| error.to_string())?;
    }
    Ok(())
}

/// Placement feedback for a HUD dragged to `(x, y)`.
///
/// Returns neutral flags when the main or HUD window is not open.
#[tauri::command]
pub fn performance_hud_window_state(
    app: AppHandle,
    x: i32,
    y: i32,
) -> Result<PerformanceHudWindowState, String> {
    let Some(main) = app.get_webview_window("main") else {
        return Ok(empty_window_state());
    };
    let Some(hud) = app.get_webview_window(PERFORMANCE_HUD_WINDOW_LABEL) else {
        return Ok(empty_window_state());
    };
    let main_position = main.outer_position().map_err(|error| error.to_string())?;
    let main_size = main.outer_size().map_err(|error| error.to_string())?;
    let hud_size = hud.outer_size().map_err(|error| error.to_string())?;
    Ok(window_state_for_geometry(
        (main_position.x, main_position.y),
        (main_size.width as i32, main_size.height as i32),
        (x, y),
        (hud_size.width as i32, hud_size.height as i32),
    ))
}

/// Close the HUD during application shutdown, ignoring a missing window.
pub fn close_companion(app: &AppHandle) {
    if let Some(window) = app.get_webview_window(PERFORMANCE_HUD_WINDOW_LABEL) {
        let _ = window.close();
    }
}

#[cfg(test)]
mod tests {
    use super::window_state_for_geometry;

    const MAIN_POSITION: (i32, i32) = (100, 100);
    const MAIN_SIZE: (i32, i32) = (400, 300);
    const HUD_SIZE: (i32, i32) = (200, 100);

    #[test]
    fn highlights_each_edge_at_the_same_distance() {
        let top = window_state_for_geometry(MAIN_POSITION, MAIN_SIZE, (200, -28), HUD_SIZE);
        let right = window_state_for_geometry(MAIN_POSITION, MAIN_SIZE, (528, 200), HUD_SIZE);
        let bottom = window_state_for_geometry(MAIN_POSITION, MAIN_SIZE, (200, 428), HUD_SIZE);
        let left = window_state_for_geometry(MAIN_POSITION, MAIN_SIZE, (-128, 200), HUD_SIZE);

        assert!(top.snap_edges.top);
        assert!(right.snap_edges.right);
        assert!(bottom.snap_edges.bottom);
        assert!(left.snap_edges.left);
    }

    #[test]
    fn clears_an_edge_after_separation() {
        let state = window_state_for_geometry(MAIN_POSITION, MAIN_SIZE, (200, -29), HUD_SIZE);

        assert!(!state.snap_edges.top);
    }
}
