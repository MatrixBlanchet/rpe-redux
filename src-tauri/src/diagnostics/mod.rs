//! Developer-facing native surfaces.
//!
//! `developer` exposes the debug-only DevTools and host-platform commands, and
//! `performance_hud` owns the separate always-on-top HUD window.

pub(crate) mod developer;
pub(crate) mod performance_hud;
