//! Deployment package roots discovered from the source tree, bundled resources,
//! and the writable user root.
//!
//! Each child module owns one package kind: note skins, theme/icon packages, and
//! Extension packages with their install, removal, and watchdog rules.

pub(crate) mod extensions;
pub(crate) mod skins;
pub(crate) mod themes;
