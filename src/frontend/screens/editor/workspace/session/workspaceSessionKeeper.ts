/**
 * Periodically snapshots the live editor into the last-workspace preference.
 *
 * Playhead and panel state change continuously, so writing on every editor event
 * would flood SQLite. The keeper samples on a timer, compares the serialized
 * record, and writes only when something visible changed. A normal close clears
 * the record, so only the periodic samples survive a crash or update restart.
 */
import {
  WORKSPACE_SESSION_VERSION,
  clearWorkspaceSession,
  writeWorkspaceSession,
  type WorkspaceSession,
  type WorkspaceSessionDocument,
  type WorkspaceSessionPanels,
  type WorkspaceSessionView,
} from "../../../../../core/edit/session/workspaceSession.ts";

/** Editor state sampled into the last-workspace preference. */
export interface WorkspaceSessionKeeperDependencies {
  hasDocument(): boolean;
  document(): WorkspaceSessionDocument | null;
  view(): WorkspaceSessionView;
  panels(): WorkspaceSessionPanels;
}

/** Explicit save and clear handles for the periodic session sampler. */
export interface WorkspaceSessionKeeper {
  save(): void;
  clear(): void;
  dispose(): void;
}

/** Start sampling the live workspace; returns the explicit save/clear handles. */
export function createWorkspaceSessionKeeper(
  deps: WorkspaceSessionKeeperDependencies,
): WorkspaceSessionKeeper {
  let last = "";
  let timer: ReturnType<typeof setInterval> | null = null;

  /** Writes the current workspace record when its visible state changed. */
  const save = (): void => {
    if (!deps.hasDocument()) {
      return;
    }
    const document = deps.document();
    if (!document) {
      return;
    }
    const session: WorkspaceSession = {
      version: WORKSPACE_SESSION_VERSION,
      savedAt: Date.now(),
      documentRef: document,
      view: deps.view(),
      panels: deps.panels(),
    };
    // `savedAt` changes on every sample; compare the user-visible state so an
    // idle editor does not rewrite SQLite every two seconds.
    const serialized = JSON.stringify({ ...session, savedAt: 0 });
    if (serialized === last) {
      return;
    }
    last = serialized;
    writeWorkspaceSession(session);
  };

  /** Removes the stored record and resets change detection. */
  const clear = (): void => {
    last = "";
    clearWorkspaceSession();
  };

  const interval = 2000;
  timer = setInterval(save, interval);
  return {
    save,
    clear,
    /** Stops periodic sampling; the stored record stays for a later restore. */
    dispose() {
      if (timer !== null) {
        clearInterval(timer);
        timer = null;
      }
      // Normal close clears the record before the runtime is disposed. A crash
      // never reaches this path, so the last periodic sample stays available.
    },
  };
}
