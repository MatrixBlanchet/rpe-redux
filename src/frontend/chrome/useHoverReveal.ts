/**
 * Pointer-driven reveal hook for chrome surfaces that open on hover.
 *
 * The hook owns the enter/leave dwells, the collapse delay, listener cleanup,
 * and the optional check that keeps a surface open while keyboard focus is
 * inside its container. Dwell values stay with the surface, so the drawer and
 * the rail can keep the timing their interaction was tuned for. The decision
 * layer lives in `hoverReveal.ts`; this file only maps DOM facts and timers onto
 * it.
 *
 * The caller owns the reveal state: `onExpand` and `onCollapse` must write the
 * matching value back through `open`, and `collapseDelayMs` requires
 * `onCollapse`.
 */
import { useCallback, useEffect, useRef, type RefObject } from "react";
import {
  createHoverRevealState,
  reduceHoverReveal,
  type HoverRevealEvent,
  type HoverRevealRules,
  type HoverRevealState,
} from "./hoverReveal.ts";

/** Options for one hover-revealed surface. */
export interface HoverRevealOptions {
  /** Element whose pointer and, when enabled, focus events drive the reveal. */
  containerRef: RefObject<HTMLElement | null>;
  /** Whether the surface is currently revealed. */
  open: boolean;
  /** Pointer dwell before a collapsed surface reveals. */
  expandDelayMs: number;
  /** Pointer absence before a revealed surface collapses; omit for reveal-only surfaces. */
  collapseDelayMs?: number;
  /** Reveals the surface. */
  onExpand(): void;
  /** Hides the surface; required when `collapseDelayMs` is set. */
  onCollapse?(): void;
  /** Keep the surface revealed while focus is inside the container; defaults to true. */
  holdWhileFocusInside?: boolean;
  /** Reveal or hold for keyboard focus; pointer-only surfaces set false. */
  focusReveal?: boolean;
  /** Keeps the surface revealed while a host-owned condition is true. */
  holdOpen?: boolean;
  /** Enable pointer and, when enabled, focus listeners; defaults to true. */
  enabled?: boolean;
}

/** A pending window timeout slot. */
interface TimerSlot {
  current: number | null;
}

/** Cancels a pending timeout and clears its slot. */
function stopTimer(timer: TimerSlot): void {
  if (timer.current !== null) {
    window.clearTimeout(timer.current);
    timer.current = null;
  }
}

/** Latest callbacks and delays, read by the stable dispatch function. */
interface RevealSettings {
  expandDelayMs: number;
  collapseDelayMs: number | undefined;
  holdWhileFocusInside: boolean;
  focusReveal: boolean;
  holdOpen: boolean;
  onExpand(): void;
  onCollapse?: () => void;
}

/** Applies pointer and focus intent as a timed, controlled reveal. */
export function useHoverReveal({
  containerRef,
  open,
  expandDelayMs,
  collapseDelayMs,
  onExpand,
  onCollapse,
  holdWhileFocusInside = true,
  focusReveal = true,
  holdOpen = false,
  enabled = true,
}: HoverRevealOptions): void {
  const expandTimer = useRef<number | null>(null);
  const collapseTimer = useRef<number | null>(null);
  /** The next collapse is ending a host hold and bypasses focus. */
  const forceCollapse = useRef(false);
  const reveal = useRef<HoverRevealState>(createHoverRevealState(open));
  const settings = useRef<RevealSettings>({
    expandDelayMs,
    collapseDelayMs,
    holdWhileFocusInside,
    focusReveal,
    holdOpen,
    onExpand,
    onCollapse,
  });
  settings.current = {
    expandDelayMs,
    collapseDelayMs,
    holdWhileFocusInside,
    focusReveal,
    holdOpen,
    onExpand,
    onCollapse,
  };

  const dispatch = useCallback(
    (event: HoverRevealEvent): void => {
      const current = settings.current;
      const rules: HoverRevealRules = {
        collapseEnabled: current.collapseDelayMs !== undefined,
        holdWhileFocusInside: current.focusReveal && current.holdWhileFocusInside,
        holdOpen: current.holdOpen,
      };
      const outcome = reduceHoverReveal(reveal.current, event, rules);
      reveal.current = outcome.state;
      if (outcome.cancelExpand) {
        stopTimer(expandTimer);
      }
      if (outcome.cancelCollapse) {
        stopTimer(collapseTimer);
        forceCollapse.current = false;
      }
      if (outcome.expandNow) {
        current.onExpand();
      }
      if (outcome.collapseNow) {
        forceCollapse.current = false;
        current.onCollapse?.();
      }
      if (outcome.scheduleExpand) {
        expandTimer.current = window.setTimeout(() => {
          expandTimer.current = null;
          dispatch({ type: "expand-elapsed" });
        }, current.expandDelayMs);
      }
      if (outcome.scheduleCollapse && current.collapseDelayMs !== undefined) {
        collapseTimer.current = window.setTimeout(() => {
          collapseTimer.current = null;
          const container = containerRef.current;
          const ignoreFocus = forceCollapse.current;
          forceCollapse.current = false;
          dispatch({
            type: "collapse-elapsed",
            focusInside: ignoreFocus
              ? false
              : (container?.contains(document.activeElement) ?? false),
          });
        }, current.collapseDelayMs);
      }
    },
    [containerRef],
  );

  // The surface owns the reveal state; mirror controlled changes so an outside
  // press or close cancels a dwell that would otherwise fire against it.
  useEffect(() => {
    dispatch({ type: "open-changed", open });
  }, [dispatch, open]);

  // Releasing the hold resumes the ordinary pointer collapse path, while
  // starting one cancels a collapse that was already scheduled.
  const held = useRef(holdOpen);
  useEffect(() => {
    if (held.current === holdOpen) {
      return;
    }
    held.current = holdOpen;
    dispatch({ type: "hold-changed", holdOpen });
    // Releasing the hold must not be defeated by focus that a control returned
    // to its trigger. Only a collapse that this release scheduled is forced.
    forceCollapse.current = !holdOpen && reveal.current.collapsePending;
  }, [dispatch, holdOpen]);

  useEffect(() => {
    const container = containerRef.current;
    if (!enabled || !container) {
      return undefined;
    }

    const onPointerEnter = (): void => dispatch({ type: "pointer-enter" });
    const onPointerLeave = (): void => dispatch({ type: "pointer-leave" });
    const onFocusIn = (): void => dispatch({ type: "focus-in" });
    const onFocusOut = (event: FocusEvent): void => {
      const next = event.relatedTarget;
      dispatch({
        type: "focus-out",
        focusStaysInside: next instanceof Node && container.contains(next),
      });
    };

    container.addEventListener("pointerenter", onPointerEnter);
    container.addEventListener("pointerleave", onPointerLeave);
    if (focusReveal) {
      container.addEventListener("focusin", onFocusIn);
      container.addEventListener("focusout", onFocusOut);
    }
    // The pointer can already be over the container when it mounts, where no
    // pointerenter fires. Seed the dwell from the live hover state so a surface
    // that opens under an idle pointer starts its collapse delay.
    dispatch({ type: container.matches(":hover") ? "pointer-enter" : "pointer-leave" });
    return () => {
      container.removeEventListener("pointerenter", onPointerEnter);
      container.removeEventListener("pointerleave", onPointerLeave);
      if (focusReveal) {
        container.removeEventListener("focusin", onFocusIn);
        container.removeEventListener("focusout", onFocusOut);
      }
      stopTimer(expandTimer);
      stopTimer(collapseTimer);
      reveal.current = {
        ...reveal.current,
        expandPending: false,
        collapsePending: false,
      };
    };
  }, [containerRef, dispatch, enabled, focusReveal]);
}
