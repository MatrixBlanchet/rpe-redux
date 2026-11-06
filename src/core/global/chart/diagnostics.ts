/**
 * Validates unvalidated chart JSON into structured, localized diagnostics.
 *
 * Each issue carries a category, a path into the document, and a message key;
 * `ChartLoadError` bundles the list for the document layer, and
 * `sanitizeChartForReadOnly` keeps a broken document openable without editing.
 */
import { t, type MessageKey, type MessageParams } from "../../../i18n/index.ts";
import { createChart, EVENT_TYPES, EXTENDED_TYPES, isNoteType, type Chart } from "./chart.ts";
import { CONTROL_TRACKS } from "./chartTracks.ts";
import { isBeat } from "./timing/beat.ts";
import { isRecord } from "../../utils/guards.ts";

/** The document area a diagnostic belongs to. */
export type ChartDiagnosticCategory =
  "document" | "metadata" | "timing" | "judgeLine" | "note" | "event" | "control";

/** One validation issue with its path and message key. */
export interface ChartDiagnostic {
  readonly id: string;
  readonly category: ChartDiagnosticCategory;
  readonly path: string;
  readonly messageKey: MessageKey;
  readonly messageParams?: MessageParams;
}

/** Validation failure bundling every issue found in a document. */
export class ChartLoadError extends Error {
  readonly name = "ChartLoadError";
  readonly issues: readonly ChartDiagnostic[];

  /** Build the error from `issues`, defaulting the message to their formatted paths. */
  constructor(
    issues: readonly ChartDiagnostic[],
    message = issues
      .map((entry) => `${entry.path}: ${t(entry.messageKey, entry.messageParams)}`)
      .join("\n"),
  ) {
    super(message || t("model.chart.invalidDocument"));
    this.issues = issues;
  }
}

/** Record one issue unless an identical diagnostic already exists. */
function add(
  issues: ChartDiagnostic[],
  category: ChartDiagnosticCategory,
  path: string,
  messageKey: MessageKey,
  messageParams?: MessageParams,
): void {
  const id = `${category}:${path}:${messageKey}:${JSON.stringify(messageParams ?? {})}`;
  if (!issues.some((entry) => entry.id === id)) {
    issues.push({
      id,
      category,
      path,
      messageKey,
      messageParams,
    });
  }
}

/** True for a finite number. */
function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/** Validate a beat tuple, recording an issue and returning false when it is malformed. */
function beat(
  value: unknown,
  path: string,
  category: ChartDiagnosticCategory,
  issues: ChartDiagnostic[],
): value is [number, number, number] {
  if (isBeat(value)) {
    return true;
  }
  add(issues, category, path, "model.beat.invalidTuple", { path });
  return false;
}

/** Validate the non-empty BPM list and every entry. */
function bpmList(value: unknown, issues: ChartDiagnostic[]): boolean {
  if (!Array.isArray(value) || !value.length) {
    add(issues, "timing", "BPMList", "model.tempo.emptyList");
    return false;
  }
  let valid = true;
  value.forEach((entry, index) => {
    const path = `BPMList[${index}]`;
    const item = isRecord(entry) ? entry : null;
    if (!item || !finite(item.bpm) || item.bpm <= 0) {
      add(issues, "timing", `${path}.bpm`, "model.tempo.invalidBpm", { index });
      valid = false;
    }
    valid = beat(item?.startTime, `${path}.startTime`, "timing", issues) && valid;
  });
  return valid;
}

/** True when `value` fits the allowed payload of an event track. */
function eventValueValid(type: string, value: unknown): boolean {
  if (type === "textEvents") {
    return typeof value === "string";
  }
  if (type === "colorEvents") {
    return Array.isArray(value) && value.length === 3 && value.every(finite);
  }
  return finite(value);
}

/** Validate one note without copying it; returns whether it can be kept. */
function inspectNote(note: unknown, notePath: string, issues: ChartDiagnostic[]): boolean {
  if (!isRecord(note)) {
    add(issues, "note", notePath, "model.chart.invalidNote", { path: notePath });
    return false;
  }
  const item = note;
  let valid = true;
  valid = beat(item.startTime, `${notePath}.startTime`, "note", issues) && valid;
  valid = beat(item.endTime, `${notePath}.endTime`, "note", issues) && valid;
  if (!isNoteType(Number(item.type)) || !finite(item.positionX)) {
    add(issues, "note", notePath, "model.chart.invalidNoteType", { path: notePath });
    valid = false;
  }
  for (const property of ["speed", "size", "alpha", "yOffset", "visibleTime"] as const) {
    if (item[property] !== undefined && !finite(item[property])) {
      add(issues, "note", `${notePath}.${property}`, "model.validation.mustBeFiniteNumber", {
        target: `${notePath}.${property}`,
      });
      valid = false;
    }
  }
  return valid;
}

/** Validate one event without copying it; returns whether it can be kept. */
function inspectEvent(
  value: unknown,
  path: string,
  type: string,
  issues: ChartDiagnostic[],
): boolean {
  if (!isRecord(value)) {
    add(issues, "event", path, "model.chart.invalidEventValue", { path });
    return false;
  }
  const event = value;
  let valid = beat(event.startTime, `${path}.startTime`, "event", issues);
  valid = beat(event.endTime, `${path}.endTime`, "event", issues) && valid;
  if (
    type !== "paintEvents" &&
    (!eventValueValid(type, event.start) || !eventValueValid(type, event.end))
  ) {
    add(issues, "event", path, "model.chart.invalidEventValue", { path });
    valid = false;
  }
  if (
    event.bezier &&
    (!Array.isArray(event.bezierPoints) ||
      event.bezierPoints.length !== 4 ||
      !event.bezierPoints.every(finite))
  ) {
    add(issues, "event", `${path}.bezierPoints`, "model.chart.invalidBezierPoints", { path });
    valid = false;
  }
  if (event.trajectory) {
    const trajectory = isRecord(event.trajectory) ? event.trajectory : null;
    if (
      !trajectory ||
      trajectory.version !== 1 ||
      typeof trajectory.segments !== "number" ||
      !Number.isInteger(trajectory.segments) ||
      trajectory.segments < 4 ||
      trajectory.segments > 8192
    ) {
      add(issues, "event", `${path}.trajectory`, "model.chart.trajectoryTrack");
      valid = false;
    }
  }
  for (const property of ["easingLeft", "easingRight"] as const) {
    if (event[property] !== undefined && !finite(event[property])) {
      add(issues, "event", `${path}.${property}`, "model.validation.mustBeFiniteNumber", {
        target: `${path}.${property}`,
      });
      valid = false;
    }
  }
  return valid;
}

/** Validate one event, returning a clean copy or null after recording issues. */
function safeEvent(
  value: unknown,
  path: string,
  type: string,
  issues: ChartDiagnostic[],
): Record<string, unknown> | null {
  return inspectEvent(value, path, type, issues) ? { ...(value as Record<string, unknown>) } : null;
}

/** Validate an event layer without copying it. */
function inspectLayer(value: unknown, path: string, issues: ChartDiagnostic[]): void {
  if (!isRecord(value)) {
    return;
  }
  const layer = value;
  for (const type of [...EVENT_TYPES, ...EXTENDED_TYPES]) {
    const events = layer[type];
    if (events === undefined) {
      continue;
    }
    if (!Array.isArray(events)) {
      add(issues, "event", `${path}.${type}`, "model.validation.mustBeArray", {
        target: `${path}.${type}`,
      });
      continue;
    }
    events.forEach((event, index) =>
      inspectEvent(event, `${path}.${type}[${index}]`, type, issues),
    );
  }
}

/** Validate an event layer, dropping malformed tracks and events. */
function safeLayer(
  value: unknown,
  path: string,
  issues: ChartDiagnostic[],
): Record<string, unknown> | null {
  if (!isRecord(value)) {
    return null;
  }
  const layer = value;
  const next = { ...layer };
  for (const type of [...EVENT_TYPES, ...EXTENDED_TYPES]) {
    const events = layer[type];
    if (events === undefined) {
      continue;
    }
    if (!Array.isArray(events)) {
      add(issues, "event", `${path}.${type}`, "model.validation.mustBeArray", {
        target: `${path}.${type}`,
      });
      delete next[type];
      continue;
    }
    next[type] = events
      .map((event, index) => safeEvent(event, `${path}.${type}[${index}]`, type, issues))
      .filter(Boolean);
  }
  return next;
}

/** Validate one control point without copying it. */
function inspectControlPoint(
  point: unknown,
  path: string,
  property: string,
  issues: ChartDiagnostic[],
): boolean {
  if (!isRecord(point) || !finite(point.x) || !finite(point[property])) {
    add(issues, "control", path, "model.chart.invalidControlPoint", { path });
    return false;
  }
  return true;
}

/** Validate one judge line without copying it. */
function inspectLine(value: unknown, index: number, issues: ChartDiagnostic[]): void {
  const path = `judgeLineList[${index}]`;
  if (!isRecord(value)) {
    add(issues, "judgeLine", path, "model.chart.invalidJudgeLine", { path });
    return;
  }
  const line = value;
  if (line.bpmfactor !== undefined && (!finite(line.bpmfactor) || line.bpmfactor <= 0)) {
    add(issues, "judgeLine", `${path}.bpmfactor`, "model.chart.bpmFactorPositive", { path });
  }
  if (line.notes !== undefined) {
    if (!Array.isArray(line.notes)) {
      add(issues, "note", `${path}.notes`, "model.validation.mustBeArray", {
        target: `${path}.notes`,
      });
    } else {
      line.notes.forEach((note, noteIndex) =>
        inspectNote(note, `${path}.notes[${noteIndex}]`, issues),
      );
    }
  }
  if (line.eventLayers !== undefined) {
    if (!Array.isArray(line.eventLayers)) {
      add(issues, "event", `${path}.eventLayers`, "model.validation.mustBeArray", {
        target: `${path}.eventLayers`,
      });
    } else {
      line.eventLayers.forEach((layer, layerIndex) =>
        inspectLayer(layer, `${path}.eventLayers[${layerIndex}]`, issues),
      );
    }
  }
  if (line.extended !== undefined) {
    inspectLayer(line.extended, `${path}.extended`, issues);
  }
  for (const { field, property } of CONTROL_TRACKS) {
    const controls = line[field];
    if (controls === undefined) {
      continue;
    }
    if (!Array.isArray(controls)) {
      add(issues, "control", `${path}.${field}`, "model.validation.mustBeArray", {
        target: `${path}.${field}`,
      });
      continue;
    }
    controls.forEach((point, pointIndex) =>
      inspectControlPoint(point, `${path}.${field}[${pointIndex}]`, property, issues),
    );
  }
}

/** Validate one judge line, keeping only the parts that pass. */
function safeLine(
  value: unknown,
  index: number,
  issues: ChartDiagnostic[],
): Record<string, unknown> | null {
  const path = `judgeLineList[${index}]`;
  if (!isRecord(value)) {
    add(issues, "judgeLine", path, "model.chart.invalidJudgeLine", { path });
    return null;
  }
  const line = value;
  const next = { ...line };
  if (line.bpmfactor !== undefined && (!finite(line.bpmfactor) || line.bpmfactor <= 0)) {
    add(issues, "judgeLine", `${path}.bpmfactor`, "model.chart.bpmFactorPositive", { path });
    delete next.bpmfactor;
  }
  if (line.notes !== undefined) {
    if (!Array.isArray(line.notes)) {
      add(issues, "note", `${path}.notes`, "model.validation.mustBeArray", {
        target: `${path}.notes`,
      });
      next.notes = [];
    } else {
      next.notes = line.notes.filter((note, noteIndex) =>
        inspectNote(note, `${path}.notes[${noteIndex}]`, issues),
      );
    }
  }
  if (line.eventLayers !== undefined) {
    if (!Array.isArray(line.eventLayers)) {
      add(issues, "event", `${path}.eventLayers`, "model.validation.mustBeArray", {
        target: `${path}.eventLayers`,
      });
      next.eventLayers = [];
    } else {
      next.eventLayers = line.eventLayers.map((layer, layerIndex) =>
        safeLayer(layer, `${path}.eventLayers[${layerIndex}]`, issues),
      );
    }
  }
  if (line.extended !== undefined) {
    next.extended = safeLayer(line.extended, `${path}.extended`, issues) ?? {};
  }
  for (const { field, property } of CONTROL_TRACKS) {
    const controls = line[field];
    if (controls === undefined) {
      continue;
    }
    if (!Array.isArray(controls)) {
      add(issues, "control", `${path}.${field}`, "model.validation.mustBeArray", {
        target: `${path}.${field}`,
      });
      delete next[field];
      continue;
    }
    next[field] = controls.filter((point, pointIndex) =>
      inspectControlPoint(point, `${path}.${field}[${pointIndex}]`, property, issues),
    );
  }
  return next;
}

/** Validate an unparsed chart value and return every issue found. */
export function collectChartDiagnostics(value: unknown): readonly ChartDiagnostic[] {
  const issues: ChartDiagnostic[] = [];
  if (!isRecord(value)) {
    add(issues, "document", "$", "model.chart.invalidDocument");
    return issues;
  }
  const chart = value;
  const meta = isRecord(chart.META) ? chart.META : null;
  if (!meta) {
    add(issues, "metadata", "META", "model.chart.missingMeta");
  } else if (meta.offset !== undefined && !finite(meta.offset)) {
    add(issues, "metadata", "META.offset", "model.chart.offsetNotFinite");
  }
  bpmList(chart.BPMList, issues);
  if (!Array.isArray(chart.judgeLineList)) {
    add(issues, "judgeLine", "judgeLineList", "model.validation.mustBeArray", {
      target: "judgeLineList",
    });
  } else {
    chart.judgeLineList.forEach((line, index) => inspectLine(line, index, issues));
  }
  return issues;
}

/** Parse chart text and return the value with its diagnostics; invalid JSON yields no value. */
export function parseChartDiagnostics(text: string): {
  value: unknown;
  issues: readonly ChartDiagnostic[];
} {
  try {
    const value = JSON.parse(text.replace(/^\uFEFF/, ""));
    return { value, issues: collectChartDiagnostics(value) };
  } catch (error) {
    return {
      value: null,
      issues: [
        {
          id: "document:json",
          category: "document",
          path: "$",
          messageKey: "model.chart.invalidJson",
          messageParams: { message: error instanceof Error ? error.message : String(error) },
        },
      ],
    };
  }
}

/** Return a renderable chart for read-only inspection, retaining valid content. */
export function sanitizeChartForReadOnly(value: unknown): Chart | null {
  if (!isRecord(value)) {
    return createChart();
  }
  const chart = value;
  const fallback = createChart();
  const meta = isRecord(chart.META) ? chart.META : null;
  const validBpm = Array.isArray(chart.BPMList)
    ? chart.BPMList.filter((entry) => {
        const item = isRecord(entry) ? entry : null;
        return Boolean(item && finite(item.bpm) && item.bpm > 0 && isBeat(item.startTime));
      })
    : [];
  const lines = Array.isArray(chart.judgeLineList)
    ? chart.judgeLineList.map((line, index) => safeLine(line, index, [])).filter(Boolean)
    : [];
  return {
    ...chart,
    META: { ...fallback.META, ...(meta ?? {}) },
    BPMList: validBpm.length ? validBpm : fallback.BPMList,
    judgeLineList: lines.length ? lines : fallback.judgeLineList,
  } as Chart;
}
