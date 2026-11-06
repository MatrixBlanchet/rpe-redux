/** Verifies preview sizing and cache policies that keep free-camera and shader frames cheap. */
import assert from "node:assert/strict";
import test from "node:test";
import {
  MAX_CANVAS_PIXEL_RATIO,
  canvasPixelRatio,
  prepareCanvas,
} from "../frontend/screens/editor/canvas/canvas2d.ts";
import {
  backgroundCacheKey,
  PreviewBackground,
} from "../frontend/screens/editor/workspace/preview/render/background.ts";
import { shaderTextureSize } from "../frontend/screens/editor/workspace/preview/render/shaderPipeline.ts";

/** Replaces the document factory for one test and always restores the global. */
function withDocument(factory, run) {
  const previous = globalThis.document;
  globalThis.document = { createElement: factory };
  try {
    return run();
  } finally {
    globalThis.document = previous;
  }
}

test("canvas pixel ratio is capped at two", () => {
  assert.equal(MAX_CANVAS_PIXEL_RATIO, 2);
  assert.equal(canvasPixelRatio(1), 1);
  assert.equal(canvasPixelRatio(1.5), 1.5);
  assert.equal(canvasPixelRatio(2), 2);
  assert.equal(canvasPixelRatio(3), 2);
  assert.equal(canvasPixelRatio(Number.NaN), 1);
});

test("prepareCanvas caps the backing store at the ratio limit", () => {
  const original = globalThis.devicePixelRatio;
  const context = {
    setTransform() {},
    clearRect() {},
  };
  const canvas = {
    width: 0,
    height: 0,
    clientWidth: 100,
    clientHeight: 50,
    getBoundingClientRect: () => ({ width: 100, height: 50 }),
    getContext: () => context,
  };
  try {
    globalThis.devicePixelRatio = 3;
    prepareCanvas(canvas);
    assert.equal(canvas.width, 200);
    assert.equal(canvas.height, 100);
    globalThis.devicePixelRatio = 1.5;
    prepareCanvas(canvas);
    assert.equal(canvas.width, 150);
    assert.equal(canvas.height, 75);
  } finally {
    globalThis.devicePixelRatio = original;
  }
});

test("background cache key ignores camera translation and zoom", () => {
  const image = { naturalWidth: 1920, naturalHeight: 1080 };
  const key = backgroundCacheKey(image, 1600, 900, 2, 10.5, 1);
  assert.equal(backgroundCacheKey(image, 1600, 900, 2, 10.5, 1), key);
  assert.notEqual(backgroundCacheKey(image, 1600, 900, 2, 12, 1), key);
  assert.notEqual(backgroundCacheKey(image, 1600, 900, 2, 10.5, 1.2), key);
  assert.notEqual(backgroundCacheKey(image, 1600, 900, 1, 10.5, 1), key);
  assert.notEqual(backgroundCacheKey(image, 800, 450, 2, 10.5, 1), key);
  assert.notEqual(
    backgroundCacheKey({ naturalWidth: 1280, naturalHeight: 720 }, 1600, 900, 2, 10.5, 1),
    key,
  );
});

test("background cache survives camera pans and zooms without repainting", () => {
  let cacheDraws = 0;
  const cacheContext = {
    filter: "none",
    setTransform() {},
    drawImage() {
      cacheDraws += 1;
    },
  };
  const cacheCanvas = {
    width: 0,
    height: 0,
    getContext: () => cacheContext,
  };
  const targetCalls = [];
  const target = {
    filter: "none",
    drawImage(...args) {
      targetCalls.push(args);
    },
  };
  withDocument(
    () => cacheCanvas,
    () => {
      const background = new PreviewBackground();
      const image = { naturalWidth: 1920, naturalHeight: 1080 };
      const clip = { left: 40, top: 20, width: 800, height: 600 };
      background.draw(target, image, 800, 600, 10.5, 1, 2, false, 40, 20, clip);
      assert.equal(cacheDraws, 1);
      background.draw(target, image, 900, 675, 10.5, 1, 2, false, -10, -20, clip);
      assert.equal(cacheDraws, 1);
      assert.equal(targetCalls.length, 2);
      background.draw(target, image, 900, 675, 14, 1, 2, false, -10, -20, clip);
      assert.equal(cacheDraws, 2);
    },
  );
});

test("shader texture fits the logical size inside 1920x1080", () => {
  assert.deepEqual(shaderTextureSize(1600, 900), { width: 1600, height: 900 });
  assert.deepEqual(shaderTextureSize(1920, 1080), { width: 1920, height: 1080 });
  assert.deepEqual(shaderTextureSize(3840, 2160), { width: 1920, height: 1080 });
  assert.deepEqual(shaderTextureSize(2560, 1440), { width: 1920, height: 1080 });
  assert.deepEqual(shaderTextureSize(1000, 2000), { width: 540, height: 1080 });
  assert.deepEqual(shaderTextureSize(0, 0), { width: 1, height: 1 });
});
