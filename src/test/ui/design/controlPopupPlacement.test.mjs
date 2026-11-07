/** Control popup geometry: four-corner flipping, edge clamping, and dialog offsets. */
import assert from "node:assert/strict";
import test from "node:test";
import { placeControlPopup } from "../../../design/controls/controlPopupPlacement.ts";

const viewport = { width: 1000, height: 800 };
const panel = { panelWidth: 300, panelHeight: 200 };

test("a top-left anchor stays below and clamps to the left edge", () => {
  const { style, flipUp } = placeControlPopup({
    anchor: { left: 2, top: 10, bottom: 30, width: 40 },
    ...panel,
    viewport,
  });

  assert.equal(flipUp, false);
  assert.equal(style.position, "fixed");
  assert.equal(style.left, 6);
  assert.equal(style.top, 33);
  assert.equal(style.width, 300);
  assert.equal(style.maxHeight, undefined);
  assert.equal(style["--control-origin-x"], "16px");
  assert.equal(style["--control-origin-y"], "0px");
});

test("a top-right anchor stays below and clamps to the right edge", () => {
  const { style, flipUp } = placeControlPopup({
    anchor: { left: 950, top: 10, bottom: 30, width: 40 },
    ...panel,
    viewport,
  });

  assert.equal(flipUp, false);
  assert.equal(style.left, 694);
  assert.equal(style.top, 33);
  assert.equal(style["--control-origin-x"], "276px");
});

test("a bottom-left anchor flips above and clamps to the left edge", () => {
  const { style, flipUp } = placeControlPopup({
    anchor: { left: 2, top: 760, bottom: 790, width: 40 },
    ...panel,
    viewport,
  });

  assert.equal(flipUp, true);
  assert.equal(style.left, 6);
  assert.equal(style.top, 557);
  assert.equal(style["--control-origin-x"], "16px");
  assert.equal(style["--control-origin-y"], "200px");
});

test("a bottom-right anchor flips above and clamps to the right edge", () => {
  const { style, flipUp } = placeControlPopup({
    anchor: { left: 950, top: 760, bottom: 790, width: 40 },
    ...panel,
    viewport,
  });

  assert.equal(flipUp, true);
  assert.equal(style.left, 694);
  assert.equal(style.top, 557);
  assert.equal(style["--control-origin-x"], "276px");
});

test("the colour panel keeps its size and only flips when the side above fits", () => {
  const low = placeControlPopup({
    anchor: { left: 100, top: 100, bottom: 130, width: 40 },
    panelWidth: 344,
    panelHeight: 232,
    viewport,
    flipAboveInset: 0,
  });
  assert.equal(low.flipUp, false);
  assert.equal(low.style.top, 133);
  assert.equal(low.style.maxHeight, undefined);

  const high = placeControlPopup({
    anchor: { left: 100, top: 650, bottom: 700, width: 40 },
    panelWidth: 344,
    panelHeight: 232,
    viewport,
    flipAboveInset: 0,
  });
  assert.equal(high.flipUp, true);
  assert.equal(high.style.top, 415);
  assert.equal(high.style["--control-origin-y"], "232px");
});

test("the select policy clamps the visible height to the space below", () => {
  const { style, flipUp } = placeControlPopup({
    anchor: { left: 100, top: 500, bottom: 520, width: 80 },
    panelWidth: 300,
    panelHeight: 400,
    viewport,
    clampHeight: true,
    flipThreshold: 120,
    preferLargerSide: true,
  });

  assert.equal(flipUp, false);
  assert.equal(style.maxHeight, 272);
  assert.equal(style.top, 522);
  assert.equal(style["--control-origin-y"], "0px");
});

test("the select policy flips when the space below is too small", () => {
  const { style, flipUp } = placeControlPopup({
    anchor: { left: 100, top: 600, bottom: 790, width: 80 },
    panelWidth: 300,
    panelHeight: 400,
    viewport,
    clampHeight: true,
    flipThreshold: 120,
    preferLargerSide: true,
  });

  assert.equal(flipUp, true);
  assert.equal(style.maxHeight, 400);
  assert.equal(style.top, 197);
  assert.equal(style["--control-origin-y"], "400px");
});

test("a below-placed select stays below when the space above is larger", () => {
  const { style, flipUp } = placeControlPopup({
    anchor: { left: 100, top: 600, bottom: 790, width: 80 },
    panelWidth: 300,
    panelHeight: 400,
    viewport,
    clampHeight: true,
    flipThreshold: 120,
    preferLargerSide: true,
    placement: "below",
  });

  assert.equal(flipUp, false);
  assert.equal(style.maxHeight, 2);
  assert.equal(style.top, 793);
  assert.equal(style["--control-origin-y"], "0px");
});

test("a dialog makes the panel absolute and offsets the anchor by its client box", () => {
  const { style, flipUp } = placeControlPopup({
    anchor: { left: 120, top: 60, bottom: 80, width: 50 },
    ...panel,
    dialog: { left: 100, top: 50, width: 600, height: 400 },
    viewport,
  });

  assert.equal(flipUp, false);
  assert.equal(style.position, "absolute");
  assert.equal(style.left, 20);
  assert.equal(style.top, 33);
  assert.equal(style["--control-origin-x"], "25px");
});

test("a dialog clamps both edges and keeps the origin inside the panel", () => {
  const { style, flipUp } = placeControlPopup({
    anchor: { left: 680, top: 400, bottom: 430, width: 50 },
    ...panel,
    dialog: { left: 100, top: 50, width: 600, height: 400 },
    viewport,
  });

  assert.equal(flipUp, true);
  assert.equal(style.position, "absolute");
  assert.equal(style.left, 294);
  assert.equal(style.top, 147);
  assert.equal(style["--control-origin-x"], "292px");
});

test("flipAboveInset preserves the colour panel's raw top comparison", () => {
  const dialog = { left: 100, top: 50, width: 600, height: 400 };
  const anchor = { left: 200, top: 255, bottom: 480, width: 40 };

  const withInset = placeControlPopup({
    anchor,
    panelWidth: 344,
    panelHeight: 200,
    dialog,
    viewport,
  });
  const withoutInset = placeControlPopup({
    anchor,
    panelWidth: 344,
    panelHeight: 200,
    dialog,
    viewport,
    flipAboveInset: 0,
  });

  assert.equal(withInset.flipUp, false);
  assert.equal(withoutInset.flipUp, true);
});
