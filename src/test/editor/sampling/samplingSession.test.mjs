/** Sampling-session cancellation restores the anchors that existed on entry. */
import assert from "node:assert/strict";
import test from "node:test";
import {
  beginSamplingDrag,
  cancelSamplingDrag,
  samplingSession,
  setSamplingDraft,
} from "../../../frontend/screens/editor/sampling/samplingSession.ts";

test("cancelling a sampling attempt restores the original visible anchors", () => {
  const previous = samplingSession.get();
  const initial = {
    start: { axis: "alpha", scalar: 32 },
    end: { axis: "alpha", scalar: 224 },
  };
  samplingSession.set({
    target: {
      lineIndex: 0,
      eventType: "alphaEvents",
      eventIndex: 0,
      eventLayer: 0,
      axis: "alpha",
    },
    draft: { ...initial, curve: {} },
    initialAnchors: initial,
    easingType: 1,
    locked: false,
    dragging: false,
  });

  try {
    beginSamplingDrag();
    setSamplingDraft({ axis: "alpha", scalar: 80 }, { axis: "alpha", scalar: 160 });
    cancelSamplingDrag();

    const current = samplingSession.get();
    assert.deepEqual(current.draft.start, initial.start);
    assert.deepEqual(current.draft.end, initial.end);
    assert.equal(current.dragging, false);
    assert.equal(current.locked, false);
  } finally {
    samplingSession.set(previous);
  }
});
