/**
 * Trajectory authoring and evaluation.
 *
 * Normalises expression text, defaults and validates option bags and presets,
 * compiles x/y or polar expressions, and samples a trajectory into points.
 * Version constants and the preset re-exports come from the sibling modules.
 */
export * from "./curveTrajectoryTypes.ts";
export { CURVE_PRESETS } from "./curveTrajectoryPresets.ts";
import { TRAJECTORY_DEFAULTS, PRESET_CATEGORIES } from "./curveTrajectoryTypes.ts";
import type {
  CurvePreset,
  EditableTrajectoryOptions,
  TrajectoryOptions,
  ValidatedCurvePreset,
} from "./curveTrajectoryTypes.ts";
import { compileExpression } from "../../../utils/batchScript.ts";
import { easing } from "../../../utils/easing.ts";
import type { CompiledExpression, ExpressionScope } from "../../../utils/batchScript.ts";
import { clamp01 } from "../../../utils/numbers.ts";
import { isRecord } from "../../../utils/guards.ts";
import { trajectoryError } from "./errorContract.ts";
import type { MessageKey } from "../../../../i18n/index.ts";

/**
 * Full-width punctuation an IME may produce, as code points.
 *
 * The values are not interface text; they are additional spellings of `,` and
 * parentheses that an author typed into an expression field.
 */
const FULL_WIDTH_PUNCTUATION: readonly [number, string][] = [
  [0xff0c, ","],
  [0xff08, "("],
  [0xff09, ")"],
  [0xff0b, "+"],
  [0xff0d, "-"],
  [0xff0a, "*"],
  [0xff0f, "/"],
  [0xff05, "%"],
];

/** Normalize author-typed expression text to the evaluator's ASCII spelling. */
export function normalizeCurveExpression(source: unknown): string {
  let text = String(source ?? "")
    .trim()
    .replaceAll("$t$", "t")
    .replaceAll("θ", "theta")
    .replace(/\bPi\b/g, "pi")
    .replaceAll("π", "pi")
    .replaceAll("×", "*")
    .replaceAll("·", "*")
    .replaceAll("÷", "/")
    .replaceAll("−", "-")
    .replaceAll("–", "-")
    .replaceAll("≤", "<=")
    .replaceAll("≥", ">=")
    .replaceAll("≠", "!=")
    .replaceAll("²", "^2")
    .replaceAll("³", "^3")
    .replaceAll("⁴", "^4");
  // A radical sign applies to the next atom; common paste forms omit the
  // parentheses the evaluator needs, so normalize the short forms here.
  text = text
    .replace(/√\s*(\d+(?:\.\d+)?)/g, "sqrt($1)")
    .replace(/√\s*([A-Za-z_][A-Za-z_0-9]*)/g, "sqrt($1)")
    .replaceAll("√", "sqrt");
  for (const [code, ascii] of FULL_WIDTH_PUNCTUATION) {
    text = text.replaceAll(String.fromCharCode(code), ascii);
  }
  return text;
}

/** Preset options before its parameter list is flattened into keyed values. */
type CurvePresetOptionsInput = Omit<TrajectoryOptions, "parameters"> & {
  parameters: CurvePreset["parameters"];
};

/** Convert a preset's parameter declarations into editable option values. */
export function presetOptions(preset: CurvePresetOptionsInput): EditableTrajectoryOptions {
  return editableTrajectoryOptions({
    ...preset,
    parameters: Object.fromEntries(
      (preset.parameters ?? []).map((entry) => [entry.key, entry.value]),
    ),
  });
}

/**
 * Fill defaults and expand procedural shapes into parametric expressions.
 *
 * The returned options carry no `shape` field.
 */
export function editableTrajectoryOptions(
  input: TrajectoryOptions = {},
): EditableTrajectoryOptions {
  const options: EditableTrajectoryOptions = { ...TRAJECTORY_DEFAULTS, ...structuredClone(input) };
  if (!options.shape) {
    return options;
  }
  if (!["star", "random-polygon"].includes(options.shape)) {
    throw trajectoryError("unknownShape");
  }
  const star = options.shape === "star";
  const sides = `(clamp(round(points),3,40)${star ? "*2" : ""})`;
  const amount = `(((t%1+1)%1)*${sides})`;
  const index = `floor(${amount})`;
  const vertex = (step: string, axis: "x" | "y"): string => {
    const wrapped = `((${step})%${sides})`;
    const noise = `(sin(${wrapped}*127.1+seed*311.7)*43758.5453)`;
    const radius = star
      ? `radius*(${wrapped}%2?inner:1)`
      : `radius*(1-randomness*(${noise}-floor(${noise})))`;
    return `${radius}*${axis === "x" ? "cos" : "sin"}(2*pi*${wrapped}/${sides})`;
  };
  for (const axis of ["x", "y"] as const) {
    options[`${axis}Expression`] =
      `lerp(${vertex(index, axis)},${vertex(`${index}+1`, axis)},${amount}-${index})`;
  }
  options.parameters = {
    radius: 200,
    points: 5,
    ...(star ? { inner: 0.4 } : {}),
    ...options.parameters,
  };
  if (options.rotationExpression?.trim()) {
    const polar = options.mode === "polar";
    const begin = polar ? options.angleStart : options.parameterStart;
    const end = polar ? options.angleEnd : options.parameterEnd;
    const coordinate = `((${begin})+((${end})-(${begin}))*ease(t,${options.easingX}))`;
    options.rotationExpression = normalizeCurveExpression(options.rotationExpression).replace(
      /\b(t|theta)\b/g,
      (token) => (polar && token === "t" ? "t" : coordinate),
    );
  }
  options.mode = "parametric";
  options.parameterStart = "0";
  options.parameterEnd = "1";
  options.easingX = 1;
  options.easingY = 1;
  delete options.shape;
  return options;
}

/** A compiled trajectory: progress in `[0, 1]` to a point plus its rotation. */
export type TrajectoryEvaluator = (progress: number) => {
  x: number;
  y: number;
  rotation: number;
};

/**
 * Compile trajectory options into a progress-to-point evaluator.
 *
 * Throws trajectory errors for invalid parameters, ranges, easing or expression
 * results; rotation is degrees with tangent continuity applied when requested.
 */
export function compileTrajectory(input: TrajectoryOptions = {}): TrajectoryEvaluator {
  const options: EditableTrajectoryOptions = { ...TRAJECTORY_DEFAULTS, ...input };
  const parameters = (options.parameters ?? {}) as Record<string, number>;
  if (!isRecord(parameters) || Object.keys(parameters).length > 32) {
    throw trajectoryError("invalidParameters");
  }
  for (const [key, value] of Object.entries(parameters)) {
    if (!/^[A-Za-z_][A-Za-z_0-9]*$/.test(key) || !Number.isFinite(value)) {
      throw trajectoryError("invalidParameterName");
    }
  }
  const numericKeys = [
    "trimStart",
    "trimEnd",
    "rotation",
    "scaleX",
    "scaleY",
    "startX",
    "startY",
    "seed",
    "randomness",
  ] as const;
  for (const key of numericKeys) {
    if (!Number.isFinite(Number(options[key]))) {
      throw trajectoryError("mustBeFiniteNumber", { target: key });
    }
  }
  if (options.trimStart < 0 || options.trimEnd > 1 || options.trimEnd <= options.trimStart) {
    throw trajectoryError("invalidTrimRange");
  }
  for (const key of ["easingX", "easingY"] as const) {
    if (!Number.isInteger(Number(options[key])) || options[key] < 1 || options[key] > 29) {
      throw trajectoryError("invalidEasing");
    }
  }
  const scope: ExpressionScope = {
    ...parameters,
    seed: Number(options.seed),
    randomness: Number(options.randomness),
  };
  const expression = (source: string): CompiledExpression =>
    compileExpression(normalizeCurveExpression(source));
  const begin = expression(options.mode === "polar" ? options.angleStart : options.parameterStart)(
    scope,
  );
  const finish = expression(options.mode === "polar" ? options.angleEnd : options.parameterEnd)(
    scope,
  );
  const horizontal: CompiledExpression | null =
    options.mode === "polar" || options.shape ? null : expression(options.xExpression);
  const vertical: CompiledExpression | null =
    options.mode === "polar" || options.shape ? null : expression(options.yExpression);
  const radial: CompiledExpression | null =
    options.mode === "polar" ? expression(options.radiusExpression) : null;
  const direction: CompiledExpression | null =
    !options.tangentRotation && options.rotationExpression?.trim()
      ? expression(options.rotationExpression)
      : null;
  const random = (index: number): number => {
    const value = Math.sin(index * 127.1 + scope.seed * 311.7) * 43758.5453;
    return value - Math.floor(value);
  };
  const raw = (progress: number): { x: number; y: number; rotation: number } => {
    const unit =
      Number(options.trimStart) + (Number(options.trimEnd) - Number(options.trimStart)) * progress;
    const coordinate = (axis: "x" | "y"): number =>
      begin +
      (finish - begin) * easing(unit, Number(options[axis === "x" ? "easingX" : "easingY"]));
    let point: { x: number; y: number };
    if (options.shape) {
      const sides =
        Math.max(3, Math.min(40, Math.round(parameters.points ?? 5))) *
        (options.shape === "star" ? 2 : 1);
      const amount = (((unit % 1) + 1) % 1) * sides;
      const index = Math.floor(amount);
      const fraction = amount - index;
      const vertex = (step: number): { x: number; y: number } => {
        const wrapped = step % sides;
        const radius =
          (parameters.radius ?? 200) *
          (options.shape === "star"
            ? wrapped % 2
              ? (parameters.inner ?? 0.4)
              : 1
            : 1 - scope.randomness * random(wrapped));
        const angle = (2 * Math.PI * wrapped) / sides;
        return { x: radius * Math.cos(angle), y: radius * Math.sin(angle) };
      };
      const first = vertex(index);
      const second = vertex(index + 1);
      point = {
        x: first.x + (second.x - first.x) * fraction,
        y: first.y + (second.y - first.y) * fraction,
      };
    } else if (radial) {
      const theta = coordinate("x");
      const radius = radial({ ...scope, theta, t: unit, u: progress });
      point = { x: radius * Math.cos(theta), y: radius * Math.sin(theta) };
    } else {
      point = {
        x: (horizontal as CompiledExpression)({
          ...scope,
          t: coordinate("x"),
          u: progress,
          theta: unit,
        }),
        y: (vertical as CompiledExpression)({
          ...scope,
          t: coordinate("y"),
          u: progress,
          theta: unit,
        }),
      };
    }
    const angle = (Number(options.rotation) * Math.PI) / 180;
    const horizontalValue = point.x * Number(options.scaleX);
    const verticalValue = point.y * Number(options.scaleY);
    return {
      x: horizontalValue * Math.cos(angle) - verticalValue * Math.sin(angle),
      y: horizontalValue * Math.sin(angle) + verticalValue * Math.cos(angle),
      rotation: direction
        ? direction({
            ...scope,
            t: options.mode === "polar" ? unit : coordinate("x"),
            theta: coordinate("x"),
            u: progress,
          })
        : 0,
    };
  };
  const first = raw(0);
  const tangent = (progress: number): number | null => {
    for (const delta of [0.00001, 0.0001, 0.001, 0.01]) {
      const before = raw(Math.max(0, progress - delta));
      const after = raw(Math.min(1, progress + delta));
      const horizontalDelta = after.x - before.x;
      const verticalDelta = after.y - before.y;
      if (Math.hypot(horizontalDelta, verticalDelta) > 1e-9) {
        return (-Math.atan2(verticalDelta, horizontalDelta) * 180) / Math.PI;
      }
    }
    return null;
  };
  const angles: number[] = [];
  if (options.tangentRotation) {
    for (let index = 0; index <= 1024; index++) {
      const previous: number = angles.at(-1) ?? 0;
      const angle: number = tangent(index / 1024) ?? previous;
      angles.push(index ? angle + 360 * Math.round((previous - angle) / 360) : angle);
    }
  }
  return (progress: number) => {
    progress = clamp01(progress);
    const point = raw(progress);
    if (options.tangentRotation) {
      const reference = angles[Math.round(progress * 1024)];
      const angle = tangent(progress) ?? reference;
      point.rotation = angle + 360 * Math.round((reference - angle) / 360);
    }
    const result = {
      x: point.x + (options.alignStart ? Number(options.startX) - first.x : 0),
      y: point.y + (options.alignStart ? Number(options.startY) - first.y : 0),
      rotation: point.rotation,
    };
    if (!Object.values(result).every(Number.isFinite)) {
      throw trajectoryError("nonFiniteResult");
    }
    return result;
  };
}

export interface TrajectorySample {
  t: number;
  x: number;
  y: number;
  rotation: number;
}

/** Sample a trajectory into `count` evenly spaced points, including both ends. */
export function sampleCurveTrajectory(
  options: TrajectoryOptions = {},
  count = 257,
): TrajectorySample[] {
  if (!Number.isFinite(count) || count < 2 || count > 8193) {
    throw trajectoryError("invalidSampleCount");
  }
  const evaluate = compileTrajectory(options);
  const length = Math.trunc(count);
  return Array.from({ length }, (unused, index) => ({
    t: index / (length - 1),
    ...evaluate(index / (length - 1)),
  }));
}

/**
 * Validate and clone a preset, rejecting unknown fields and invalid ranges.
 *
 * The returned preset is normalized, custom-categorised and sampled once to
 * prove it evaluates.
 */
export function validateCurvePreset(preset: unknown): ValidatedCurvePreset {
  const candidate = preset as CurvePreset;
  if (
    !candidate ||
    typeof candidate !== "object" ||
    typeof candidate.name !== "string" ||
    !candidate.name.trim() ||
    candidate.name.length > 80
  ) {
    throw trajectoryError("invalidPresetName");
  }
  const allowed = new Set([...Object.keys(TRAJECTORY_DEFAULTS), "name", "category", "id", "shape"]);
  for (const key of Object.keys(candidate)) {
    if (!allowed.has(key)) {
      throw trajectoryError("unknownPresetField", { field: key });
    }
  }
  if (candidate.mode !== undefined && !["parametric", "polar"].includes(candidate.mode)) {
    throw trajectoryError("invalidMode");
  }
  if (candidate.shape !== undefined && !["star", "random-polygon"].includes(candidate.shape)) {
    throw trajectoryError("unknownShape");
  }
  const defaults = TRAJECTORY_DEFAULTS as Record<string, unknown>;
  const fields: Record<string, unknown> = { ...candidate };
  for (const [key, fallback] of Object.entries(defaults)) {
    if (key === "parameters" || !Object.hasOwn(candidate, key)) {
      continue;
    }
    if (typeof fields[key] !== typeof fallback) {
      const type: MessageKey =
        typeof fallback === "string"
          ? "model.trajectory.type.string"
          : typeof fallback === "boolean"
            ? "model.trajectory.type.boolean"
            : "model.trajectory.type.number";
      throw trajectoryError("invalidFieldType", { field: key, type });
    }
  }
  const required: string[] = candidate.shape
    ? []
    : candidate.mode === "polar"
      ? ["radiusExpression"]
      : ["xExpression", "yExpression"];
  for (const key of required) {
    if (typeof fields[key] !== "string" || !(fields[key] as string).trim()) {
      throw trajectoryError("missingExpression", { field: key });
    }
  }
  if (!Array.isArray(candidate.parameters) || candidate.parameters.length > 32) {
    throw trajectoryError("invalidParameterDeclarations");
  }
  const keys = new Set<string>();
  for (const entry of candidate.parameters) {
    const parameterFields: Record<string, unknown> = { ...entry };
    if (
      !entry ||
      keys.has(entry.key) ||
      !/^[A-Za-z_][A-Za-z_0-9]*$/.test(entry.key) ||
      ["t", "u", "theta", "pi", "seed", "randomness"].includes(entry.key) ||
      !Number.isFinite(entry.value)
    ) {
      throw trajectoryError("invalidParameter");
    }
    for (const key of Object.keys(entry)) {
      if (!["key", "label", "value", "min", "max", "step"].includes(key)) {
        throw trajectoryError("unknownParameterField", { key: entry.key, field: key });
      }
    }
    if (entry.label !== undefined && typeof entry.label !== "string") {
      throw trajectoryError("parameterLabelType", { key: entry.key });
    }
    for (const key of ["min", "max", "step"]) {
      const value = parameterFields[key];
      if (value !== undefined && !Number.isFinite(value)) {
        throw trajectoryError("mustBeFiniteNumber", { target: `${entry.key}.${key}` });
      }
    }
    if (
      (entry.step !== undefined && entry.step <= 0) ||
      (entry.min !== undefined && entry.max !== undefined && entry.min > entry.max) ||
      (entry.min !== undefined && entry.value < entry.min) ||
      (entry.max !== undefined && entry.value > entry.max)
    ) {
      throw trajectoryError("invalidParameterRange", { key: entry.key });
    }
    keys.add(entry.key);
  }
  const clean: ValidatedCurvePreset = {
    name: candidate.name.trim(),
    parameters: structuredClone(candidate.parameters),
    category: PRESET_CATEGORIES.custom,
  };
  for (const key of Object.keys(TRAJECTORY_DEFAULTS)) {
    if (key !== "parameters" && Object.hasOwn(candidate, key)) {
      clean[key] = structuredClone(fields[key]);
    }
  }
  if (candidate.shape === "star" || candidate.shape === "random-polygon") {
    clean.shape = candidate.shape;
  }
  sampleCurveTrajectory(presetOptions(clean), 257);
  return clean;
}

/** The slice of a chart event `trajectoryEventValue` needs. */
export interface TrajectoryEventLike {
  trajectory?: { options?: TrajectoryOptions } | null;
  trajectoryAxis?: "x" | "y" | "rotation";
}

/** Evaluator cache for trajectory events, keyed by event object. */
const compiledEvents = new WeakMap<object, TrajectoryEvaluator>();

/** Sample one axis of an event's trajectory, compiling and caching it on first use. */
export function trajectoryEventValue(
  event: TrajectoryEventLike,
  progress: number,
  axis: "x" | "y" | "rotation" = event.trajectoryAxis ?? "x",
): number {
  let evaluate = compiledEvents.get(event);
  if (!evaluate) {
    evaluate = compileTrajectory(event.trajectory?.options);
    compiledEvents.set(event, evaluate);
  }
  return evaluate(progress)[axis];
}
