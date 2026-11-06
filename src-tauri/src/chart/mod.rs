//! Chart-source adapters that need native folder access.
//!
//! `rpe` performs the bounded read of an RPE installation for the welcome-screen
//! migration; chart parsing and conversion remain in the frontend and core
//! layers.

pub(crate) mod rpe;
