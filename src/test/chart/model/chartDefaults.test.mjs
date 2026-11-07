/** Default line textures and metadata media names stay compatible with the asset library. */
import assert from "node:assert/strict";
import test from "node:test";
import { createChart, createLine } from "../../../core/global/chart/chart.ts";
import { createStarterChart, STARTER_LINE_COUNT } from "../../../core/global/chart/starterChart.ts";
import { mediaResourceName } from "../../../frontend/screens/editor/chartMetadata/mediaFile.ts";

test("created judge lines carry the bundled line texture", () => {
  assert.equal(createLine("Line").Texture, "line.png");
  assert.equal(createChart().judgeLineList?.[0]?.Texture, "line.png");
});

test("a new document starts with the starter judge lines and no notes", () => {
  const chart = createStarterChart();
  assert.equal(chart.judgeLineList?.length, STARTER_LINE_COUNT);
  assert.equal(STARTER_LINE_COUNT, 24);
  for (const line of chart.judgeLineList ?? []) {
    assert.equal(line.notes?.length, 0);
    assert.equal(line.numOfNotes, 0);
  }
  // Index 0 and the last line both exist, so the toolbar can step the full range.
  assert.equal(chart.judgeLineList?.[0]?.Name, "Line 1");
  assert.equal(chart.judgeLineList?.[23]?.Name, "Line 24");
});

test("metadata media uses root-level names and keeps older bytes addressable", () => {
  const file = (name) => ({ name, bytes: new Uint8Array(), type: "" });
  assert.equal(mediaResourceName(file("cover.png")), "cover.png");
  assert.equal(mediaResourceName(file("audio/cover.png"), ["cover.png"]), "cover-2.png");
  assert.equal(mediaResourceName(file("cover.png"), ["cover.png", "cover-2.png"]), "cover-3.png");
});
