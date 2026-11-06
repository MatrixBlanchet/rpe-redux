/**
 * Coordinates curve-editor canvas interaction and field updates.
 *
 * The curve model supplies values and labels; this module translates pointer
 * edits into model actions and invalidates the preview. Curve mathematics and
 * inspector-pane selection stay outside this file.
 */
import { flushSync } from "react-dom";
import {
  beatCopy,
  compareBeats,
  fromNumber,
  normalizeBeat,
} from "../../../../../core/global/chart/timing/beat.ts";
import { planCurveNotes } from "../../../../../core/global/chart/editing/curveNotes.ts";
import { t } from "../../../../../i18n/index.ts";
import type { JudgeLineNote } from "../../../../../core/global/chart/chart.ts";
import type { CurveState } from "./model.ts";
import { DEFAULT_CURVE_FIELD_VALUES } from "./model.ts";
import type { CurveFieldValues } from "./CurveFieldsView.tsx";
import { createCurveGhostCache } from "./ghostCache.ts";
import type { CurveAnchor } from "../../../../../core/edit/timeline/types.ts";
import type { TimelineNote } from "../../../../../core/edit/timeline/types.ts";

/** Host callbacks the curve editor uses without owning the session or timeline. */
export interface CurveEditorDependencies {
  state: CurveState;
  getDivision(): number;
  getNotes(): readonly JudgeLineNote[];
  setPickMode(mode: "start" | "end" | null): void;
  activatePane(): void;
  /** Leave multi-line editing and show the ordinary note timeline for picking. */
  showSingleNoteTimeline(): void;
  closePane(): void;
  invalidate(): void;
  notify(message: string, severity?: string): void;
  reportError(error: unknown): void;
  commit(notes: JudgeLineNote[]): void;
}

/** Creates the curve editor bound to one mounted editor tree. */
export function createCurveEditor(deps: CurveEditorDependencies) {
  const ghostCache = createCurveGhostCache();
  let start: CurveAnchor | null | undefined;
  let end: CurveAnchor | null | undefined;
  let anchorMode: "start" | "end" | null = null;
  let open = false;
  let lastGhostError: string | null = null;
  let previewEnabled = true;
  let values: CurveFieldValues = { ...DEFAULT_CURVE_FIELD_VALUES };

  /** Publishes the current draft to the pane and repaints the ghost. */
  function updatePanel(): void {
    if (!open) {
      return;
    }
    const fieldValues: CurveFieldValues = { ...values };
    flushSync(() =>
      deps.state.fields.set({
        labels: {
          startTime: t("editor.app.curve.startBeat"),
          endTime: t("editor.app.curve.endBeat"),
          startX: t("editor.app.curve.startX"),
          endX: t("editor.app.curve.endX"),
          density: t("editor.app.curve.density"),
          type: t("editor.app.curve.type"),
          easing: t("editor.app.curve.easing"),
        },
        values: fieldValues,
        // A beat box commits only a complete triple and the owner refuses the
        // two impossible orders, so the form has no half-typed anchor left to
        // report; a failed generation reports through `reportError` instead.
        error: null,
        preview: previewEnabled,
        onInput: updateFields,
        onPreviewChange: setPreview,
      }),
    );
    deps.invalidate();
  }

  /** Stores edited form values and republishes them. */
  function updateFields(next: CurveFieldValues): void {
    values = { ...next };
    ghostCache.invalidate();
    updatePanel();
    deps.invalidate();
  }

  /** Shows or hides the generated-notes ghost; the draft itself stays as it is. */
  function setPreview(enabled: boolean): void {
    if (previewEnabled === enabled) {
      return;
    }
    previewEnabled = enabled;
    ghostCache.invalidate();
    updatePanel();
    deps.invalidate();
  }

  /** Opens the pane and seeds both anchors from the current draft. */
  function openPanel(): void {
    open = true;
    ghostCache.invalidate();
    start = {
      startTime: beatCopy(values.startTime),
      positionX: values.startX,
      type: values.type,
    };
    end = {
      startTime: beatCopy(values.endTime),
      positionX: values.endX,
      type: values.type,
    };
    anchorMode = null;
    deps.setPickMode(null);
    deps.activatePane();
    updatePanel();
  }

  /** Closes the pane and clears the draft anchors. */
  function closePanel(): void {
    open = false;
    ghostCache.invalidate();
    start = null;
    end = null;
    anchorMode = null;
    deps.setPickMode(null);
    deps.closePane();
    deps.invalidate();
  }

  /** Starts picking the start or end anchor from the timeline. */
  function capture(endAnchor: boolean): void {
    if (!open) {
      openPanel();
    }
    deps.showSingleNoteTimeline();
    anchorMode = endAnchor ? "end" : "start";
    if (endAnchor && !start) {
      anchorMode = null;
      deps.setPickMode(null);
      throw new Error(t("editor.app.curve.needStart"));
    }
    deps.setPickMode(endAnchor ? "end" : "start");
  }

  /** Writes a picked anchor into the draft; returns false when none is pending. */
  function applyAnchor(anchor: CurveAnchor): boolean {
    if (anchorMode === "start") {
      start = anchor;
      anchorMode = null;
      deps.setPickMode(null);
      values.startTime = normalizeBeat(anchor.startTime);
      values.startX = anchor.positionX;
      ghostCache.invalidate();
      updatePanel();
      deps.invalidate();
      return true;
    }
    if (!start) {
      anchorMode = null;
      deps.setPickMode(null);
      deps.notify(t("editor.app.curve.needStart"), "warning");
      return true;
    }
    end = anchor;
    anchorMode = null;
    deps.setPickMode(null);
    values.endTime = normalizeBeat(anchor.startTime);
    values.endX = anchor.positionX;
    ghostCache.invalidate();
    updatePanel();
    deps.invalidate();
    return true;
  }

  /** Uses a timeline note as the pending anchor. */
  function pick(note: TimelineNote): boolean {
    if (!anchorMode) {
      return false;
    }
    return applyAnchor({
      startTime: beatCopy(note.startTime),
      positionX: note.positionX,
      type: note.type,
    });
  }

  /** Pick an arbitrary grid point, independent of any existing note. */
  function pickPoint(beat: number, positionX: number): boolean {
    if (!anchorMode || !Number.isFinite(beat) || !Number.isFinite(positionX)) {
      return false;
    }
    return applyAnchor({
      startTime: fromNumber(beat),
      positionX,
      type: values.type,
    });
  }

  /** Generates the curve notes and commits them through the host. */
  function generate(): void {
    try {
      const plan = planCurveNotes({
        ...values,
        division: deps.getDivision(),
        existing: deps.getNotes(),
      });
      if (!plan.generated.length && compareBeats(values.startTime, values.endTime) !== 0) {
        throw new Error(t("editor.app.curve.nothingToGenerate"));
      }
      deps.commit(plan.notes);
      closePanel();
      deps.notify(t("editor.app.curve.generated", { count: plan.notes.length }), "success");
    } catch (error) {
      deps.reportError(error);
    }
  }

  /** Clears the anchors, pick mode, and open flag without notifying the host. */
  function resetDraft(): void {
    anchorMode = null;
    start = null;
    end = null;
    open = false;
    ghostCache.invalidate();
  }

  /** Returns the preview notes, reporting each new ghost error once. */
  function ghost(): TimelineNote[] {
    if (!previewEnabled) {
      return [];
    }
    let failed = false;
    const result = ghostCache.get({
      active: open,
      start,
      end,
      values,
      division: deps.getDivision(),
      notes: deps.getNotes(),
      onError: (error) => {
        failed = true;
        const message = error instanceof Error ? error.message : String(error);
        if (message !== lastGhostError) {
          lastGhostError = message;
          deps.reportError(error);
        }
      },
    });
    if (!failed) {
      lastGhostError = null;
    }
    return result;
  }

  return {
    get isOpen() {
      return open;
    },
    updatePanel,
    openPanel,
    closePanel,
    capture,
    pick,
    pickPoint,
    generate,
    resetDraft,
    setPreview,
    deactivate: () => {
      // Leaving the pane must also end an in-progress anchor pick; otherwise a
      // hidden curve editor would keep consuming the next note click. Repaint
      // immediately so the timeline drops the ghost before the next pointer
      // event can invalidate it.
      open = false;
      anchorMode = null;
      ghostCache.invalidate();
      deps.setPickMode(null);
      deps.invalidate();
    },
    ghost,
  };
}
