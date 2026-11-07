/** Verifies both easing canvases use one responsive, high-DPI sizing contract. */
import assert from "node:assert/strict";
import test from "node:test";
import {
  EASING_CANVAS_HEIGHT,
  EASING_CANVAS_WIDTH,
  easingCanvasMetrics,
} from "../../../design/components/easing/easingCanvas.ts";

test("a ratio-matched wide preview uses equal logical scales", () => {
  const metrics = easingCanvasMetrics(450, 450 / (EASING_CANVAS_WIDTH / EASING_CANVAS_HEIGHT), 2);
  assert.equal(metrics.pixelWidth, 900);
  assert.equal(metrics.pixelHeight, 346);
  assert.ok(Math.abs(metrics.scaleX - metrics.scaleY) < 0.01);
});

test("the shared canvas sizing caps device-pixel work", () => {
  const metrics = easingCanvasMetrics(260, 100, 4);
  assert.deepEqual(metrics, {
    pixelWidth: 520,
    pixelHeight: 200,
    scaleX: 2,
    scaleY: 2,
  });
});
