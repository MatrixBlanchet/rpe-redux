//! Signed update preparation, handoff, and in-place application.
//!
//! `updater` owns the manifest/download flow and the pre-update snapshot,
//! `update_guard` detects resource changes during preparation, `local_update`
//! verifies a local installer, `local_update_worker` runs the post-exit helper,
//! and `portable_update` swaps a signed portable payload in place.

pub(crate) mod local_update;
pub(crate) mod local_update_worker;
pub(crate) mod portable_update;
pub(crate) mod update_guard;
pub(crate) mod updater;
