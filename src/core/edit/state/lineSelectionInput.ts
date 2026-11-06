/**
 * Parses the toolbar line field's text into a current line and a shared line
 * selection.
 *
 * The field accepts one index (`3`), an inclusive colon or hyphen range
 * (`2:5`, `2-5`), and any comma-separated union of those (`1,3:5`). Values
 * outside the document clamp to the nearest existing line, so typing `72` in a
 * 24-line chart selects line 23 and `-3:100` selects the whole document.
 */
export interface LineSelectionInput {
  /** The line the timeline switches to: the first line of the union. */
  line: number;
  /** Every named line, ascending and without duplicates. */
  lines: readonly number[];
}

const SINGLE = /^-?\d+$/;
const RANGE = /^(-?\d+)\s*[:-]\s*(-?\d+)$/;

/**
 * Write sorted line indices as the compact form the field shows: consecutive
 * runs become `start-end`, and separate runs are comma-separated. The result is
 * always accepted by `parseLineSelectionInput`.
 */
export function formatLineSelection(lines: readonly number[]): string {
  const sorted = [...new Set(lines.filter((line) => Number.isInteger(line) && line >= 0))].sort(
    (left, right) => left - right,
  );
  if (!sorted.length) {
    return "";
  }
  const parts: string[] = [];
  let start = sorted[0];
  let end = start;
  for (let index = 1; index < sorted.length; index += 1) {
    const line = sorted[index];
    if (line === end + 1) {
      end = line;
      continue;
    }
    parts.push(start === end ? String(start) : `${start}-${end}`);
    start = line;
    end = line;
  }
  parts.push(start === end ? String(start) : `${start}-${end}`);
  return parts.join(",");
}

/**
 * Read one typed line selection.
 *
 * Returns `null` for text that names no existing line, including an empty
 * field, a reversed range, and a partially invalid union. The caller decides
 * whether a refusal is an error or simply leaves the current selection alone.
 */
export function parseLineSelectionInput(
  raw: string,
  available: readonly number[],
): LineSelectionInput | null {
  const text = raw.trim();
  if (!text || !available.length) {
    return null;
  }
  const known = new Set(available);
  const minimum = Math.min(...available);
  const maximum = Math.max(...available);
  const clampIndex = (value: number): number => Math.min(maximum, Math.max(minimum, value));
  const lines = new Set<number>();
  for (const part of text.split(",")) {
    const token = part.trim();
    if (!token) {
      return null;
    }
    const range = RANGE.exec(token);
    if (range) {
      let start = clampIndex(Number(range[1]));
      let end = clampIndex(Number(range[2]));
      if (start > end) {
        [start, end] = [end, start];
      }
      for (let index = start; index <= end; index += 1) {
        if (known.has(index)) {
          lines.add(index);
        }
      }
      continue;
    }
    if (!SINGLE.test(token)) {
      return null;
    }
    const index = clampIndex(Number(token));
    if (known.has(index)) {
      lines.add(index);
    }
  }
  if (!lines.size) {
    return null;
  }
  const sorted = [...lines].sort((left, right) => left - right);
  return { line: sorted[0], lines: sorted };
}
