/** Tracks window focus and the user's background-volume preference for audio owners. */
import { values } from "../../core/state/values.ts";
import { clamp01 } from "../../core/utils/numbers.ts";

/** Sends the current foreground/background multiplier and returns its disposer. */
export function bindBackgroundVolume(apply: (multiplier: number) => void): () => void {
  const currentDocument = document;
  const currentWindow = window;
  let focused = currentDocument.hasFocus();
  const update = () => {
    const value = Number(
      values.byId.has("background-volume") ? values.byId.get<unknown>("background-volume") : 0.4,
    );
    apply(currentDocument.hidden || !focused ? (Number.isFinite(value) ? clamp01(value) : 0.4) : 1);
  };
  const focus = () => {
    focused = true;
    update();
  };
  const blur = () => {
    focused = false;
    update();
  };
  const visibility = () => {
    // Webviews can dispatch `visibilitychange` before the native focus state
    // catches up. Treat a visible document as foreground immediately, then
    // re-check on the next turn so returning from another window always ramps
    // back to full volume.
    focused = !currentDocument.hidden;
    update();
    queueMicrotask(() => {
      focused = currentDocument.hasFocus() || !currentDocument.hidden;
      update();
    });
  };
  currentWindow.addEventListener("focus", focus);
  currentWindow.addEventListener("blur", blur);
  currentDocument.addEventListener("visibilitychange", visibility);
  const unsubscribe = values.byId.has("background-volume")
    ? values.byId.subscribe("background-volume", update)
    : () => {};
  update();
  return () => {
    unsubscribe();
    currentWindow.removeEventListener("focus", focus);
    currentWindow.removeEventListener("blur", blur);
    currentDocument.removeEventListener("visibilitychange", visibility);
  };
}
