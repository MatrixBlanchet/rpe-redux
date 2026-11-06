//! Native file input/output outside the document host.
//!
//! `external` scans one external chart folder for the official/PEC importer, and
//! `recording` streams audio and frames into the bundled encoder.

pub(crate) mod external;
pub(crate) mod recording;
