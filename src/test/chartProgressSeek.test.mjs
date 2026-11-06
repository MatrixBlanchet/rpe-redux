/** The scrubber's seek path runs the editor's seek once per distinct position. */
import assert from "node:assert/strict";
import test from "node:test";
import {
  createProgressState,
  seekProgress,
  setProgressSeekHandler,
} from "../frontend/chrome/transport/chartProgressState.ts";

test("a repeated seek to the current time reaches the editor once", () => {
  const progress = createProgressState();
  const seeks = [];
  const dispose = setProgressSeekHandler(progress, (seconds) => seeks.push(seconds));
  try {
    // The card starts at zero, so this position is already the playhead's.
    seekProgress(progress, 0);
    assert.deepEqual(seeks, []);

    seekProgress(progress, 2.5);
    seekProgress(progress, 2.5);
    assert.deepEqual(seeks, [2.5]);
    assert.equal(progress.snapshot.get().time, 2.5);

    seekProgress(progress, 3);
    assert.deepEqual(seeks, [2.5, 3]);
    assert.equal(progress.snapshot.get().time, 3);
  } finally {
    dispose();
  }
});

test("a non-finite position never reaches the editor", () => {
  const progress = createProgressState();
  const seeks = [];
  const dispose = setProgressSeekHandler(progress, (seconds) => seeks.push(seconds));
  try {
    seekProgress(progress, Number.NaN);
    seekProgress(progress, Number.POSITIVE_INFINITY);
    assert.deepEqual(seeks, []);
    assert.equal(progress.snapshot.get().time, 0);
  } finally {
    dispose();
  }
});
