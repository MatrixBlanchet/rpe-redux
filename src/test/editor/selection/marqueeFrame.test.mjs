/** Verifies marquee work follows the workspace animation frame. */
import assert from "node:assert/strict";
import test from "node:test";
import { EditorRenderScheduler } from "../../../frontend/screens/editor/workspace/runtime/frame/renderScheduler.ts";

test("active preview marquee bypasses the preview content rate limit", () => {
  const scheduler = new EditorRenderScheduler();
  const request = {
    now: 0,
    seconds: 0,
    playing: true,
    previewVisible: true,
    previewHighDensity: false,
    contentRefreshRate: 30,
    previewMarqueeActive: true,
    timelineRevision: 1,
    viewportOrigin: 0,
    previewChart: {},
    previewRevision: 0,
    previewSession: null,
    previewSelection: null,
    authoringRegionVisible: true,
  };
  const adapter = { paint() {} };
  scheduler.tick(request, adapter);
  for (let frame = 1; frame < 5; frame++) {
    const result = scheduler.tick({ ...request, now: frame * 7, seconds: frame * 0.007 }, adapter);
    assert.equal(result.work.preview, true);
  }
});
