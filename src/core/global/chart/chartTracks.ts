/**
 * The judge-line control-track catalog.
 *
 * RPE stores five parallel note-control curves. The order below is the field
 * order the serializer writes; each entry pairs the stored line field with the
 * point property it interpolates and the neutral value export uses when a line
 * has no authored track. Validation, diagnostics, the runtime and the export
 * projection all read this one list.
 */

/** Every control track, in RPE's stored order. */
export const CONTROL_TRACKS = Object.freeze([
  { field: "alphaControl", property: "alpha", neutral: 1 },
  { field: "posControl", property: "pos", neutral: 1 },
  { field: "sizeControl", property: "size", neutral: 1 },
  { field: "skewControl", property: "skew", neutral: 0 },
  { field: "yControl", property: "y", neutral: 1 },
] as const);

/** A stored control-track field name. */
export type ControlTrackField = (typeof CONTROL_TRACKS)[number]["field"];

/** A control track's interpolated point property. */
export type ControlTrackProperty = (typeof CONTROL_TRACKS)[number]["property"];
