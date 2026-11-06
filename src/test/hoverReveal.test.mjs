/**
 * The drawer list follows pointer dwells unless a guided step holds it open.
 * These tests drive the pure reducer behind `useHoverReveal` through pointer
 * leave, pointer-only collapse, holds, and the optional keyboard-focus guard
 * without a browser.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { createHoverRevealState, reduceHoverReveal } from "../frontend/chrome/hoverReveal.ts";

/** Generic collapsible rules: pointer absence collapses, focus can hold open. */
const COLLAPSIBLE = { collapseEnabled: true, holdWhileFocusInside: true };

/** The drawer's rules: pointer absence collapses even while focus is inside. */
const POINTER_ONLY = { collapseEnabled: true, holdWhileFocusInside: false };

/** Applies events in order and returns the final state plus the last outcome. */
function run(events, initial = createHoverRevealState(true), rules = COLLAPSIBLE) {
  let state = initial;
  let outcome = null;
  for (const event of events) {
    outcome = reduceHoverReveal(state, event, rules);
    state = outcome.state;
  }
  return { state, outcome };
}

test("pointer leave keeps a focus-guarded surface open while focus is inside", () => {
  const entered = run([{ type: "pointer-enter" }]);
  const left = reduceHoverReveal(entered.state, { type: "pointer-leave" }, COLLAPSIBLE);
  assert.equal(left.scheduleCollapse, true);
  assert.equal(left.state.collapsePending, true);

  const elapsed = reduceHoverReveal(
    left.state,
    { type: "collapse-elapsed", focusInside: true },
    COLLAPSIBLE,
  );
  assert.equal(elapsed.collapseNow, false);
  assert.equal(elapsed.state.open, true);
  assert.equal(elapsed.state.collapsePending, false);
});

test("focus leaving after the guarded collapse starts the delay again", () => {
  const { state: leftState } = run([{ type: "pointer-enter" }, { type: "pointer-leave" }]);
  const guarded = reduceHoverReveal(
    leftState,
    { type: "collapse-elapsed", focusInside: true },
    COLLAPSIBLE,
  );
  const focusOut = reduceHoverReveal(
    guarded.state,
    { type: "focus-out", focusStaysInside: false },
    COLLAPSIBLE,
  );
  assert.equal(focusOut.scheduleCollapse, true);

  const elapsed = reduceHoverReveal(
    focusOut.state,
    { type: "collapse-elapsed", focusInside: false },
    COLLAPSIBLE,
  );
  assert.equal(elapsed.collapseNow, true);
  assert.equal(elapsed.state.open, false);
});

test("focus moving between list controls does not start the collapse delay", () => {
  const { state } = run([{ type: "pointer-enter" }, { type: "pointer-leave" }]);
  const staysInside = reduceHoverReveal(
    state,
    { type: "focus-out", focusStaysInside: true },
    COLLAPSIBLE,
  );
  assert.equal(staysInside.scheduleCollapse, false);
  assert.equal(staysInside.state.open, true);
});

test("focus leaving while the pointer is still inside leaves the drawer open", () => {
  const { state } = run([{ type: "pointer-enter" }]);
  const focusOut = reduceHoverReveal(
    state,
    { type: "focus-out", focusStaysInside: false },
    COLLAPSIBLE,
  );
  assert.equal(focusOut.scheduleCollapse, false);
  assert.equal(focusOut.state.open, true);
});

test("focus entering a pending collapse cancels it", () => {
  const { state } = run([{ type: "pointer-enter" }, { type: "pointer-leave" }]);
  const focusIn = reduceHoverReveal(state, { type: "focus-in" }, COLLAPSIBLE);
  assert.equal(focusIn.cancelCollapse, true);
  assert.equal(focusIn.state.collapsePending, false);
  assert.equal(focusIn.state.open, true);
});

test("leaving during the expand dwell cancels the reveal", () => {
  const { state: entered } = run([{ type: "pointer-enter" }], createHoverRevealState(false));
  assert.equal(entered.expandPending, true);

  const left = reduceHoverReveal(entered, { type: "pointer-leave" }, COLLAPSIBLE);
  assert.equal(left.cancelExpand, true);
  assert.equal(left.state.expandPending, false);

  const elapsed = reduceHoverReveal(left.state, { type: "expand-elapsed" }, COLLAPSIBLE);
  assert.equal(elapsed.expandNow, false);
  assert.equal(elapsed.state.open, false);
});

test("a completed dwell reveals a collapsed drawer", () => {
  const { state: entered } = run([{ type: "pointer-enter" }], createHoverRevealState(false));
  const elapsed = reduceHoverReveal(entered, { type: "expand-elapsed" }, COLLAPSIBLE);
  assert.equal(elapsed.expandNow, true);
  assert.equal(elapsed.state.open, true);
});

test("an outside close cancels a pending collapse", () => {
  const { state } = run([{ type: "pointer-enter" }, { type: "pointer-leave" }]);
  const closed = reduceHoverReveal(state, { type: "open-changed", open: false }, COLLAPSIBLE);
  assert.equal(closed.cancelCollapse, true);
  assert.equal(closed.state.collapsePending, false);
  assert.equal(closed.state.open, false);
});

test("a reveal-only surface never schedules a collapse", () => {
  const revealOnly = { collapseEnabled: false, holdWhileFocusInside: true };
  const { state } = run([{ type: "pointer-enter" }]);
  const left = reduceHoverReveal(state, { type: "pointer-leave" }, revealOnly);
  assert.equal(left.scheduleCollapse, false);
  assert.equal(left.state.open, true);
});

test("a pointer-only drawer collapses even while focus stays inside", () => {
  const { state } = run([{ type: "pointer-enter" }], createHoverRevealState(true), POINTER_ONLY);
  const left = reduceHoverReveal(state, { type: "pointer-leave" }, POINTER_ONLY);
  const elapsed = reduceHoverReveal(
    left.state,
    { type: "collapse-elapsed", focusInside: true },
    POINTER_ONLY,
  );
  assert.equal(elapsed.collapseNow, true);
  assert.equal(elapsed.state.open, false);
});

test("an active hold keeps the drawer expanded after pointer leave", () => {
  const held = { ...COLLAPSIBLE, holdOpen: true };
  const { state } = run([{ type: "pointer-enter" }]);
  const left = reduceHoverReveal(state, { type: "pointer-leave" }, held);
  assert.equal(left.scheduleCollapse, false);
  assert.equal(left.state.collapsePending, false);
  assert.equal(left.state.open, true);
});

test("a hold reveals a collapsed drawer", () => {
  const held = { ...COLLAPSIBLE, holdOpen: true };
  const outcome = reduceHoverReveal(
    createHoverRevealState(false),
    { type: "hold-changed", holdOpen: true },
    held,
  );
  assert.equal(outcome.expandNow, true);
  assert.equal(outcome.state.open, true);
});

test("releasing the hold resumes the collapse path", () => {
  const held = { ...COLLAPSIBLE, holdOpen: true };
  const { state } = run([{ type: "pointer-enter" }, { type: "pointer-leave" }], undefined, held);
  const released = reduceHoverReveal(state, { type: "hold-changed", holdOpen: false }, COLLAPSIBLE);
  assert.equal(released.scheduleCollapse, true);
  assert.equal(released.state.collapsePending, true);

  const elapsed = reduceHoverReveal(
    released.state,
    { type: "collapse-elapsed", focusInside: false },
    COLLAPSIBLE,
  );
  assert.equal(elapsed.collapseNow, true);
  assert.equal(elapsed.state.open, false);
});

test("a hold acquired during the collapse delay cancels it", () => {
  const { state } = run([{ type: "pointer-enter" }, { type: "pointer-leave" }]);
  const held = reduceHoverReveal(
    state,
    { type: "hold-changed", holdOpen: true },
    { ...COLLAPSIBLE, holdOpen: true },
  );
  assert.equal(held.cancelCollapse, true);
  assert.equal(held.state.collapsePending, false);
  assert.equal(held.state.open, true);
});
