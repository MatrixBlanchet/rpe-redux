/** Timeline marker normalization, chart round trips, identity, and edits stay pure. */
import assert from "node:assert/strict";
import test from "node:test";
import {
  addTimelineMarker,
  createTimelineMarkerId,
  markerAudioRatio,
  markerAudioSeconds,
  normalizeMarkerColor,
  normalizeTimelineMarkers,
  readTimelineMarkers,
  removeTimelineMarker,
  updateTimelineMarker,
  writeTimelineMarkers,
} from "../core/global/chart/timelineMarkers.ts";

/** Strip generated ids so a test can compare the stored marker fields alone. */
function withoutIds(markers) {
  return markers.map(({ id: _id, ...marker }) => marker);
}

/** Assert every marker has a non-empty, collection-unique id. */
function assertUniqueIds(markers) {
  const ids = markers.map((marker) => marker.id);
  for (const id of ids) {
    assert.equal(typeof id, "string");
    assert.notEqual(id, "");
  }
  assert.equal(new Set(ids).size, markers.length);
}

test("marker colours keep one lowercase #rrggbb form", () => {
  assert.equal(normalizeMarkerColor("#AABBCC"), "#aabbcc");
  assert.equal(normalizeMarkerColor("#a1B2c3"), "#a1b2c3");
  for (const value of ["", "#abc", "#gggggg", "red", "aabbcc", "#aabb cc", 0, null, {}, []]) {
    assert.equal(normalizeMarkerColor(value), undefined);
  }
});

test("normalization drops unusable markers, trims names, and sorts by time", () => {
  const markers = normalizeTimelineMarkers([
    { time: 4, name: "  Second  ", note: "keep", color: "#AABBCC" },
    null,
    "marker",
    7,
    { time: Number.NaN, name: "NaN" },
    { time: Infinity, name: "infinite" },
    { time: -1, name: "negative" },
    { time: 1, name: "" },
    { time: 1, name: "   " },
    { time: 2, name: "First", color: "red", extra: 7 },
    { time: 4, name: "Same time" },
  ]);
  assert.deepEqual(withoutIds(markers), [
    { time: 2, name: "First", extra: 7 },
    { time: 4, name: "Second", note: "keep", color: "#aabbcc" },
    { time: 4, name: "Same time" },
  ]);
  assertUniqueIds(markers);
});

test("normalization keeps same-time duplicates and gives each its own id", () => {
  const markers = normalizeTimelineMarkers([
    { time: 2, name: "Drop" },
    { time: 2, name: "Drop" },
  ]);
  assert.deepEqual(withoutIds(markers), [
    { time: 2, name: "Drop" },
    { time: 2, name: "Drop" },
  ]);
  assertUniqueIds(markers);
});

test("reading markers tolerates a missing or non-array root and keeps valid entries", () => {
  assert.deepEqual(readTimelineMarkers({}), []);
  assert.deepEqual(readTimelineMarkers({ markers: { time: 1, name: "A" } }), []);
  assert.deepEqual(readTimelineMarkers({ markers: "A" }), []);
  const chart = {
    markers: [
      { time: 2, name: "B" },
      { time: -1, name: "bad" },
      { time: 1, name: "A" },
    ],
  };
  const markers = readTimelineMarkers(chart);
  assert.deepEqual(withoutIds(markers), [
    { time: 1, name: "A" },
    { time: 2, name: "B" },
  ]);
  assertUniqueIds(markers);
  assert.deepEqual(readTimelineMarkers(chart), markers);
  assert.deepEqual(chart.markers, [
    { time: 2, name: "B" },
    { time: -1, name: "bad" },
    { time: 1, name: "A" },
  ]);
});

test("marker audio conversion applies the chart offset", () => {
  const duration = 10;
  // No offset: chart time is already audio time.
  assert.equal(markerAudioRatio(2, 0, duration), 0.2);
  assert.equal(markerAudioSeconds(2, 0, duration), 2);
  // +500 ms: the marker sits 0.5 s later on the audio scrubber.
  assert.equal(markerAudioRatio(2, 0.5, duration), 0.25);
  assert.equal(markerAudioSeconds(2, 0.5, duration), 2.5);
  // -500 ms: the marker sits 0.5 s earlier, and a position before the audio
  // start is clamped to the left edge.
  assert.equal(markerAudioRatio(2, -0.5, duration), 0.15);
  assert.equal(markerAudioSeconds(2, -0.5, duration), 1.5);
  assert.equal(markerAudioRatio(0.2, -0.5, duration), 0);
  assert.equal(markerAudioSeconds(0.2, -0.5, duration), 0);
});

test("marker audio conversion clamps to short and invalid durations", () => {
  // A marker past the audio end, including the offset, stops at the bar's end.
  assert.equal(markerAudioRatio(-1, 0, 10), 0);
  assert.equal(markerAudioRatio(20, 0, 10), 1);
  assert.equal(markerAudioSeconds(20, 0, 10), 10);
  // Short audio and a marker whose chart time is already past it.
  assert.equal(markerAudioRatio(1, 0.5, 0.5), 1);
  assert.equal(markerAudioSeconds(1, 0.5, 0.5), 0.5);
  assert.equal(markerAudioRatio(0, 0.5, 0.25), 1);
  // A missing or invalid duration has no drawable position.
  assert.equal(markerAudioRatio(0, 0.5, 0), 0);
  assert.equal(markerAudioRatio(0, 0.5, Number.NaN), 0);
  assert.equal(markerAudioSeconds(0, 0.5, 0), 0);
});

test("writing markers returns a new chart and leaves every other field alone", () => {
  const chart = {
    META: { name: "Song" },
    BPMList: [{ bpm: 120 }],
    judgeLineList: [{ notes: [] }],
    extraRoot: 1,
    markers: [{ time: 5, name: "old" }],
  };
  const next = writeTimelineMarkers(chart, [
    { time: 2, name: "  New  ", note: "x", color: "#ABCDEF" },
    { time: -1, name: "bad" },
  ]);
  assert.notEqual(next, chart);
  assert.deepEqual(chart.markers, [{ time: 5, name: "old" }]);
  assert.deepEqual(withoutIds(next.markers), [
    { time: 2, name: "New", note: "x", color: "#abcdef" },
  ]);
  assertUniqueIds(next.markers);
  for (const key of ["META", "BPMList", "judgeLineList", "extraRoot"]) {
    assert.equal(next[key], chart[key]);
  }
});

test("adding a marker sorts it into place, drops an unnamed one, and keeps its id", () => {
  const base = normalizeTimelineMarkers([
    { time: 1, name: "A" },
    { time: 5, name: "C" },
  ]);
  const added = addTimelineMarker(base, { time: 3, name: " B " });
  assert.deepEqual(withoutIds(added), [
    { time: 1, name: "A" },
    { time: 3, name: "B" },
    { time: 5, name: "C" },
  ]);
  assertUniqueIds(added);

  const explicitId = createTimelineMarkerId();
  const explicit = addTimelineMarker(base, { id: explicitId, time: 2, name: "New" });
  assert.equal(explicit.find((marker) => marker.id === explicitId)?.name, "New");

  assert.deepEqual(withoutIds(addTimelineMarker(base, { time: 2, name: "   " })), [
    { time: 1, name: "A" },
    { time: 5, name: "C" },
  ]);
  assert.deepEqual(withoutIds(base), [
    { time: 1, name: "A" },
    { time: 5, name: "C" },
  ]);
});

test("updating a marker can rename, recolour, move, and clear its colour by id", () => {
  const base = normalizeTimelineMarkers([
    { time: 1, name: "A", color: "#112233" },
    { time: 2, name: "B" },
    { time: 3, name: "C" },
  ]);
  const firstId = base[0].id;
  const secondId = base[1].id;
  const thirdId = base[2].id;

  const renamed = updateTimelineMarker(base, secondId, { name: " Beta " });
  assert.deepEqual(withoutIds(renamed), [
    { time: 1, name: "A", color: "#112233" },
    { time: 2, name: "Beta" },
    { time: 3, name: "C" },
  ]);
  assert.equal(renamed[1].id, secondId);

  const recoloured = updateTimelineMarker(base, firstId, { color: "#AABBCC" });
  assert.deepEqual(recoloured[0], {
    id: firstId,
    time: 1,
    name: "A",
    color: "#aabbcc",
  });

  assert.deepEqual(withoutIds(updateTimelineMarker(base, thirdId, { time: 0 })), [
    { time: 0, name: "C" },
    { time: 1, name: "A", color: "#112233" },
    { time: 2, name: "B" },
  ]);

  assert.deepEqual(withoutIds(updateTimelineMarker(base, firstId, { color: undefined })), [
    { time: 1, name: "A" },
    { time: 2, name: "B" },
    { time: 3, name: "C" },
  ]);
});

test("an unknown marker id returns the normalized list unchanged", () => {
  const raw = [
    { time: 3, name: " C " },
    { time: 1, name: "A" },
  ];
  const normalized = normalizeTimelineMarkers(raw);
  assert.deepEqual(updateTimelineMarker(raw, "missing", { name: "nope" }), normalized);
  assert.deepEqual(removeTimelineMarker(raw, "missing"), normalized);
});

test("removing a marker uses the id and leaves an unknown id alone", () => {
  const base = normalizeTimelineMarkers([
    { time: 3, name: "C" },
    { time: 1, name: "A" },
    { time: 2, name: "B" },
  ]);
  assert.deepEqual(withoutIds(removeTimelineMarker(base, base[1].id)), [
    { time: 1, name: "A" },
    { time: 3, name: "C" },
  ]);
  assert.deepEqual(removeTimelineMarker(base, "missing"), base);
});

test("same-time same-name markers keep independent ids for edit and delete", () => {
  const chart = {
    markers: [
      { time: 2, name: "Drop", color: "#111111" },
      { time: 2, name: "Drop", color: "#222222" },
    ],
  };
  const markers = readTimelineMarkers(chart);
  assertUniqueIds(markers);
  const [first, second] = markers;

  const renamed = updateTimelineMarker(markers, first.id, { name: "First" });
  assert.equal(renamed.find((marker) => marker.id === first.id)?.name, "First");
  assert.equal(renamed.find((marker) => marker.id === second.id)?.name, "Drop");
  assert.equal(renamed.find((marker) => marker.id === first.id)?.id, first.id);

  const removedSecond = removeTimelineMarker(markers, second.id);
  assert.deepEqual(
    removedSecond.map((marker) => marker.id),
    [first.id],
  );
  const removedFirst = removeTimelineMarker(markers, first.id);
  assert.deepEqual(
    removedFirst.map((marker) => marker.id),
    [second.id],
  );
});

test("stored marker ids survive a round trip and duplicate ids are repaired", () => {
  const chart = {
    markers: [
      { id: "marker-a", time: 1, name: "A" },
      { id: "marker-a", time: 2, name: "B" },
    ],
  };
  const markers = readTimelineMarkers(chart);
  assert.equal(markers[0].id, "marker-a");
  assert.notEqual(markers[1].id, "marker-a");
  assertUniqueIds(markers);

  const written = writeTimelineMarkers(chart, markers);
  assert.deepEqual(readTimelineMarkers(written), markers);
});

test("a legacy chart without ids reads, edits, and writes back with stable ids", () => {
  const chart = {
    META: { name: "Legacy" },
    markers: [
      { time: 1, name: "A", color: "#AABBCC" },
      { time: 1, name: "A" },
      { time: 2, name: "B" },
    ],
  };
  const first = readTimelineMarkers(chart);
  const second = readTimelineMarkers(chart);
  assert.deepEqual(first, second);
  assertUniqueIds(first);
  // Reading does not inject ids into the chart object it was given.
  assert.equal(
    chart.markers.some((marker) => "id" in marker),
    false,
  );

  const edited = updateTimelineMarker(first, first[1].id, { name: "A2" });
  const written = writeTimelineMarkers(chart, edited);
  const reread = readTimelineMarkers(written);
  assert.deepEqual(reread, written.markers);
  assertUniqueIds(reread);
  assert.equal(reread.length, 3);
  assert.equal(reread.find((marker) => marker.id === first[1].id)?.name, "A2");
  assert.deepEqual(
    reread.map((marker) => marker.name),
    ["A", "A2", "B"],
  );
});

test("every marker operation accepts an empty collection", () => {
  assert.deepEqual(normalizeTimelineMarkers([]), []);
  assert.deepEqual(readTimelineMarkers({ markers: [] }), []);
  assert.deepEqual(writeTimelineMarkers({}, []), { markers: [] });
  assert.deepEqual(withoutIds(addTimelineMarker([], { time: 0, name: "Zero" })), [
    { time: 0, name: "Zero" },
  ]);
  assert.deepEqual(updateTimelineMarker([], "missing", { name: "nope" }), []);
  assert.deepEqual(removeTimelineMarker([], "missing"), []);
});
