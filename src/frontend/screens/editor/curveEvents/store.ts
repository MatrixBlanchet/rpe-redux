/**
 * Shared curve-preview authoring state.
 *
 * The canvas overlay and the inspector panel are separate React surfaces. This
 * cell is the single draft they both read: the draw path cache, the equation
 * path cache, selection, the beat range, sampling/fitting settings, the active
 * mode, and the status line. Durable fields are written to the trajectory
 * preference section so reopening the pane restores the last mode and drafts.
 */
import { createValue } from "../../../../core/state/values.ts";
import { PREFERENCE_SECTIONS, preferenceStorage } from "../../../../core/state/preferences.ts";
import { isRecord } from "../../../../core/utils/guards.ts";
import { beatValue, fromNumber, type Beat } from "../../../../core/global/chart/timing/beat.ts";
import { t } from "../../../../i18n/index.ts";
import {
  equationIsBlank,
  sampleEquationComponent,
  type EquationExpression,
} from "./equationDraft.ts";
import {
  reserveCurveIds,
  type CubicSegment,
  type CurvePathComponent,
  type CurvePathPoint,
  type SegmentTarget,
} from "./pathModel.ts";

/** Which authoring surface is active: freehand draw or parametric equations. */
export type CurveEditMode = "draw" | "equation";

/** Equation fields plus the last path that sampled successfully. */
export interface CurveEquationDraft extends EquationExpression {
  component: CurvePathComponent | null;
}

/** The single curve-preview draft shared by the overlay and the inspector. */
export interface CurvePreviewState {
  /** The draw mode's cached paths. Equation mode never reads this array. */
  components: CurvePathComponent[];
  selectedId: string | null;
  /** A segment inside the selected draw path; null means the whole path is selected. */
  selectedSegment: SegmentTarget | null;
  startBeat: Beat;
  endBeat: Beat;
  /** Cut points per current horizontal grid line; larger values cut more often. */
  cutDensity: string;
  /** Easing applied to the path parameter when generated events walk the path. */
  tEasing: number;
  fitEnabled: boolean;
  fitPrecision: string;
  status: string;
  editMode: CurveEditMode;
  /** Whether the canvas draws its grid and snaps creation/handle drags. */
  gridEnabled: boolean;
  /** Distance between grid points, in chart units. Smaller is denser. */
  gridDistance: string;
  /** Isolate the edited judge line and hide its notes. */
  previewLineOnly: boolean;
  /** Whether the shared transport wraps from B back to A. */
  loopEnabled: boolean;
  /** Position inside the A-B range, 0 at start and 1 at end. */
  previewProgress: number;
  /** The equation mode's cached draft and input fields. */
  equation: CurveEquationDraft;
  /** True when the equations cannot be sampled and the cached path is stale. */
  equationInvalid: boolean;
}

/** Defaults for the inspector fields that intentionally support reset. */
export const CURVE_PREVIEW_RESET_DEFAULTS = {
  cutDensity: "2",
  fitEnabled: true,
  fitPrecision: "1",
  gridEnabled: false,
  gridDistance: "50",
  previewLineOnly: false,
  loopEnabled: true,
} as const;

const defaults: CurvePreviewState = {
  components: [],
  selectedId: null,
  selectedSegment: null,
  startBeat: fromNumber(0),
  endBeat: fromNumber(4),
  cutDensity: CURVE_PREVIEW_RESET_DEFAULTS.cutDensity,
  tEasing: 1,
  fitEnabled: CURVE_PREVIEW_RESET_DEFAULTS.fitEnabled,
  fitPrecision: CURVE_PREVIEW_RESET_DEFAULTS.fitPrecision,
  // Empty means the inspector shows its localized range hint; a stored status
  // would freeze the language captured at module load.
  status: "",
  editMode: "draw",
  gridEnabled: CURVE_PREVIEW_RESET_DEFAULTS.gridEnabled,
  gridDistance: CURVE_PREVIEW_RESET_DEFAULTS.gridDistance,
  previewLineOnly: CURVE_PREVIEW_RESET_DEFAULTS.previewLineOnly,
  loopEnabled: CURVE_PREVIEW_RESET_DEFAULTS.loopEnabled,
  previewProgress: 0,
  equation: {
    xExpression: "",
    yExpression: "",
    parameterStart: "0",
    parameterEnd: "1",
    component: null,
  },
  equationInvalid: false,
};

/** Preference keys and write timing for the persisted draft. */
const DRAFT_STORAGE_KEY = "editorDraft";
const PERSIST_DELAY_MS = 250;
const draftStorage = preferenceStorage(PREFERENCE_SECTIONS.trajectory);

/** The JSON shape stored in the trajectory preference section. */
interface PersistedCurveDraft {
  version: 1;
  editMode: CurveEditMode;
  components: CurvePathComponent[];
  selectedId: string | null;
  selectedSegment: SegmentTarget | null;
  equation: CurveEquationDraft;
  startBeat: number;
  endBeat: number;
  /** v1 drafts written after the density rename store this field. */
  cutDensity?: string;
  /** v1 drafts written before the rename store the old grid-step multiplier. */
  cutScale?: string;
  tEasing?: number;
  fitEnabled: boolean;
  fitPrecision: string;
  gridEnabled: boolean;
  gridDistance: string;
  previewLineOnly: boolean;
  loopEnabled: boolean;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/** True for an integer easing id in the chart's supported range. */
function isEasingType(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 29;
}

/**
 * Convert a pre-rename `cutScale` draft into the density field.
 *
 * The old field stored a grid-step multiplier, so `2` meant one cut every two
 * lines. Density is its reciprocal; this keeps an existing draft's generated
 * event count unchanged.
 */
function densityFromScale(scale: unknown): string {
  if (typeof scale !== "string") {
    return defaults.cutDensity;
  }
  const value = Number(scale);
  return Number.isFinite(value) && value > 0 ? String(1 / value) : defaults.cutDensity;
}

function isCurvePoint(value: unknown): value is CurvePathPoint {
  return isRecord(value) && isFiniteNumber(value.x) && isFiniteNumber(value.y);
}

function isCubicSegment(value: unknown): value is CubicSegment {
  return (
    isRecord(value) &&
    isCurvePoint(value.p0) &&
    isCurvePoint(value.p1) &&
    isCurvePoint(value.p2) &&
    isCurvePoint(value.p3)
  );
}

function isCurveComponent(value: unknown): value is CurvePathComponent {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.color === "string" &&
    typeof value.closed === "boolean" &&
    Array.isArray(value.segments) &&
    value.segments.length > 0 &&
    value.segments.every(isCubicSegment)
  );
}

function isSegmentTarget(value: unknown): value is SegmentTarget {
  return (
    isRecord(value) &&
    typeof value.componentId === "string" &&
    Number.isInteger(value.segmentIndex) &&
    Number(value.segmentIndex) >= 0
  );
}

/** Validate one decoded preference payload against the persisted draft shape. */
function isPersistedCurveDraft(value: unknown): value is PersistedCurveDraft {
  if (!isRecord(value) || value.version !== 1) {
    return false;
  }
  if (value.editMode !== "draw" && value.editMode !== "equation") {
    return false;
  }
  if (!Array.isArray(value.components) || !value.components.every(isCurveComponent)) {
    return false;
  }
  if (value.selectedId !== null && typeof value.selectedId !== "string") {
    return false;
  }
  if (value.selectedSegment !== null && !isSegmentTarget(value.selectedSegment)) {
    return false;
  }
  const equation = value.equation;
  if (
    !isRecord(equation) ||
    typeof equation.xExpression !== "string" ||
    typeof equation.yExpression !== "string" ||
    typeof equation.parameterStart !== "string" ||
    typeof equation.parameterEnd !== "string" ||
    (equation.component !== null && !isCurveComponent(equation.component))
  ) {
    return false;
  }
  return (
    isFiniteNumber(value.startBeat) &&
    isFiniteNumber(value.endBeat) &&
    (typeof value.cutDensity === "string" || typeof value.cutScale === "string") &&
    (value.tEasing === undefined || isEasingType(value.tEasing)) &&
    typeof value.fitEnabled === "boolean" &&
    typeof value.fitPrecision === "string" &&
    typeof value.gridEnabled === "boolean" &&
    typeof value.gridDistance === "string" &&
    typeof value.previewLineOnly === "boolean" &&
    typeof value.loopEnabled === "boolean"
  );
}

/** Read the persisted draft, falling back to defaults when it is absent or invalid. */
function restoredState(): CurvePreviewState {
  const raw = draftStorage.getItem(DRAFT_STORAGE_KEY);
  if (!raw) {
    return defaults;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isPersistedCurveDraft(parsed)) {
      return defaults;
    }
    const restoredComponents = parsed.components;
    reserveCurveIds([
      ...restoredComponents,
      ...(parsed.equation.component ? [parsed.equation.component] : []),
    ]);
    const selectedId =
      parsed.selectedId && restoredComponents.some((entry) => entry.id === parsed.selectedId)
        ? parsed.selectedId
        : null;
    const selectedSegment =
      parsed.selectedSegment &&
      restoredComponents.some(
        (entry) =>
          entry.id === parsed.selectedSegment?.componentId &&
          entry.segments[parsed.selectedSegment.segmentIndex],
      )
        ? parsed.selectedSegment
        : null;
    const equation: CurveEquationDraft = { ...parsed.equation };
    let equationInvalid = false;
    if (!equationIsBlank(equation)) {
      const sampled = sampleEquationComponent(
        equation,
        t("editorPanels.curvePreview.equationPath"),
      );
      equationInvalid = sampled === null;
      equation.component ??= sampled;
    }
    return {
      ...defaults,
      editMode: parsed.editMode,
      components: restoredComponents,
      selectedId,
      selectedSegment,
      equation,
      equationInvalid,
      startBeat: fromNumber(parsed.startBeat),
      endBeat: fromNumber(parsed.endBeat),
      cutDensity: parsed.cutDensity ?? densityFromScale(parsed.cutScale),
      tEasing: parsed.tEasing ?? 1,
      fitEnabled: parsed.fitEnabled,
      fitPrecision: parsed.fitPrecision,
      gridEnabled: parsed.gridEnabled,
      gridDistance: parsed.gridDistance,
      previewLineOnly: parsed.previewLineOnly,
      loopEnabled: parsed.loopEnabled,
    };
  } catch {
    return defaults;
  }
}

/** The restored draft, created once when the module loads. */
const initial = restoredState();

/** The live cell read by the overlay and the inspector. */
export const curvePreviewState = createValue<CurvePreviewState>({ initial });

/** The part of the draw draft an undo step restores. */
export interface CurveDraftSnapshot {
  components: CurvePathComponent[];
  selectedId: string | null;
  selectedSegment: SegmentTarget | null;
}

/**
 * The draw draft's own undo stacks.
 *
 * They live outside the published state because nothing renders them: the curve
 * overlay is a live editor whose gestures must be reversible without touching
 * the chart history. Every mutation pushes the state it is about to replace, so
 * one gesture is one undo step. Equation fields keep their own live cache and do
 * not enter this stack.
 */
const history: { past: CurveDraftSnapshot[]; future: CurveDraftSnapshot[] } = {
  past: [],
  future: [],
};
const HISTORY_LIMIT = 200;

/** Capture the draw-draft fields an undo step restores. */
function snapshot(): CurveDraftSnapshot {
  const current = curvePreviewState.get();
  return {
    components: current.components,
    selectedId: current.selectedId,
    selectedSegment: current.selectedSegment,
  };
}

/** Record the draw draft before a mutation. Call once per gesture or action. */
export function beginCurveEdit(): void {
  history.past.push(snapshot());
  if (history.past.length > HISTORY_LIMIT) {
    history.past.shift();
  }
  history.future.length = 0;
}

/** Whether the draw draft has a step to undo. */
export function canUndoCurveEdit(): boolean {
  return history.past.length > 0;
}

/** Whether the draw draft has a step to redo. */
export function canRedoCurveEdit(): boolean {
  return history.future.length > 0;
}

/** Restore the draw draft recorded by the last `beginCurveEdit`. */
export function undoCurveEdit(): boolean {
  const previous = history.past.pop();
  if (!previous) {
    return false;
  }
  history.future.push(snapshot());
  updateCurvePreview({
    components: previous.components,
    selectedId: previous.selectedId,
    selectedSegment: previous.selectedSegment,
    status: t("editorPanels.curvePreview.undone"),
  });
  return true;
}

/** Restore the draw draft saved by the last undo, if any. */
export function redoCurveEdit(): boolean {
  const next = history.future.pop();
  if (!next) {
    return false;
  }
  history.past.push(snapshot());
  updateCurvePreview({
    components: next.components,
    selectedId: next.selectedId,
    selectedSegment: next.selectedSegment,
    status: t("editorPanels.curvePreview.redone"),
  });
  return true;
}

/** Drop the draw draft history when the editor closes or a fresh draft begins. */
export function clearCurveHistory(): void {
  history.past.length = 0;
  history.future.length = 0;
}

let persistTimer: ReturnType<typeof setTimeout> | null = null;

/** Cancel a pending debounce and write the current draft now. */
function persistNow(): void {
  if (persistTimer !== null) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
  try {
    const state = curvePreviewState.get();
    const snapshot: PersistedCurveDraft = {
      version: 1,
      editMode: state.editMode,
      components: state.components,
      selectedId: state.selectedId,
      selectedSegment: state.selectedSegment,
      equation: state.equation,
      startBeat: beatValue(state.startBeat),
      endBeat: beatValue(state.endBeat),
      cutDensity: state.cutDensity,
      tEasing: state.tEasing,
      fitEnabled: state.fitEnabled,
      fitPrecision: state.fitPrecision,
      gridEnabled: state.gridEnabled,
      gridDistance: state.gridDistance,
      previewLineOnly: state.previewLineOnly,
      loopEnabled: state.loopEnabled,
    };
    draftStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // Draft persistence must never block editing.
  }
}

/** Restart the debounce that writes the draft after `PERSIST_DELAY_MS`. */
function schedulePersist(): void {
  if (persistTimer !== null) {
    clearTimeout(persistTimer);
  }
  persistTimer = setTimeout(persistNow, PERSIST_DELAY_MS);
}

/** Write the current draft immediately; used when the pane closes. */
export function flushCurveDraft(): void {
  persistNow();
}

/**
 * Apply a patch or updater to the single curve-preview draft.
 *
 * The merged state is scheduled for preference persistence after a short
 * debounce so pointer drags do not write the full draft on every frame.
 * Transient fields such as playback progress can pass `persist: false`.
 */
export function updateCurvePreview(
  patch: Partial<CurvePreviewState> | ((current: CurvePreviewState) => Partial<CurvePreviewState>),
  options: { persist?: boolean } = {},
): void {
  const current = curvePreviewState.get();
  const next = typeof patch === "function" ? patch(current) : patch;
  curvePreviewState.set({ ...current, ...next });
  if (options.persist !== false) {
    schedulePersist();
  }
}

/**
 * Patch the equation fields and refresh their cached path.
 *
 * A failed evaluation keeps the previous valid component but marks the draft
 * invalid, so generation can be blocked while the stale path stays visible.
 * Clearing both expressions clears the path. This is a live preview operation,
 * not a commit-time validation step, so it never throws or reports an error.
 */
export function updateCurveEquation(patch: Partial<Omit<CurveEquationDraft, "component">>): void {
  updateCurvePreview((current) => {
    const equation = { ...current.equation, ...patch };
    const blank = equationIsBlank(equation);
    const sampled = blank
      ? null
      : sampleEquationComponent(equation, t("editorPanels.curvePreview.equationPath"));
    return {
      equation: { ...equation, component: blank ? null : (sampled ?? current.equation.component) },
      equationInvalid: !blank && sampled === null,
    };
  });
}

/**
 * The paths the current mode draws and previews.
 *
 * Draw mode exposes its path cache; equation mode exposes only its own cached
 * path so the draw draft never leaks into the equation surface.
 */
export function curveActiveComponents(
  state: Pick<CurvePreviewState, "editMode" | "components" | "equation">,
): readonly CurvePathComponent[] {
  if (state.editMode === "equation") {
    return state.equation.component ? [state.equation.component] : [];
  }
  return state.components;
}

/**
 * The path generation would use, or null when the active mode has no single
 * target. Draw mode prefers the selected path, then a lone path.
 */
export function curveActiveTarget(
  state: Pick<CurvePreviewState, "editMode" | "components" | "selectedId" | "equation">,
): CurvePathComponent | null {
  if (state.editMode === "equation") {
    return state.equation.component;
  }
  return (
    state.components.find((component) => component.id === state.selectedId) ??
    (state.components.length === 1 ? state.components[0] : null)
  );
}

/**
 * The overlay registers its local gesture cancellation here.
 *
 * Mode switches are an inspector action, but drafts, connectors, and drags live
 * in the canvas component. A late-bound callback lets the panel cancel them
 * without moving that transient state into the published store.
 */
interface CurveGestureBridge {
  hasPending(): boolean;
  cancel(): void;
  /** Run the overlay's selection-aware Delete action. */
  deleteSelected(): void;
}

let gestureBridge: CurveGestureBridge | null = null;

/** Register the overlay's gesture bridge; the returned callback unbinds it. */
export function bindCurveGestures(bridge: CurveGestureBridge): () => void {
  gestureBridge = bridge;
  return () => {
    if (gestureBridge === bridge) {
      gestureBridge = null;
    }
  };
}

/** Whether a draft stroke, drag, or pan is currently in progress. */
export function hasCurveGesture(): boolean {
  return gestureBridge?.hasPending() ?? false;
}

/** Cancel any in-progress draft, drag, or pan without changing the draft data. */
export function cancelCurveGestures(): void {
  gestureBridge?.cancel();
}

/**
 * End the transient part of a curve session.
 *
 * Closing the pane or deactivating it must drop a half-drawn stroke and any
 * latched drag or pan; otherwise the next pointer move would keep editing with
 * no button held. Completed paths stay in the draft and are persisted by
 * `flushCurveDraft`. Returns whether a gesture was actually pending.
 */
export function cancelCurveSession(): boolean {
  if (!hasCurveGesture()) {
    return false;
  }
  gestureBridge?.cancel();
  return true;
}

/** Delete the current curve selection from the registered shortcut. */
export function deleteCurveSelectionAction(): void {
  gestureBridge?.deleteSelected();
}
