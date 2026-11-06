/**
 * Live sampling for the curve equation mode.
 *
 * Equation mode owns one cached draft path. Expressions are edited character by
 * character, so an invalid formula is a normal intermediate state: sampling
 * returns null and the caller keeps the previous valid component.
 */
import { sampleCurveTrajectory } from "../../../../core/global/chart/trajectory/curveTrajectory.ts";
import { componentFromPoints, type CurvePathComponent } from "./pathModel.ts";

/** The editable fields of one parametric equation draft. */
export interface EquationExpression {
  xExpression: string;
  yExpression: string;
  /** Parameter range start, as entered in the inspector. */
  parameterStart: string;
  /** Parameter range end, as entered in the inspector. */
  parameterEnd: string;
}

/** Whether both coordinate expressions are empty. */
export function equationIsBlank(equation: EquationExpression): boolean {
  return !equation.xExpression.trim() && !equation.yExpression.trim();
}

/**
 * Sample a parametric equation into one editable path.
 *
 * Returns null when the expressions are blank, malformed, non-finite, or too
 * short to form a segment. The caller keeps its previous path in that case.
 */
export function sampleEquationComponent(
  equation: EquationExpression,
  name: string,
  count = 32,
): CurvePathComponent | null {
  if (equationIsBlank(equation)) {
    return null;
  }
  try {
    const samples = sampleCurveTrajectory(
      {
        mode: "parametric",
        xExpression: equation.xExpression,
        yExpression: equation.yExpression,
        parameterStart: equation.parameterStart,
        parameterEnd: equation.parameterEnd,
        trimStart: 0,
        trimEnd: 1,
      },
      count,
    );
    const points = samples
      .filter((sample) => Number.isFinite(sample.x) && Number.isFinite(sample.y))
      .map((sample) => ({ x: sample.x, y: sample.y }));
    const first = points.at(0);
    const last = points.at(-1);
    if (!first || !last || points.length < 2) {
      return null;
    }
    const closed = Math.hypot(first.x - last.x, first.y - last.y) < 0.5;
    return componentFromPoints(name, points, closed);
  } catch {
    return null;
  }
}
