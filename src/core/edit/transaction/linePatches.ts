/** Owns judge-line patch compatibility and parent-relation validation. */
import { lineParentIndex, type Chart, type JudgeLine } from "../../global/chart/chart.ts";
import { isChartObjectId, type ChartObjectId } from "../../global/chart/identity.ts";
import { isRecord } from "../../utils/guards.ts";
import { JUDGE_LINE_STRUCTURAL_FIELDS, type TransactionIssue } from "./contract.ts";

const LINE_PATCH_BLOCKLIST = new Set<string>(JUDGE_LINE_STRUCTURAL_FIELDS);

type ApplyPatch = (
  target: Record<string, unknown>,
  patch: unknown,
  blocked: ReadonlySet<string>,
  path: string,
  issues: TransactionIssue[],
) => void;

/** Builds a frozen issue with optional path and object id. */
function issue(code: string, path?: string, objectId?: ChartObjectId): TransactionIssue {
  return Object.freeze({
    code,
    ...(path ? { path } : {}),
    ...(objectId ? { objectId } : {}),
  });
}

/** Reads a line's parent index; null means no parent, NaN means invalid. */
function parentIndex(line: JudgeLine): number | null {
  const index = lineParentIndex(line.father);
  if (index === -1) {
    return null;
  }
  return Number.isInteger(index) ? index : Number.NaN;
}

/** Applies a line patch, resolving `parentId` and blocking structural fields. */
export function applyJudgeLinePatch(
  chart: Chart,
  issues: TransactionIssue[],
  relationTouched: Set<ChartObjectId>,
  line: JudgeLine,
  lineId: ChartObjectId,
  patch: unknown,
  path: string,
  applyPatch: ApplyPatch,
): void {
  if (!isRecord(patch)) {
    applyPatch(line, patch, LINE_PATCH_BLOCKLIST, path, issues);
    return;
  }
  const hasParentId = Object.hasOwn(patch, "parentId");
  const hasFather = Object.hasOwn(patch, "father");
  if (hasParentId && hasFather) {
    issues.push(issue("line.parent.patchConflict", path, lineId));
  }
  if (hasParentId && !hasFather) {
    const parentId = patch.parentId;
    if (parentId === null) {
      line.father = -1;
    } else if (!isChartObjectId(parentId)) {
      issues.push(issue("line.parentId.invalid", `${path}.parentId`, lineId));
    } else {
      const parentIndexValue = (chart.judgeLineList ?? []).findIndex(
        (candidate) => candidate.id === parentId,
      );
      if (parentIndexValue < 0) {
        issues.push(issue("line.parentId.notFound", `${path}.parentId`, parentId));
      } else if (parentId === lineId) {
        issues.push(issue("line.parent.self", `${path}.parentId`, lineId));
      } else {
        line.father = parentIndexValue;
      }
    }
    relationTouched.add(lineId);
  } else if (hasFather) {
    relationTouched.add(lineId);
  }
  const editablePatch = hasParentId
    ? Object.fromEntries(Object.entries(patch).filter(([key]) => key !== "parentId"))
    : patch;
  applyPatch(line, editablePatch, LINE_PATCH_BLOCKLIST, path, issues);
}

/** Rejects cycles and invalid parent chains for every touched line. */
export function validateTouchedLineRelations(
  chart: Chart,
  relationTouched: ReadonlySet<ChartObjectId>,
  issues: TransactionIssue[],
): void {
  const lines = chart.judgeLineList ?? [];
  for (const lineId of relationTouched) {
    const lineIndex = lines.findIndex((line) => line.id === lineId);
    if (lineIndex < 0) {
      continue;
    }
    const visited = new Set<number>();
    let current = lineIndex;
    while (true) {
      if (visited.has(current)) {
        issues.push(issue("line.parent.cycle", `judgeLineList[${lineIndex}].father`, lineId));
        break;
      }
      visited.add(current);
      const line = lines[current];
      if (!line) {
        break;
      }
      const parent = parentIndex(line);
      if (parent === null) {
        break;
      }
      if (Number.isNaN(parent) || parent < -1 || parent >= lines.length || parent === current) {
        issues.push(issue("line.parent.invalid", `judgeLineList[${lineIndex}].father`, lineId));
        break;
      }
      if (parent === -1) {
        break;
      }
      current = parent;
    }
  }
}
