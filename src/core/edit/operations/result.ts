/** Shared input and result contract for actions that target chart coordinates. */

export type ActionStatus = "committed" | "unchanged" | "rejected" | "unavailable";

export type ActionReason =
  | "not_registered"
  | "disabled"
  | "invalid_input"
  | "invalid_parameters"
  | "not_handled"
  | "no_change"
  | "failed"
  | "developer_mode_disabled"
  | "desktop_unavailable"
  | "devtools_unavailable"
  | "clipboard_unavailable"
  | "diagnostics_unavailable";

export interface ActionResult<T = unknown> {
  status: ActionStatus;
  reason?: ActionReason;
  value?: T;
  message?: string;
  issues?: readonly string[];
}

export interface ActionCoordinate {
  beat: number;
  positionX: number;
}

export interface ActionTarget {
  lineIndex: number;
  from: ActionCoordinate;
  to?: ActionCoordinate;
  layer?: number;
  eventType?: string;
}

export interface CoordinateActionInput<T = unknown> {
  target: ActionTarget;
  payload?: T;
}

/** True when `value` carries one of the four action statuses. */
export function isActionResult(value: unknown): value is ActionResult {
  if (!value || typeof value !== "object") {
    return false;
  }
  const status = (value as { status?: unknown }).status;
  return (
    status === "committed" ||
    status === "unchanged" ||
    status === "rejected" ||
    status === "unavailable"
  );
}

/** Returns a rejected result for an invalid target, or null when it is usable. */
export function validateActionTarget(target: unknown): ActionResult<never> | null {
  if (!target || typeof target !== "object") {
    return {
      status: "rejected",
      reason: "invalid_input",
      issues: ["target.required"],
    };
  }
  const value = target as Partial<ActionTarget>;
  const issues: string[] = [];
  if (!Number.isInteger(value.lineIndex) || (value.lineIndex ?? -1) < 0) {
    issues.push("lineIndex.nonNegativeInteger");
  }
  validateCoordinate(value.from, "from", issues);
  if (value.to !== undefined) {
    validateCoordinate(value.to, "to", issues);
  }
  if (value.layer !== undefined && (!Number.isInteger(value.layer) || (value.layer ?? -1) < 0)) {
    issues.push("layer.nonNegativeInteger");
  }
  if (value.eventType !== undefined && !value.eventType.trim()) {
    issues.push("eventType.nonEmpty");
  }
  return issues.length ? { status: "rejected", reason: "invalid_input", issues } : null;
}

/** Appends field-qualified issues for a malformed beat/position pair. */
function validateCoordinate(coordinate: unknown, name: "from" | "to", issues: string[]): void {
  if (!coordinate || typeof coordinate !== "object") {
    issues.push(`${name}.required`);
    return;
  }
  const value = coordinate as Partial<ActionCoordinate>;
  if (typeof value.beat !== "number" || !Number.isFinite(value.beat)) {
    issues.push(`${name}.beat.finite`);
  }
  if (typeof value.positionX !== "number" || !Number.isFinite(value.positionX)) {
    issues.push(`${name}.positionX.finite`);
  }
}
