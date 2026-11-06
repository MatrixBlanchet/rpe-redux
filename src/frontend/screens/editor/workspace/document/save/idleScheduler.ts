/**
 * Adapts autosave scheduling to browser idle time. The save service owns when a
 * draft is due and what it contains; this module only chooses the callback.
 */
import type { AutoSaveScheduler } from "../../../../../../core/edit/session/autosave.ts";

/** Prefer browser idle time while keeping the scheduling policy outside the save service. */
export const idleScheduler: AutoSaveScheduler = {
  schedule: (callback) =>
    typeof globalThis.requestIdleCallback === "function"
      ? globalThis.requestIdleCallback(callback, { timeout: 1000 })
      : globalThis.setTimeout(callback, 0),
  cancel: (timer) => {
    if (typeof globalThis.cancelIdleCallback === "function") {
      globalThis.cancelIdleCallback(timer as number);
    } else {
      globalThis.clearTimeout(timer);
    }
  },
};
