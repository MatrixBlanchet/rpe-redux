/**
 * The preview's fixed logical stage size and the derived note and line scales
 * used to map Recorder-authored values into that box. Hit-frame timing is
 * re-exported here so preview drawing code reads a single module.
 */

export {
  HIT_DURATION,
  HIT_FRAME_COUNT,
  HIT_FRAME_SECONDS,
  hitFrame,
} from "../../../canvas/hitFrame.ts";

/** The logical chart box used by preview rendering and overlay placement. */
export const PREVIEW_LOGICAL_SIZE = { width: 1350, height: 900 } as const;

/**
 * Converts a Recorder note-size setting into the 1350×900 chart box.
 *
 * This applies the same `note_size * 0.89 * width / 1200` factor Recorder uses
 * for width-scaled notes (`notesize_rely = 0`).
 */
export function previewNoteWidth(noteSize: number): number {
  return noteSize * 0.89 * (PREVIEW_LOGICAL_SIZE.width / 1200);
}

/** Authoring width of a judge line, in stage pixels. */
export const DEFAULT_LINE_WIDTH = 4000;
/**
 * Authoring height of a judge line at `line_size = 1`.
 *
 * Recorder's height-scaled line thickness is `line_size * 2 * height / 405`;
 * at the canonical 900-unit height that is 4.444… stage units.
 */
export const DEFAULT_LINE_HEIGHT = (2 * PREVIEW_LOGICAL_SIZE.height) / 405;
