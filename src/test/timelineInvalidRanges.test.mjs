/** Timeline render caches project invalid durations without changing source indexes. */
import assert from "node:assert/strict";
import test from "node:test";
import { createChart, createEvent, createNote } from "../core/global/chart/chart.ts";
import { fromNumber } from "../core/global/chart/timing/beat.ts";
import { TimelineCache } from "../frontend/screens/editor/workspace/timeline/drawing/timelineCache.ts";

test("event render queries keep source indexes and project reversed events", () => {
  const chart = createChart();
  const reversed = createEvent(0, 1, 4, 2);
  const valid = createEvent(1, 2, 3, 5);
  const cache = new TimelineCache();

  assert.deepEqual(
    cache.eventEntries(chart, [reversed, valid], 0, 10, 11).map((entry) => entry.index),
    [0, 1],
  );
  assert.equal(cache.eventEntries(chart, [reversed, valid], 0, 10, 11)[0].start, 4);
  assert.equal(cache.eventEntries(chart, [reversed, valid], 0, 10, 11)[0].end, 4 + 1 / 11);
});

test("note render queries project reversed holds without renumbering valid notes", () => {
  const reversed = createNote(2, 8, 0, 10);
  reversed.endTime = fromNumber(4);
  const valid = createNote(2, 2, 0, 3);
  const notes = [reversed, valid];
  const cache = new TimelineCache();
  cache.refreshNotes(0, notes);

  assert.deepEqual(
    cache.visibleNotes(0, 0, 10).map((entry) => entry.index),
    [1, 0],
  );
});
