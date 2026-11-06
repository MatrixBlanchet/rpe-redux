/** Language-neutral failure codes raised by trajectory chart operations. */
export type TrajectoryErrorCode =
  | "unknownShape"
  | "invalidParameters"
  | "invalidParameterName"
  | "mustBeFiniteNumber"
  | "invalidTrimRange"
  | "invalidEasing"
  | "nonFiniteResult"
  | "invalidSampleCount"
  | "invalidPresetName"
  | "unknownPresetField"
  | "invalidMode"
  | "invalidFieldType"
  | "missingExpression"
  | "invalidParameterDeclarations"
  | "invalidParameter"
  | "unknownParameterField"
  | "parameterLabelType"
  | "invalidParameterRange"
  | "invalidJson"
  | "presetGone"
  | "presetDuplicate"
  | "eventRequired"
  | "invalidSegments"
  | "invalidTolerance"
  | "invalidFitInput";

/** Interpolation values carried by a trajectory error for UI translation. */
export type TrajectoryErrorParams = Readonly<Record<string, string | number>>;

/** Error type carrying a stable code and its message parameters. */
export class TrajectoryError extends Error {
  readonly name = "TrajectoryError";
  readonly code: TrajectoryErrorCode;
  readonly params: TrajectoryErrorParams;

  /** Build an error for `code`; `cause` is kept for diagnostics only. */
  constructor(
    code: TrajectoryErrorCode,
    params: TrajectoryErrorParams = {},
    options?: { cause?: unknown },
  ) {
    super(code, options);
    this.code = code;
    this.params = params;
  }
}

/** Create a `TrajectoryError` for `code`. */
export function trajectoryError(
  code: TrajectoryErrorCode,
  params: TrajectoryErrorParams = {},
  options?: { cause?: unknown },
): TrajectoryError {
  return new TrajectoryError(code, params, options);
}

/** True when `error` was raised through the trajectory error contract. */
export function isTrajectoryError(error: unknown): error is TrajectoryError {
  return error instanceof TrajectoryError;
}
