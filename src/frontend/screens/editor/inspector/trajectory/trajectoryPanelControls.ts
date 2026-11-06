/**
 * Shared descriptors and helpers for the trajectory pane: the common field
 * table, preset option mapping, error text, preview drawing, and the preset
 * storage key.
 *
 * Field labels are message keys, which keeps both locales in one table; preview
 * drawing reads the canvas palette rather than hard-coded colors.
 */
import { PREFERENCE_SECTIONS, preferenceStorage } from "../../../../../core/state/preferences.ts";

import {
  presetOptions,
  type CurvePreset,
  type EditableTrajectoryOptions,
  type TrajectorySample,
  type ValidatedCurvePreset,
} from "../../../../../core/global/chart/trajectory/curveTrajectory.ts";
import { createTrajectoryEvent } from "../../../../../core/edit/events/trajectoryCommands.ts";
import type { Chart } from "../../../../../core/global/chart/chart.ts";
import type { TempoSource } from "../../../../../core/global/chart/timing/events.ts";
import type { EditorSession } from "../../../../../core/edit/session/session.ts";
import { samplingSettings } from "../../../../../core/edit/sampling/sampling.ts";
import { t, type MessageKey } from "../../../../../i18n/index.ts";
import {
  isTrajectoryError,
  type TrajectoryErrorCode,
} from "../../../../../core/global/chart/trajectory/errorContract.ts";
import { readCanvasPalette } from "../../canvas/palette.ts";

/** Storage key for custom trajectory presets. */
export const STORAGE_KEY = "presets";

/** Preference storage that holds the custom preset list. */
export const presetStorage = preferenceStorage(PREFERENCE_SECTIONS.trajectory);
/** Common fields: `[key, title message, control type, minimum, maximum, step]`. */
export const COMMON_FIELDS: Array<[string, MessageKey, string?, number?, number?, number?]> = [
  ["trimStart", "editorPanels.trajectory.field.trimStart", "number", 0, 1, 0.01],
  ["trimEnd", "editorPanels.trajectory.field.trimEnd", "number", 0, 1, 0.01],
  ["rotation", "editorPanels.trajectory.field.rotation", "number", -3600, 3600, 1],
  ["scaleX", "editorPanels.trajectory.field.scaleX", "number", -100, 100, 0.1],
  ["scaleY", "editorPanels.trajectory.field.scaleY", "number", -100, 100, 0.1],
  ["alignStart", "editorPanels.trajectory.field.alignStart", "checkbox"],
  ["startX", "editorPanels.trajectory.field.startX", "number", -100000, 100000, 1],
  ["startY", "editorPanels.trajectory.field.startY", "number", -100000, 100000, 1],
  ["randomness", "editorPanels.trajectory.field.randomness", "range", 0, 1, 0.01],
  ["seed", "editorPanels.trajectory.field.seed", "number", 0, 100000, 1],
];

/** Trajectory options held by the panel, with defaults and form-key access. */
export type TrajectoryOptionBag = EditableTrajectoryOptions & Record<string, unknown>;

/** Preset draft used for live expression-parameter preview. */
export interface PresetDraft {
  options: EditableTrajectoryOptions;
  points: TrajectorySample[];
  canvas: HTMLCanvasElement;
  preset: CurvePreset | ValidatedCurvePreset;
}

/** The two view settings read by `tick` from the renderer. */
export interface TrajectoryPreviewRenderer {
  aspectRatio?: number;
  viewDivisor?: number;
}

/** `tick` result: the chart and seconds drawn by the left preview. */
export interface TrajectoryTickResult {
  chart: Chart;
  seconds: number;
}

/** The editor-context slice read by the panel. */
export interface TrajectoryContext {
  session: EditorSession;
  timeline: { gestures: { layer: number } };
  tempo: TempoSource;
  previewVisible: boolean;
}

/** Host callbacks supplied to the panel. */
export interface TrajectoryPanelHooks {
  invalidate: () => void;
  notify: (message: string, severity?: string) => void;
  setOverlayVisible: (visible: boolean) => void;
  /** `""` closes the pane; `"trajectory"` opens it. */
  activate: (pane: "" | "trajectory") => void;
}

export type TrajectoryEvent = ReturnType<typeof createTrajectoryEvent>;

/**
 * Reads options from either a declared preset or a validated one; both carry
 * the option bag and parameter list this view needs.
 */
export const optionsForPreset = presetOptions as (
  preset: CurvePreset | ValidatedCurvePreset,
) => EditableTrajectoryOptions & Record<string, unknown>;

const TRAJECTORY_ERROR_KEYS: Record<TrajectoryErrorCode, MessageKey> = {
  unknownShape: "model.trajectory.unknownShape",
  invalidParameters: "model.trajectory.invalidParameters",
  invalidParameterName: "model.trajectory.invalidParameterName",
  mustBeFiniteNumber: "model.validation.mustBeFiniteNumber",
  invalidTrimRange: "model.trajectory.invalidTrimRange",
  invalidEasing: "model.trajectory.invalidEasing",
  nonFiniteResult: "model.trajectory.nonFiniteResult",
  invalidSampleCount: "model.trajectory.invalidSampleCount",
  invalidPresetName: "model.trajectory.invalidPresetName",
  unknownPresetField: "model.trajectory.unknownPresetField",
  invalidMode: "model.trajectory.invalidMode",
  invalidFieldType: "model.trajectory.fieldType",
  missingExpression: "model.trajectory.missingExpression",
  invalidParameterDeclarations: "model.trajectory.invalidParameterDeclarations",
  invalidParameter: "model.trajectory.invalidParameter",
  unknownParameterField: "model.trajectory.unknownParameterField",
  parameterLabelType: "model.trajectory.parameterLabelType",
  invalidParameterRange: "model.trajectory.invalidParameterRange",
  invalidJson: "model.trajectory.invalidJson",
  presetGone: "model.trajectory.presetGone",
  presetDuplicate: "model.trajectory.presetDuplicate",
  eventRequired: "model.trajectory.eventRequired",
  invalidSegments: "model.trajectory.invalidSegments",
  invalidTolerance: "model.trajectory.invalidTolerance",
  invalidFitInput: "model.trajectory.invalidFitInput",
};

/** Maps a declared value type to its localized name. */
function trajectoryTypeMessageKey(value: string): MessageKey | null {
  switch (value) {
    case "string":
      return "model.trajectory.type.string";
    case "boolean":
      return "model.trajectory.type.boolean";
    case "number":
      return "model.trajectory.type.number";
    default:
      return null;
  }
}

/** Formats a domain error for display, leaving non-trajectory errors as text. */
export const errorMessage = (error: unknown): string => {
  if (isTrajectoryError(error)) {
    const params = { ...error.params };
    if (error.code === "invalidFieldType" && typeof params.type === "string") {
      const key = trajectoryTypeMessageKey(params.type);
      params.type = key ? t(key) : params.type;
    }
    return t(TRAJECTORY_ERROR_KEYS[error.code], params);
  }
  return error instanceof Error ? error.message : String(error);
};

/** Draws a trajectory sample path with sampling-style guides, progress split, and marker. */
export function drawPath(
  canvas: HTMLCanvasElement,
  points: TrajectorySample[] | null,
  progress = 0,
): void {
  const context = canvas.getContext("2d");
  if (!context) {
    return;
  }
  const width = Math.max(1, canvas.width);
  const height = Math.max(1, canvas.height);
  const palette = readCanvasPalette();
  context.clearRect(0, 0, width, height);
  context.fillStyle = palette.surface;
  context.fillRect(0, 0, width, height);
  if (!points?.length) {
    return;
  }
  const finitePoints = points.filter(
    (point) => Number.isFinite(point.x) && Number.isFinite(point.y),
  );
  if (!finitePoints.length) {
    return;
  }
  const xs = finitePoints.map((point) => point.x);
  const ys = finitePoints.map((point) => point.y);
  const left = Math.min(...xs);
  const right = Math.max(...xs);
  const bottom = Math.min(...ys);
  const top = Math.max(...ys);
  const padding = Math.max(10, Math.min(width, height) * 0.1);
  const usableWidth = Math.max(1, width - padding * 2);
  const usableHeight = Math.max(1, height - padding * 2);
  const scale = Math.min(
    usableWidth / Math.max(1e-6, right - left),
    usableHeight / Math.max(1e-6, top - bottom),
  );
  const map = (point: TrajectorySample): [number, number] => [
    padding + (point.x - left) * scale + (usableWidth - (right - left) * scale) / 2,
    height - padding - (point.y - bottom) * scale - (usableHeight - (top - bottom) * scale) / 2,
  ];
  context.save();
  context.lineCap = "round";
  context.lineJoin = "round";
  const guideOpacity = Math.min(1, Math.max(0, samplingSettings.get().guideOpacity / 100));
  // Keep the trajectory preview's grid visually identical to the sampler:
  // solid accent guides, the same major/minor opacity, and no second axis
  // treatment or dashed grid competing with the path.
  context.strokeStyle = palette.bottomValue;
  context.lineWidth = 1;
  context.setLineDash([]);
  for (let index = 0; index <= 4; index += 1) {
    const x = padding + (usableWidth * index) / 4;
    const y = padding + (usableHeight * index) / 4;
    context.globalAlpha = guideOpacity * (index % 5 === 0 ? 0.38 : 0.24);
    context.beginPath();
    context.moveTo(x, padding);
    context.lineTo(x, height - padding);
    context.moveTo(padding, y);
    context.lineTo(width - padding, y);
    context.stroke();
  }
  context.setLineDash([]);
  context.globalAlpha = 1;
  const drawSegment = (start: number, end: number, color: string, alpha: number) => {
    context.strokeStyle = color;
    context.globalAlpha = alpha;
    context.beginPath();
    finitePoints
      .slice(start, end + 1)
      .forEach((point, index) =>
        index ? context.lineTo(...map(point)) : context.moveTo(...map(point)),
      );
    context.stroke();
  };
  const markerIndex = Math.min(
    finitePoints.length - 1,
    Math.max(0, Math.round(progress * (finitePoints.length - 1))),
  );
  const split = markerIndex > 0 ? markerIndex : 0;
  drawSegment(0, split, palette.inspectorMarker, guideOpacity);
  drawSegment(split, finitePoints.length - 1, palette.inspectorPath, guideOpacity * 0.72);
  const startPoint = map(finitePoints[0]);
  context.fillStyle = palette.inspectorPath;
  context.beginPath();
  context.arc(startPoint[0], startPoint[1], 3, 0, Math.PI * 2);
  context.fill();
  const marker = map(finitePoints[markerIndex]);
  context.fillStyle = palette.inspectorMarker;
  context.strokeStyle = palette.surface;
  context.lineWidth = 2;
  context.beginPath();
  context.arc(marker[0], marker[1], 5, 0, Math.PI * 2);
  context.fill();
  context.stroke();
  context.restore();
}
