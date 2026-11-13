/**
 * Parses the toolbar line field's text into a current line and a shared line
 * selection.
 *
 * The field accepts one index (`3`), an inclusive colon or hyphen range
 * (`2:5`, `2-5`, `2：5`), and any union of those. A union separates its parts with
 * the ASCII comma, the CJK comma, or whitespace, so `0,15`, `0，15`, and `0 15`
 * name the same pair, and repeated separators (`0,,15`, `0  15`) are ignored.
 * Ranges tolerate spaces around their operator (`0 - 15`).
 *
 * Multi-line mode appends the active line as an annotation: `0-15 (3)` is the
 * selection `0-15` on active line `3`, so Ctrl+wheel still changes the main line
 * while the union stays put. A trailing parenthesized number is therefore an
 * annotation, not a member: it is stripped before the union is read, and a
 * single parenthesized index (`(3)`) is accepted as that one line. This also
 * keeps RPE-style line labels such as `1(0)` readable.
 *
 * Values outside the document clamp to the nearest existing line, so typing
 * `72` in a 24-line chart selects line 23 and `-3:100` selects the whole
 * document. A reversed range is read in ascending order.
 */
export interface LineSelectionInput {
  /** The line the timeline switches to: the annotation when present, else the union's first line. */
  line: number;
  /** Every named line, ascending and without duplicates. */
  lines: readonly number[];
  /** The annotation's line when the text carried one, so a caller can prefer its own focus. */
  current?: number;
}

const SINGLE = /^-?\d+$/;
const RANGE = /^(-?\d+)\s*[:：-]\s*(-?\d+)$/;
const PARENTHESIZED_ONLY = /^[（(]\s*(-?\d+)\s*[)）]$/u;
const PARENTHESIZED_TAIL = /\s*[（(]\s*(-?\d+)\s*[)）]\s*$/u;
const COMMA = /[,，]/u;
const WHITESPACE = /\s+/u;

/** Keep valid unique line indices in ascending order. */
function normalizedLines(lines: readonly number[]): number[] {
  return [...new Set(lines.filter((line) => Number.isInteger(line) && line >= 0))].sort(
    (left, right) => left - right,
  );
}

/**
 * Write sorted line indices as the compact form the field shows: consecutive
 * runs become `start-end`, and separate runs are comma-separated. The result is
 * always accepted by `parseLineSelectionInput`.
 */
export function formatLineSelection(lines: readonly number[]): string {
  const sorted = normalizedLines(lines);
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
 * The multi-line field's text: the compact union plus its active line in
 * parentheses, or the single line by itself.
 */
export function formatLineSelectionDisplay(lines: readonly number[], activeLine: number): string {
  const sorted = normalizedLines(lines);
  if (!sorted.length) {
    return "";
  }
  const text = formatLineSelection(sorted);
  if (sorted.length <= 1) {
    return text;
  }
  const active = Number.isInteger(activeLine) && activeLine >= 0 ? activeLine : sorted[0];
  return `${text} (${active})`;
}

/** Remove a trailing `(X)` annotation and read its line, when one is present. */
function splitAnnotations(text: string): { selection: string; current: number | null } {
  const only = PARENTHESIZED_ONLY.exec(text);
  if (only) {
    return { selection: only[1], current: Number(only[1]) };
  }
  const tail = PARENTHESIZED_TAIL.exec(text);
  if (!tail) {
    return { selection: text, current: null };
  }
  return {
    selection: text.slice(0, tail.index).trim(),
    current: Number(tail[1]),
  };
}

/** Split one selection text into tokens, accepting comma and whitespace separators. */
function selectionTokens(text: string): string[] {
  const tokens: string[] = [];
  for (const part of text.split(COMMA)) {
    const trimmed = part.trim();
    if (!trimmed) {
      continue;
    }
    // A range may carry spaces around its operator; normalize them before the
    // remaining whitespace is treated as a separator.
    const normalized = trimmed.replace(/(\d)\s*([:：-])\s*(\d)/gu, "$1$2$3");
    tokens.push(...normalized.split(WHITESPACE));
  }
  return tokens;
}

/**
 * Read one typed line selection.
 *
 * Returns `null` for text that names no existing line, including an empty
 * field, a token that is neither an index nor a range, and a union whose parts
 * are all outside the document. The caller decides whether a refusal is an
 * error or simply leaves the current selection alone.
 */
export function parseLineSelectionInput(
  raw: string,
  available: readonly number[],
): LineSelectionInput | null {
  const text = raw.trim();
  if (!text || !available.length) {
    return null;
  }
  const { selection, current } = splitAnnotations(text);
  if (!selection) {
    return null;
  }
  const known = new Set(available);
  const minimum = Math.min(...available);
  const maximum = Math.max(...available);
  const clampIndex = (value: number): number => Math.min(maximum, Math.max(minimum, value));
  const lines = new Set<number>();
  for (const token of selectionTokens(selection)) {
    if (!token) {
      continue;
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
  // A union's annotation names the active line; on a single line it is only a
  // readable label (RPE writes a parent's index as `1(0)`), so the line itself
  // stays the selection.
  const annotation = current === null ? null : clampIndex(current);
  const carriesActive = sorted.length > 1 && annotation !== null;
  return {
    line: carriesActive ? annotation : sorted[0],
    lines: sorted,
    ...(carriesActive ? { current: annotation } : {}),
  };
}
