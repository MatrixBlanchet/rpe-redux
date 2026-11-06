/**
 * Structural judge-line edits: delete, duplicate and re-parent.
 *
 * Every helper returns a new chart with `father` links and shader line references
 * remapped to the resulting indices, so callers never fix references themselves.
 */
import { t } from "../../../../i18n/index.ts";
import { remapShaderLines } from "../shader/shaderEvents.ts";
import type { Chart, JudgeLine } from "../chart.ts";

/** A chart whose judge line list is known to be present and dense. */
type ChartWithLines = Chart & { judgeLineList: JudgeLine[] };

/** Throw unless `index` addresses a line in `chart`. */
function requireLine(chart: Chart, index: number): asserts chart is ChartWithLines {
  if (!Number.isInteger(index) || !chart.judgeLineList?.[index]) {
    throw new Error(t("editor.commands.lineCommands.error.invalidIndex"));
  }
}

/** Remove a line, reparent its children to the root, and remap shader references. */
export function deleteLine(chart: Chart, index: number): Chart {
  requireLine(chart, index);
  const lines = chart.judgeLineList
    .filter((line, current) => current !== index)
    .map((line) => {
      if (line.father === index) {
        return { ...line, father: -1 };
      }
      if (Number(line.father) > index) {
        return { ...line, father: Number(line.father) - 1 };
      }
      return line;
    });
  const destinations = new Map<number, number>(
    chart.judgeLineList.flatMap((line, current): [number, number][] =>
      current === index ? [] : [[current, current > index ? current - 1 : current]],
    ),
  );
  return remapShaderLines(chart, { ...chart, judgeLineList: lines }, destinations);
}

/** Append a deep copy of a line with a suffixed name and its shader effects. */
export function duplicateLine(chart: Chart, index: number): Chart {
  requireLine(chart, index);
  const line = structuredClone(chart.judgeLineList[index]);
  line.Name = t("editor.commands.lineCommands.duplicateNameSuffix", {
    name: line.Name || t("editor.commands.lineCommands.defaultName"),
  });
  return remapShaderLines(
    chart,
    { ...chart, judgeLineList: [...chart.judgeLineList, line] },
    new Map<number, number>(
      chart.judgeLineList.map((line, index): [number, number] => [index, index]),
    ),
    index,
  );
}

/** Point a line at `parent`, rejecting cycles and invalid indices. */
export function setLineParent(chart: Chart, index: number, parent: number): Chart {
  requireLine(chart, index);
  if (parent !== -1) {
    requireLine(chart, parent);
  }
  const visited = new Set([index]);
  let ancestor = parent;
  while (ancestor !== -1) {
    if (visited.has(ancestor)) {
      throw new Error(t("editor.commands.lineCommands.error.parentCycle"));
    }
    requireLine(chart, ancestor);
    visited.add(ancestor);
    const father = chart.judgeLineList[ancestor].father ?? -1;
    if (typeof father !== "number") {
      throw new Error(t("editor.commands.lineCommands.error.invalidIndex"));
    }
    ancestor = father;
  }
  const lines = [...chart.judgeLineList];
  lines[index] = { ...lines[index], father: parent };
  return { ...chart, judgeLineList: lines };
}
