/**
 * Data shapes and frozen defaults for curve trajectories.
 *
 * Holds the stored version, preset categories, option bags, parameter descriptors
 * and preset contracts. Behaviour lives in `curveTrajectory.ts`.
 */
import type { MessageKey } from "../../../../i18n/index.ts";

/** Stored trajectory payload version understood by the editor. */
export const TRAJECTORY_VERSION = 210;

/**
 * The gallery groups, as message keys rather than as words.
 *
 * A preset carries its group so the gallery can bucket it without a second table;
 * the *value* is the key the group header renders through `t()`. Keeping the key
 * in the data means the grouping survives a language switch, and a caller that
 * only has a preset in hand can still title its group.
 */
export const PRESET_CATEGORIES = {
  basic: "model.trajectory.category.basic",
  advanced: "model.trajectory.category.advanced",
  other: "model.trajectory.category.other",
  custom: "model.trajectory.category.custom",
} as const satisfies Record<string, MessageKey>;

/** The mode a trajectory is evaluated in: explicit x/y expressions or a polar radius. */
export type TrajectoryMode = "parametric" | "polar";
/** The two procedural shapes that are expanded into expressions before compiling. */
export type TrajectoryShape = "star" | "random-polygon";

/** One editable trajectory option bag. Every field is stored in the chart JSON. */
export interface TrajectoryOptions {
  mode?: TrajectoryMode;
  xExpression?: string;
  yExpression?: string;
  radiusExpression?: string;
  rotationExpression?: string;
  tangentRotation?: boolean;
  parameterStart?: string;
  parameterEnd?: string;
  angleStart?: string;
  angleEnd?: string;
  trimStart?: number;
  trimEnd?: number;
  rotation?: number;
  scaleX?: number;
  scaleY?: number;
  alignStart?: boolean;
  startX?: number;
  startY?: number;
  easingX?: number;
  easingY?: number;
  seed?: number;
  randomness?: number;
  parameters?: Record<string, number>;
  /** Only used while normalising a preset; `editableTrajectoryOptions` expands and deletes it. */
  shape?: TrajectoryShape;
}

/** A trajectory option bag that has been fully defaulted (what `compileTrajectory` accepts). */
export type EditableTrajectoryOptions = Required<Omit<TrajectoryOptions, "shape">> & {
  shape?: TrajectoryShape;
};

/** One preset parameter: its expression key, display label and numeric range. */
export interface TrajectoryParameter {
  key: string;
  label?: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
}

/** A declarative curve preset. `parameters` declares the per-preset constants. */
export interface CurvePreset {
  id: string;
  category: string;
  name: string;
  parameters: TrajectoryParameter[];
  mode?: TrajectoryMode;
  shape?: TrajectoryShape;
  xExpression?: string;
  yExpression?: string;
  radiusExpression?: string;
  rotationExpression?: string;
  tangentRotation?: boolean;
  parameterStart?: string;
  parameterEnd?: string;
  angleStart?: string;
  angleEnd?: string;
  trimStart?: number;
  trimEnd?: number;
  rotation?: number;
  scaleX?: number;
  scaleY?: number;
  alignStart?: boolean;
  startX?: number;
  startY?: number;
  easingX?: number;
  easingY?: number;
  seed?: number;
  randomness?: number;
}

/** A preset after `validateCurvePreset` has normalised and cloned it. */
export interface ValidatedCurvePreset {
  name: string;
  category: string;
  parameters: TrajectoryParameter[];
  [key: string]: unknown;
}

/** Fully defaulted trajectory options; every field has a usable value. */
export const TRAJECTORY_DEFAULTS = Object.freeze({
  mode: "parametric",
  xExpression: "200*cos(2*pi*t)",
  yExpression: "200*sin(2*pi*t)",
  radiusExpression: "200",
  rotationExpression: "",
  tangentRotation: false,
  parameterStart: "0",
  parameterEnd: "1",
  angleStart: "0",
  angleEnd: "2*pi",
  trimStart: 0,
  trimEnd: 1,
  rotation: 0,
  scaleX: 1,
  scaleY: 1,
  alignStart: false,
  startX: 0,
  startY: 0,
  easingX: 1,
  easingY: 1,
  seed: 1,
  randomness: 0,
  parameters: {},
}) satisfies TrajectoryOptions;

/** True when the options produce a non-zero rotation from a tangent or expression. */
export const trajectoryHasRotation = (options: TrajectoryOptions | undefined): boolean =>
  Boolean(options?.tangentRotation || options?.rotationExpression?.trim());
