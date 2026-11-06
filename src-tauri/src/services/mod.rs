//! Long-running local services and collaboration transports.
//!
//! `server` supervises the Go/SQLite sidecar, `lan` and `tunnel` expose the room
//! server beyond loopback, and `session` holds the one-room-per-data-directory
//! claim.

pub(crate) mod lan;
pub(crate) mod server;
pub(crate) mod session;
pub(crate) mod tunnel;
