/**
 * Reads PhiEdit PEC text into the editor's RPE chart.
 *
 * PEC has one BPM list, one fixed set of line tracks, a 30-line limit and no
 * chart metadata. This parser maps its position/rotation/opacity/speed commands
 * and note continuations into RPE events. The writer lives in `pec.ts`.
 */
import { type JudgeLine } from "../chart.ts";
import { fromNumber } from "../timing/beat.ts";
import {
  PEC_MAX_LINES,
  PEC_NOTE_TO_RPE,
  PEC_LINE_CENTER_X,
  PEC_LINE_CENTER_Y,
  PEC_LINE_HALF_HEIGHT,
  PEC_LINE_HALF_WIDTH,
  RPE_LINE_HALF_HEIGHT,
  RPE_LINE_HALF_WIDTH,
  RPE_SPEED_PER_PEC_SPEED,
  type ConvertedExternalChart,
  type ExternalChartMetadata,
  emptyLayer,
  makeChart,
  makeEvent,
  makeLine,
  makeNote,
  roundNumber,
  updateNoteCount,
} from "./common.ts";

/** PEC's first line is an offset whose meaningful value is this much lower. */
export const PEC_OFFSET_BIAS = 175;

/** One PEC movement keyframe. */
interface PecPosition {
  beat: number;
  x: number;
  y: number;
}

/** One PEC movement interval; its start value is the preceding line state. */
interface PecMoveMotion {
  start: number;
  end: number;
  x: number;
  y: number;
  easing: number;
}

/** One PEC rotate/fade interval; its start value is the preceding line state. */
interface PecScalarMotion {
  start: number;
  end: number;
  value: number;
  easing: number;
}

/** One PEC numeric keyframe. */
interface PecKeyframe {
  beat: number;
  value: number;
}

/** One parsed note, before the chart range is known. */
interface PecNote {
  type: number;
  start: number;
  end: number;
  x: number;
  above: 1 | 2;
  fake: number;
  speed: number;
  size: number;
}

/** Every command belonging to one PEC line. */
interface PecLine {
  positions: PecPosition[];
  motions: PecMoveMotion[];
  degrees: PecKeyframe[];
  rotations: PecScalarMotion[];
  alphas: PecKeyframe[];
  fades: PecScalarMotion[];
  speeds: PecKeyframe[];
  notes: PecNote[];
}

/** Collects unique warnings. */
export class WarningLog {
  private readonly seen = new Set<string>();
  readonly values: string[] = [];

  add(message: string): void {
    if (!this.seen.has(message)) {
      this.seen.add(message);
      this.values.push(message);
    }
  }
}

/** A fresh PEC line bucket. */
function emptyLine(): PecLine {
  return {
    positions: [],
    motions: [],
    degrees: [],
    rotations: [],
    alphas: [],
    fades: [],
    speeds: [],
    notes: [],
  };
}

/** Number tokens after a command name. */
function numbers(tokens: readonly string[], start: number, count: number): number[] | null {
  if (tokens.length < start + count) {
    return null;
  }
  const result: number[] = [];
  for (let index = 0; index < count; index++) {
    const value = Number(tokens[start + index]);
    if (!Number.isFinite(value)) {
      return null;
    }
    result.push(value);
  }
  return result;
}

/** Read a PEC chart text into a valid RPE chart. */
export function parsePecChart(
  text: string,
  metadata: ExternalChartMetadata = {},
): ConvertedExternalChart {
  const warnings = new WarningLog();
  const source = text.replace(/^\uFEFF/, "").split(/\r?\n/);
  let offset = 0;
  let firstContent = true;
  let pendingNote: PecNote | null = null;
  const bpm: { beat: number; bpm: number }[] = [];
  const lines = new Map<number, PecLine>();
  let maxLine = 0;

  const lineFor = (index: number): PecLine => {
    if (!Number.isInteger(index) || index < 0 || index >= PEC_MAX_LINES) {
      throw new Error(`PEC uses judge line index ${index}, outside the 30-line limit.`);
    }
    maxLine = Math.max(maxLine, index);
    let line = lines.get(index);
    if (!line) {
      line = emptyLine();
      lines.set(index, line);
    }
    return line;
  };

  for (const raw of source) {
    const line = raw.trim();
    if (!line || line.startsWith("//")) {
      continue;
    }
    if (firstContent) {
      firstContent = false;
      const value = Number(line);
      if (Number.isFinite(value)) {
        offset = value;
        continue;
      }
    }
    if (line.startsWith("#")) {
      if (pendingNote) {
        const value = Number(line.slice(1).trim());
        if (Number.isFinite(value)) {
          pendingNote.speed = Math.max(0, value);
        }
      }
      continue;
    }
    if (line.startsWith("&")) {
      if (pendingNote) {
        const value = Number(line.slice(1).trim());
        if (Number.isFinite(value)) {
          pendingNote.size = Math.max(0, value);
        }
      }
      continue;
    }
    const tokens = line.replaceAll(",", " ").split(/\s+/);
    const command = tokens[0]?.toLowerCase();
    if (!command) {
      continue;
    }
    if (command === "bp" || command === "bpm") {
      const values = numbers(tokens, 1, 2);
      if (values) {
        bpm.push({ beat: values[0], bpm: values[1] });
      }
      continue;
    }
    if (command === "cp" || command === "cposition") {
      const values = numbers(tokens, 1, 4);
      const target = values ? lineFor(values[0]) : null;
      if (values && target) {
        target.positions.push({ beat: values[1], x: values[2], y: values[3] });
      }
      continue;
    }
    if (command === "cm" || command === "cmotion") {
      const values = numbers(tokens, 1, 6);
      const target = values ? lineFor(values[0]) : null;
      if (values && target) {
        target.motions.push({
          start: values[1],
          end: values[2],
          x: values[3],
          y: values[4],
          easing: values[5],
        });
      }
      continue;
    }
    if (command === "cd" || command === "cdegree") {
      const values = numbers(tokens, 1, 3);
      const target = values ? lineFor(values[0]) : null;
      if (values && target) {
        target.degrees.push({ beat: values[1], value: values[2] });
      }
      continue;
    }
    if (command === "cr" || command === "crotate") {
      const values = numbers(tokens, 1, 5);
      const target = values ? lineFor(values[0]) : null;
      if (values && target) {
        target.rotations.push({
          start: values[1],
          end: values[2],
          value: values[3],
          easing: values[4],
        });
      }
      continue;
    }
    if (command === "ca" || command === "calpha") {
      const values = numbers(tokens, 1, 3);
      const target = values ? lineFor(values[0]) : null;
      if (values && target) {
        target.alphas.push({ beat: values[1], value: values[2] });
      }
      continue;
    }
    if (command === "cf" || command === "cfade") {
      // Older PhiEdit exports omit the easing token; PEC treats that form as
      // linear. Newer writers may include it, so accept both arities.
      const values = numbers(tokens, 1, 4);
      const easing = tokens.length > 5 ? Number(tokens[5]) : 1;
      const target = values ? lineFor(values[0]) : null;
      if (values && target && Number.isFinite(easing)) {
        target.fades.push({
          start: values[1],
          end: values[2],
          value: values[3],
          easing,
        });
      }
      continue;
    }
    if (command === "cv" || command === "cvelocity") {
      const values = numbers(tokens, 1, 3);
      const target = values ? lineFor(values[0]) : null;
      if (values && target) {
        target.speeds.push({ beat: values[1], value: values[2] });
      }
      continue;
    }
    if (command === "n1" || command === "n3" || command === "n4") {
      const values = numbers(tokens, 1, 5);
      const target = values ? lineFor(values[0]) : null;
      if (values && target) {
        const note: PecNote = {
          type: PEC_NOTE_TO_RPE[command] ?? 1,
          start: values[1],
          end: values[1],
          x: values[2],
          above: values[3] === 1 ? 1 : 2,
          fake: values[4] === 1 ? 1 : 0,
          speed: 1,
          size: 1,
        };
        target.notes.push(note);
        pendingNote = note;
      }
      continue;
    }
    if (command === "n2") {
      const values = numbers(tokens, 1, 6);
      const target = values ? lineFor(values[0]) : null;
      if (values && target) {
        const note: PecNote = {
          type: 2,
          start: values[1],
          end: values[2],
          x: values[3],
          above: values[4] === 1 ? 1 : 2,
          fake: values[5] === 1 ? 1 : 0,
          speed: 1,
          size: 1,
        };
        target.notes.push(note);
        pendingNote = note;
      }
      continue;
    }
    warnings.add(`Unknown PEC command was ignored: ${command}`);
  }

  const noteCenterX = (() => {
    let minimum = Infinity;
    let maximum = -Infinity;
    for (const line of lines.values()) {
      for (const note of line.notes) {
        minimum = Math.min(minimum, note.x);
        maximum = Math.max(maximum, note.x);
      }
    }
    return minimum >= 0 && maximum > PEC_LINE_HALF_WIDTH ? PEC_LINE_CENTER_X : 0;
  })();

  let endBeat = 1;
  for (const line of lines.values()) {
    for (const motion of line.motions) {
      endBeat = Math.max(endBeat, motion.end);
    }
    for (const rotation of line.rotations) {
      endBeat = Math.max(endBeat, rotation.end);
    }
    for (const fade of line.fades) {
      endBeat = Math.max(endBeat, fade.end);
    }
    for (const key of [...line.positions, ...line.degrees, ...line.alphas, ...line.speeds]) {
      endBeat = Math.max(endBeat, key.beat);
    }
    for (const note of line.notes) {
      endBeat = Math.max(endBeat, note.end);
    }
  }
  endBeat = Math.max(1, endBeat + 1);

  const bpmList = bpm
    .filter((entry) => Number.isFinite(entry.beat) && Number.isFinite(entry.bpm) && entry.bpm > 0)
    .sort((left, right) => left.beat - right.beat);
  if (!bpmList.length || bpmList[0].beat > 0) {
    bpmList.unshift({ beat: 0, bpm: bpmList[0]?.bpm ?? 120 });
  }

  const lineCount = Math.max(1, maxLine + 1);
  const outputLines: JudgeLine[] = [];
  for (let index = 0; index < lineCount; index++) {
    const sourceLine = lines.get(index) ?? emptyLine();
    const layer = emptyLayer();
    const moveEvents = buildMoveEvents(
      sourceLine.positions,
      sourceLine.motions,
      endBeat,
      PEC_LINE_CENTER_X,
      PEC_LINE_CENTER_Y,
    );
    layer.moveXEvents = moveEvents.map((entry) =>
      makeEvent(
        entry.start,
        entry.end,
        toRpeLineX(entry.startX),
        toRpeLineX(entry.endX),
        entry.easing,
      ),
    );
    layer.moveYEvents = moveEvents.map((entry) =>
      makeEvent(
        entry.start,
        entry.end,
        toRpeLineY(entry.startY),
        toRpeLineY(entry.endY),
        entry.easing,
      ),
    );
    layer.rotateEvents = buildScalarEvents(
      sourceLine.degrees,
      sourceLine.rotations,
      endBeat,
      0,
    ).map((entry) =>
      makeEvent(entry.start, entry.end, entry.startValue, entry.endValue, entry.easing),
    );
    layer.alphaEvents = buildScalarEvents(sourceLine.alphas, sourceLine.fades, endBeat, 255).map(
      (entry) => makeEvent(entry.start, entry.end, entry.startValue, entry.endValue, entry.easing),
    );
    layer.speedEvents = keyframes(
      sourceLine.speeds.map((speed) => ({ beat: speed.beat, value: speed.value })),
      endBeat,
      10,
    ).map((entry) =>
      makeEvent(
        entry.start,
        entry.end,
        entry.startValue * RPE_SPEED_PER_PEC_SPEED,
        entry.endValue * RPE_SPEED_PER_PEC_SPEED,
      ),
    );
    const line = makeLine(`Line ${index + 1}`, index, layer);
    line.notes = sourceLine.notes.map((note) => {
      const positionX = (note.x - noteCenterX) * (RPE_LINE_HALF_WIDTH / PEC_LINE_HALF_WIDTH);
      return makeNote(
        note.type,
        note.start,
        note.end,
        positionX,
        note.above,
        note.speed,
        note.size,
        note.fake,
      );
    });
    updateNoteCount(line);
    outputLines.push(line);
  }

  const chart = makeChart(
    metadata,
    bpmList[0].bpm,
    metadata.offsetMs ?? offset - PEC_OFFSET_BIAS,
    outputLines,
  );
  chart.BPMList = bpmList.map((entry) => ({
    bpm: roundNumber(entry.bpm, 6),
    startTime: fromNumber(entry.beat),
  }));
  return { chart, warnings: warnings.values };
}

/** PEC line X -> RPE line X. */
function toRpeLineX(value: number): number {
  return ((value - PEC_LINE_CENTER_X) / PEC_LINE_HALF_WIDTH) * RPE_LINE_HALF_WIDTH;
}

/** PEC line Y -> RPE line Y. */
function toRpeLineY(value: number): number {
  return ((value - PEC_LINE_CENTER_Y) / PEC_LINE_HALF_HEIGHT) * RPE_LINE_HALF_HEIGHT;
}

/** RPE line X -> PEC line X. */
export function toPecLineX(value: number): number {
  return PEC_LINE_CENTER_X + (value / RPE_LINE_HALF_WIDTH) * PEC_LINE_HALF_WIDTH;
}

/** RPE line Y -> PEC line Y. */
export function toPecLineY(value: number): number {
  return PEC_LINE_CENTER_Y + (value / RPE_LINE_HALF_HEIGHT) * PEC_LINE_HALF_HEIGHT;
}

/** One interval from a sorted keyframe list, including the leading default. */
interface KeyframeInterval {
  start: number;
  end: number;
  startValue: number;
  endValue: number;
}

/** Turn keyframes into constant intervals, filling the range before the first. */
function keyframes(
  keys: readonly { beat: number; value: number }[],
  endBeat: number,
  fallback: number,
): KeyframeInterval[] {
  const sorted = keys
    .filter((key) => Number.isFinite(key.beat) && Number.isFinite(key.value))
    .slice()
    .sort((left, right) => left.beat - right.beat);
  if (!sorted.length) {
    return [{ start: 0, end: endBeat, startValue: fallback, endValue: fallback }];
  }
  const result: KeyframeInterval[] = [];
  if (sorted[0].beat > 0) {
    result.push({
      start: 0,
      end: sorted[0].beat,
      startValue: fallback,
      endValue: fallback,
    });
  }
  for (let index = 0; index < sorted.length; index++) {
    const current = sorted[index];
    const next = sorted[index + 1];
    result.push({
      start: current.beat,
      end: next?.beat ?? Math.max(endBeat, current.beat + 1),
      startValue: current.value,
      endValue: current.value,
    });
  }
  return result;
}

/** One resolved move interval. */
interface MoveEventSpec {
  start: number;
  end: number;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  easing: number;
}

/** One resolved scalar interval. */
interface ScalarEventSpec {
  start: number;
  end: number;
  startValue: number;
  endValue: number;
  easing: number;
}

/**
 * Resolve PEC position keyframes and move targets into contiguous intervals.
 *
 * `cm` carries only its target, so the starting value comes from the previous
 * `cp` or the end of the previous motion. Positions and motions are merged in
 * time order, with a position winning a same-beat tie because `cp` establishes
 * the origin of the motion that follows it.
 */
function buildMoveEvents(
  positions: readonly PecPosition[],
  motions: readonly PecMoveMotion[],
  endBeat: number,
  fallbackX: number,
  fallbackY: number,
): MoveEventSpec[] {
  const items = [
    ...positions.map((position) => ({ time: position.beat, position, motion: null })),
    ...motions.map((motion) => ({ time: motion.start, position: null, motion })),
  ].sort(
    (left, right) =>
      left.time - right.time || Number(left.position === null) - Number(right.position === null),
  );
  const events: MoveEventSpec[] = [];
  let currentBeat = 0;
  let currentX = fallbackX;
  let currentY = fallbackY;
  for (const item of items) {
    if (item.position) {
      if (item.time > currentBeat) {
        events.push({
          start: currentBeat,
          end: item.time,
          startX: currentX,
          startY: currentY,
          endX: currentX,
          endY: currentY,
          easing: 1,
        });
      }
      currentX = item.position.x;
      currentY = item.position.y;
      currentBeat = Math.max(currentBeat, item.time);
    } else if (item.motion) {
      const motion = item.motion;
      if (motion.start > currentBeat) {
        events.push({
          start: currentBeat,
          end: motion.start,
          startX: currentX,
          startY: currentY,
          endX: currentX,
          endY: currentY,
          easing: 1,
        });
      }
      events.push({
        start: motion.start,
        end: motion.end,
        startX: currentX,
        startY: currentY,
        endX: motion.x,
        endY: motion.y,
        easing: motion.easing,
      });
      currentX = motion.x;
      currentY = motion.y;
      currentBeat = Math.max(currentBeat, motion.end);
    }
  }
  if (currentBeat < endBeat) {
    events.push({
      start: currentBeat,
      end: endBeat,
      startX: currentX,
      startY: currentY,
      endX: currentX,
      endY: currentY,
      easing: 1,
    });
  }
  return events.length
    ? events
    : [
        {
          start: 0,
          end: endBeat,
          startX: fallbackX,
          startY: fallbackY,
          endX: fallbackX,
          endY: fallbackY,
          easing: 1,
        },
      ];
}

/** Resolve PEC scalar keyframes and rotate/fade targets into intervals. */
function buildScalarEvents(
  keys: readonly PecKeyframe[],
  motions: readonly PecScalarMotion[],
  endBeat: number,
  fallback: number,
): ScalarEventSpec[] {
  const items = [
    ...keys.map((key) => ({ time: key.beat, key, motion: null })),
    ...motions.map((motion) => ({ time: motion.start, key: null, motion })),
  ].sort(
    (left, right) =>
      left.time - right.time || Number(left.key === null) - Number(right.key === null),
  );
  const events: ScalarEventSpec[] = [];
  let currentBeat = 0;
  let current = fallback;
  for (const item of items) {
    if (item.key) {
      if (item.time > currentBeat) {
        events.push({
          start: currentBeat,
          end: item.time,
          startValue: current,
          endValue: current,
          easing: 1,
        });
      }
      current = item.key.value;
      currentBeat = Math.max(currentBeat, item.time);
    } else if (item.motion) {
      const motion = item.motion;
      if (motion.start > currentBeat) {
        events.push({
          start: currentBeat,
          end: motion.start,
          startValue: current,
          endValue: current,
          easing: 1,
        });
      }
      events.push({
        start: motion.start,
        end: motion.end,
        startValue: current,
        endValue: motion.value,
        easing: motion.easing,
      });
      current = motion.value;
      currentBeat = Math.max(currentBeat, motion.end);
    }
  }
  if (currentBeat < endBeat) {
    events.push({
      start: currentBeat,
      end: endBeat,
      startValue: current,
      endValue: current,
      easing: 1,
    });
  }
  return events.length
    ? events
    : [
        {
          start: 0,
          end: endBeat,
          startValue: fallback,
          endValue: fallback,
          easing: 1,
        },
      ];
}
