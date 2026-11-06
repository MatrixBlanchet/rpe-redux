/**
 * Pure reveal decisions for pointer-and-focus hover surfaces.
 *
 * `useHoverReveal` maps DOM events and timer expiries onto this reducer. The
 * reducer tracks the pointer, the controlled reveal state, and the pending
 * dwells, and it decides whether a collapse may run while keyboard focus is
 * still inside the surface. It owns no timers or DOM, so the drawer's focus
 * guard is testable without a browser.
 */

/** The reveal options that change a transition's decision. */
export interface HoverRevealRules {
  /** The surface collapses after pointer absence. */
  collapseEnabled: boolean;
  /** Focus inside the container postpones a pending collapse. */
  holdWhileFocusInside: boolean;
  /** An open floating surface keeps the reveal open. */
  holdOpen?: boolean;
}

/** The surface's pointer, reveal, and pending-timer state. */
export interface HoverRevealState {
  /** The controlled reveal state last confirmed by the surface. */
  open: boolean;
  /** The pointer is over the container. */
  pointerInside: boolean;
  /** An expand dwell is running. */
  expandPending: boolean;
  /** A collapse delay is running. */
  collapsePending: boolean;
}

/** One input fact that can change the reveal. */
export type HoverRevealEvent =
  | { type: "pointer-enter" }
  | { type: "pointer-leave" }
  | { type: "focus-in" }
  | { type: "focus-out"; focusStaysInside: boolean }
  | { type: "expand-elapsed" }
  | { type: "collapse-elapsed"; focusInside: boolean }
  | { type: "hold-changed"; holdOpen: boolean }
  | { type: "open-changed"; open: boolean };

/** The timer and callback work a transition asks the caller to perform. */
export interface HoverRevealOutcome {
  /** The state to keep for the next event. */
  state: HoverRevealState;
  /** Reveal now because focus entered. */
  expandNow: boolean;
  /** Start the expand dwell. */
  scheduleExpand: boolean;
  /** Cancel a running expand dwell. */
  cancelExpand: boolean;
  /** Hide the surface now. */
  collapseNow: boolean;
  /** Start the collapse delay. */
  scheduleCollapse: boolean;
  /** Cancel a running collapse delay. */
  cancelCollapse: boolean;
}

/** Fresh state for a mounted surface with the given controlled reveal. */
export function createHoverRevealState(open: boolean): HoverRevealState {
  return {
    open,
    pointerInside: false,
    expandPending: false,
    collapsePending: false,
  };
}

/** Builds an outcome with every action cleared unless overridden. */
function transition(
  state: HoverRevealState,
  changes: Partial<Omit<HoverRevealOutcome, "state">> = {},
): HoverRevealOutcome {
  return {
    state,
    expandNow: false,
    scheduleExpand: false,
    cancelExpand: false,
    collapseNow: false,
    scheduleCollapse: false,
    cancelCollapse: false,
    ...changes,
  };
}

/**
 * Applies one pointer, focus, timer, or controlled-state event.
 *
 * Focus reveals immediately. A pointer dwell only reveals while the pointer
 * stays inside, and leaving reverses a pending dwell. A collapse whose delay
 * elapses with focus still inside is dropped rather than rescheduled: the
 * following focus-out starts the delay again, so focus that stays in the
 * drawer list cannot clip the list behind its own edge.
 */
export function reduceHoverReveal(
  state: HoverRevealState,
  event: HoverRevealEvent,
  rules: HoverRevealRules,
): HoverRevealOutcome {
  switch (event.type) {
    case "pointer-enter": {
      const next = { ...state, pointerInside: true };
      if (next.open) {
        return transition(next, { cancelCollapse: next.collapsePending });
      }
      if (next.expandPending) {
        return transition(next);
      }
      return transition({ ...next, expandPending: true }, { scheduleExpand: true });
    }
    case "pointer-leave": {
      const next = { ...state, pointerInside: false, expandPending: false };
      const cancelled = { cancelExpand: state.expandPending };
      if (!next.open || !rules.collapseEnabled) {
        return transition(next, cancelled);
      }
      if (rules.holdOpen) {
        return transition(
          { ...next, collapsePending: false },
          { ...cancelled, cancelCollapse: state.collapsePending },
        );
      }
      if (next.collapsePending) {
        return transition(next, cancelled);
      }
      return transition(
        { ...next, collapsePending: true },
        { ...cancelled, scheduleCollapse: true },
      );
    }
    case "focus-in": {
      const next = {
        ...state,
        open: true,
        expandPending: false,
        collapsePending: false,
      };
      return transition(next, {
        expandNow: !state.open,
        cancelExpand: state.expandPending,
        cancelCollapse: state.collapsePending,
      });
    }
    case "focus-out": {
      // The pointer still holds the surface open, so focus leaving alone does
      // not start the collapse delay.
      if (event.focusStaysInside || state.pointerInside) {
        return transition(state);
      }
      if (rules.holdOpen) {
        return transition(
          { ...state, collapsePending: false },
          { cancelCollapse: state.collapsePending },
        );
      }
      if (!state.open || !rules.collapseEnabled || state.collapsePending) {
        return transition(state);
      }
      return transition({ ...state, collapsePending: true }, { scheduleCollapse: true });
    }
    case "expand-elapsed": {
      const next = { ...state, expandPending: false };
      if (next.open || !next.pointerInside) {
        return transition(next);
      }
      return transition({ ...next, open: true }, { expandNow: true });
    }
    case "collapse-elapsed": {
      const next = { ...state, collapsePending: false };
      if (!next.open || next.pointerInside || !rules.collapseEnabled || rules.holdOpen) {
        return transition(next);
      }
      if (rules.holdWhileFocusInside && event.focusInside) {
        return transition(next);
      }
      return transition({ ...next, open: false }, { collapseNow: true });
    }
    case "hold-changed": {
      if (event.holdOpen) {
        // A hold also reveals a collapsed surface: the owner uses it for a
        // guided step that must show the full list, not just stop a collapse
        // that never started.
        return transition(
          { ...state, open: true, expandPending: false, collapsePending: false },
          {
            expandNow: !state.open,
            cancelExpand: state.expandPending,
            cancelCollapse: state.collapsePending,
          },
        );
      }
      if (!state.open || state.pointerInside || !rules.collapseEnabled || state.collapsePending) {
        return transition(state);
      }
      return transition({ ...state, collapsePending: true }, { scheduleCollapse: true });
    }
    case "open-changed": {
      if (event.open === state.open) {
        return transition(state);
      }
      const next = event.open
        ? { ...state, open: true, expandPending: false }
        : { ...state, open: false, expandPending: false, collapsePending: false };
      return transition(next, {
        cancelExpand: state.expandPending,
        cancelCollapse: state.collapsePending,
      });
    }
  }
}
