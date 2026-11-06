/**
 * Shift-drag marquee selection for the judge-line tree.
 *
 * The rectangle unions every intersecting row with the selection captured at
 * pointerdown, so a drag adds to an existing multi-selection. Releasing without
 * movement falls back to a Shift-click toggle. Window listeners are installed
 * for one gesture and removed on release, cancel, blur, or unmount.
 */
import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";
import type { JudgeLine } from "../../../../../core/global/chart/chart.ts";
import { lineTreeKey } from "./lineTreeModel.ts";

const MARQUEE_THRESHOLD = 4;

/** The visible selection rectangle plus the row keys it covers. */
export interface MarqueeBox {
  left: number;
  top: number;
  width: number;
  height: number;
  hits: ReadonlySet<string>;
}

interface MarqueeGesture {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  startKey: string | null;
  initial: Set<string>;
  hits: Set<string>;
  moved: boolean;
}

interface MarqueeOptions {
  listRef: RefObject<HTMLDivElement | null>;
  lines: readonly JudgeLine[];
  selectedIds: ReadonlySet<string>;
  lineIndices: ReadonlyMap<string, number>;
  focusAfterRemoval(removed: number, next: ReadonlySet<string>): number;
  currentScroll(): number;
  onSelectionChange(ids: ReadonlySet<string>): void;
  onSelectLine(index: number, scrollTop: number): void;
}

/** Marquee state and the pointerdown entry point for the tree surface. */
export function useLineTreeMarquee({
  listRef,
  lines,
  selectedIds,
  lineIndices,
  focusAfterRemoval,
  currentScroll,
  onSelectionChange,
  onSelectLine,
}: MarqueeOptions) {
  const [marquee, setMarquee] = useState<MarqueeBox | null>(null);
  const marqueeRef = useRef<MarqueeGesture | null>(null);
  const marqueeCleanup = useRef<(() => void) | null>(null);

  useEffect(
    () => () => {
      marqueeCleanup.current?.();
    },
    [],
  );

  const beginMarquee = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || !event.shiftKey) {
      return;
    }
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }
    if (
      target.closest(
        "button, a, input, select, textarea, [role='button'], [contenteditable='true']",
      )
    ) {
      return;
    }
    const row = target.closest<HTMLElement>("[data-line-index]");
    const startIndex = row ? Number(row.dataset.lineIndex) : NaN;
    const startKey =
      Number.isInteger(startIndex) && startIndex >= 0 && startIndex < lines.length
        ? lineTreeKey(lines, startIndex)
        : null;
    event.preventDefault();
    const gesture: MarqueeGesture = {
      startX: event.clientX,
      startY: event.clientY,
      currentX: event.clientX,
      currentY: event.clientY,
      startKey,
      initial: new Set(selectedIds),
      hits: new Set(selectedIds),
      moved: false,
    };
    marqueeRef.current = gesture;
    marqueeCleanup.current?.();

    const cleanup = () => {
      window.removeEventListener("pointermove", move, true);
      window.removeEventListener("pointerup", finish, true);
      window.removeEventListener("pointercancel", cancel, true);
      window.removeEventListener("blur", cancel);
      marqueeCleanup.current = null;
    };

    const move = (pointer: PointerEvent) => {
      const current = marqueeRef.current;
      if (!current) {
        return;
      }
      current.currentX = pointer.clientX;
      current.currentY = pointer.clientY;
      if (
        !current.moved &&
        Math.hypot(current.currentX - current.startX, current.currentY - current.startY) <
          MARQUEE_THRESHOLD
      ) {
        return;
      }
      current.moved = true;
      const left = Math.min(current.startX, current.currentX);
      const top = Math.min(current.startY, current.currentY);
      const right = Math.max(current.startX, current.currentX);
      const bottom = Math.max(current.startY, current.currentY);
      const hits = new Set(current.initial);
      const root = listRef.current;
      if (root) {
        for (const node of root.querySelectorAll<HTMLElement>("[data-line-index]")) {
          if (node.closest("[inert]")) {
            continue;
          }
          const index = Number(node.dataset.lineIndex);
          if (!Number.isInteger(index) || index < 0 || index >= lines.length) {
            continue;
          }
          const box = node.getBoundingClientRect();
          if (box.bottom < top || box.top > bottom || box.right < left || box.left > right) {
            continue;
          }
          hits.add(lineTreeKey(lines, index));
        }
      }
      current.hits = hits;
      setMarquee({ left, top, width: right - left, height: bottom - top, hits });
    };

    const blockNextClick = () => {
      // Browser click dispatch follows pointerup and would otherwise re-run the
      // row's own click handler over the selection this gesture just made.
      const blockClick = (click: MouseEvent) => {
        click.preventDefault();
        click.stopImmediatePropagation();
        window.removeEventListener("click", blockClick, true);
      };
      window.addEventListener("click", blockClick, true);
      window.setTimeout(() => window.removeEventListener("click", blockClick, true), 300);
    };

    const finish = () => {
      const current = marqueeRef.current;
      cleanup();
      marqueeRef.current = null;
      setMarquee(null);
      if (!current) {
        return;
      }
      if (!current.moved) {
        if (!current.startKey) {
          return;
        }
        blockNextClick();
        const index = lineIndices.get(current.startKey);
        if (index === undefined) {
          return;
        }
        const next = new Set(current.initial);
        if (next.has(current.startKey)) {
          if (next.size > 1) {
            next.delete(current.startKey);
          }
        } else {
          next.add(current.startKey);
        }
        if (!next.size) {
          next.add(current.startKey);
        }
        const focusIndex = next.has(current.startKey) ? index : focusAfterRemoval(index, next);
        onSelectionChange(next);
        onSelectLine(focusIndex, currentScroll());
        return;
      }
      blockNextClick();
      const changed =
        current.hits.size !== current.initial.size ||
        [...current.hits].some((id) => !current.initial.has(id));
      if (!changed) {
        return;
      }
      const hitIndices = [...current.hits]
        .flatMap((id) => {
          const index = lineIndices.get(id);
          return index === undefined ? [] : [index];
        })
        .sort((left, right) => left - right);
      if (!hitIndices.length) {
        return;
      }
      const focus = hitIndices[0];
      onSelectionChange(new Set(current.hits));
      onSelectLine(focus, currentScroll());
    };

    const cancel = () => {
      cleanup();
      marqueeRef.current = null;
      setMarquee(null);
    };

    marqueeCleanup.current = cleanup;
    window.addEventListener("pointermove", move, true);
    window.addEventListener("pointerup", finish, true);
    window.addEventListener("pointercancel", cancel, true);
    window.addEventListener("blur", cancel);
  };

  return { marquee, beginMarquee };
}
