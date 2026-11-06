/**
 * Owns the editor frame loop's lifecycle and its load-to-first-paint handshake.
 *
 * The composition root supplies the work performed by one frame, but this
 * module owns scheduling, frame state, the frame budget, and the one outstanding
 * loading task.  A load task is allowed to outlive the document that started it,
 * so the task is passed as a value while replaceable editor state stays behind
 * getters in the runner contract.
 */
import type { LoadTask } from "../../../../../../core/global/document/loading.ts";
import { EditorFrameScheduler } from "./frameScheduler.ts";
import {
  createEditorFrameRunner,
  createEditorFrameState,
  type FrameRunnerOptions,
} from "./frame.ts";

/** The work performed by one frame, without state or scheduling. */
export type FrameRuntimeInstallOptions = Omit<FrameRunnerOptions, "state" | "schedule">;

/** Lifecycle and first-paint handshake of the editor frame loop. */
export interface EditorFrameRuntime {
  readonly invalidate: () => void;
  readonly waitForFirstRender: (task: LoadTask) => Promise<void>;
  readonly completeFirstRender: () => void;
  readonly resetFrameTimestamp: () => void;
  install(options: FrameRuntimeInstallOptions): void;
  wake(): void;
  dispose(): void;
}

/**
 * Builds the frame-loop owner for one editor mount.
 *
 * The scheduler and its callback stay together so no caller can schedule
 * against a stale runner or dispose half of the loop. `install` is explicit
 * because the drawing dependencies are created after this runtime exists.
 */
export function createEditorFrameRuntime(): EditorFrameRuntime {
  const state = createEditorFrameState();
  let runFrame: (timestamp: number) => void = () => {};
  let disposed = false;
  let firstRenderTask: LoadTask | null = null;
  let firstRenderResolve: (() => void) | null = null;
  let firstRenderTimer: ReturnType<typeof setTimeout> | undefined;

  const scheduler = new EditorFrameScheduler((timestamp) => runFrame(timestamp));

  /** Marks the frame dirty and asks for the next animation callback. */
  const invalidate = () => {
    if (disposed) {
      return;
    }
    state.dirty = true;
    scheduler.wake();
  };

  /** Resolves the pending first-paint wait and marks its load task complete. */
  const completeFirstRender = () => {
    if (!firstRenderTask) {
      return;
    }
    const task = firstRenderTask;
    firstRenderTask = null;
    firstRenderResolve?.();
    firstRenderResolve = null;
    clearTimeout(firstRenderTimer);
    firstRenderTimer = undefined;
    task.update("render", 1, 1);
  };

  /** Resolves once the next painted frame runs, or after a 1.5 s timeout. */
  const waitForFirstRender = (task: LoadTask) =>
    new Promise<void>((resolve) => {
      firstRenderTask = task;
      firstRenderResolve = resolve;
      clearTimeout(firstRenderTimer);
      firstRenderTimer = setTimeout(() => {
        if (firstRenderTask !== task) {
          return;
        }
        firstRenderTask = null;
        firstRenderResolve = null;
        firstRenderTimer = undefined;
        task.update("render", 1, 1);
        resolve();
      }, 1500);
    });

  return {
    invalidate,
    waitForFirstRender,
    completeFirstRender,
    resetFrameTimestamp: () => {
      state.lastTick = 0;
      invalidate();
    },
    /** Replaces the frame callback; throws once this runtime is disposed. */
    install(options) {
      if (disposed) {
        throw new Error("Cannot install a disposed editor frame runtime");
      }
      runFrame = createEditorFrameRunner({
        ...options,
        state,
        schedule: (continuous, hidden, playing) => scheduler.schedule(continuous, hidden, playing),
      });
    },
    /** Requests one frame without marking it dirty. */
    wake: () => scheduler.wake(),
    /** Cancels scheduling and releases the first-render wait. */
    dispose() {
      if (disposed) {
        return;
      }
      disposed = true;
      clearTimeout(firstRenderTimer);
      firstRenderTimer = undefined;
      scheduler.dispose();
      firstRenderTask = null;
      firstRenderResolve = null;
    },
  };
}
