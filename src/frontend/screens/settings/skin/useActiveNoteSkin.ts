/**
 * Subscribes a component to the active note-skin id.
 *
 * The platform bridge announces changes as a DOM event, so the hook re-reads the
 * media layer when one arrives.
 */
import { useSyncExternalStore } from "react";
import { activeNoteSkin } from "../../../../core/media/noteSkins.ts";
import { NOTE_SKIN_EVENT } from "../../../platform/noteSkinBridge.ts";

/** Subscribe to the platform bridge's note-skin change event. */
const subscribe = (listener: () => void): (() => void) => {
  window.addEventListener(NOTE_SKIN_EVENT, listener);
  return () => window.removeEventListener(NOTE_SKIN_EVENT, listener);
};

/** The active note-skin id, repainted when the platform bridge announces a change. */
export function useActiveNoteSkin(): string {
  return useSyncExternalStore(subscribe, activeNoteSkin, activeNoteSkin);
}
