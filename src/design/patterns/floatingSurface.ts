/**
 * Shared activity count for floating surfaces.
 *
 * A popover, menu, or control popup is portalled away from the control that
 * opened it, so pointer and focus leave the chrome region that owns the trigger.
 * Chrome reveals read this count to stay open while the panel they launched is
 * still on screen. Each opener owns exactly one release, and nested surfaces
 * keep the count positive until the last one closes.
 */
import { useEffect, useSyncExternalStore } from "react";

let openCount = 0;
const listeners = new Set<() => void>();

/** Notifies every subscriber of a count change. */
function publish(): void {
  for (const listener of [...listeners]) {
    listener();
  }
}

/** Registers one open floating surface; the returned function releases it once. */
export function holdFloatingSurface(): () => void {
  openCount += 1;
  publish();
  let released = false;
  return () => {
    if (released) {
      return;
    }
    released = true;
    openCount = Math.max(0, openCount - 1);
    publish();
  };
}

/** Subscribes to floating-surface activity. */
export function subscribeFloatingSurface(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Whether at least one floating surface is open. */
export function isFloatingSurfaceOpen(): boolean {
  return openCount > 0;
}

/** Holds the owning reveal open while `open` is true. */
export function useHoldFloatingSurface(open: boolean): void {
  useEffect(() => {
    if (!open) {
      return undefined;
    }
    return holdFloatingSurface();
  }, [open]);
}

/** Reads whether any floating surface is open. */
export function useFloatingSurfaceOpen(): boolean {
  return useSyncExternalStore(
    subscribeFloatingSurface,
    isFloatingSurfaceOpen,
    isFloatingSurfaceOpen,
  );
}
