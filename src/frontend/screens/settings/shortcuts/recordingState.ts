/**
 * Whether the shortcut editor is capturing the next input.
 *
 * Global shortcut owners read this before dispatching so the recorder can bind
 * the same keys a normal surface would handle.
 */
import { createValue } from "../../../../core/state/values.ts";

const recording = createValue<boolean>({ initial: false });

/** Whether the shortcut editor currently captures input. */
export const isShortcutRecording = recording.get;
/** Publish whether the shortcut editor captures input. */
export const setShortcutRecording = recording.set;
