/** Verifies the guide merger keeps the linear-scan result after its spatial index. */
import assert from "node:assert/strict";
import test from "node:test";
import { mergeGuides } from "../frontend/screens/editor/workspace/preview/drawing/guides.ts";

function referenceMerge(guides, scale, enabled) {
  const groups = [];
  for (const guide of guides) {
    const group =
      enabled &&
      groups.find(
        (candidate) =>
          Math.hypot(candidate.x - guide.x, candidate.y - guide.y) < 10 * scale &&
          Math.abs(candidate.rotation - guide.rotation) < 0.01,
      );
    if (group) {
      group.indices.push(guide.index);
    } else {
      groups.push({ ...guide, indices: [guide.index] });
    }
  }
  return groups;
}

function sampleGuides(count) {
  return Array.from({ length: count }, (_, index) => ({
    index,
    x: (index % 19) * 7 + (index % 3) * 0.25,
    y: (Math.floor(index / 19) % 17) * 6 + (index % 5) * 0.125,
    rotation: (index % 7) * 0.01,
  }));
}

test("guide merging matches the reference order at every list size", () => {
  for (const count of [1, 12, 40, 96, 420]) {
    const guides = sampleGuides(count);
    for (const enabled of [true, false]) {
      assert.deepEqual(
        mergeGuides(guides, 1.25, enabled).map((group) => group.indices),
        referenceMerge(guides, 1.25, enabled).map((group) => group.indices),
        `count=${count} enabled=${enabled}`,
      );
    }
  }
});

test("guide merging keeps non-finite guides out of the spatial index", () => {
  const guides = sampleGuides(96);
  guides[4] = { ...guides[4], x: Number.NaN };
  guides[70] = { ...guides[70], rotation: Number.POSITIVE_INFINITY };
  const merged = mergeGuides(guides, 1, true);
  assert.equal(
    merged.flatMap((group) => group.indices).length,
    guides.length,
    "every guide still belongs to exactly one group",
  );
  assert.equal(
    new Set(merged.flatMap((group) => group.indices)).size,
    guides.length,
    "no guide was dropped or duplicated",
  );
});
