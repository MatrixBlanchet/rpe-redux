/** Verifies transport snapshots follow successive workspace frame samples. */
import assert from "node:assert/strict";
import test from "node:test";
import {
  PROGRESS_REFRESH_HZ,
  createProgressState,
  progressPublishDue,
} from "../frontend/chrome/transport/chartProgressState.ts";
import { createFrameReadouts } from "../frontend/screens/editor/workspace/runtime/frame/frameReadouts.ts";
import { EditorRenderScheduler } from "../frontend/screens/editor/workspace/runtime/frame/renderScheduler.ts";

test("transport throttles high-refresh playback samples to 30 Hz", () => {
  const progress = createProgressState();
  const readouts = createFrameReadouts({ progress, audio: { playing: true, time: 0 } }, {});
  const tempo = { points: [{ beat: 0, secondsPerBeat: 0.5 }] };
  let publications = 0;
  progress.snapshot.subscribe(() => publications++);
  for (let frame = 1; frame <= 144; frame++) {
    const timestamp = (frame * 1000) / 144;
    const chartSeconds = frame / 144;
    readouts.publishProgress(timestamp, chartSeconds, chartSeconds + 0.2, tempo, chartSeconds * 2);
  }
  assert.equal(PROGRESS_REFRESH_HZ, 30);
  assert.ok(publications >= 28 && publications <= 31, `published ${publications} times`);
  const snapshot = progress.snapshot.get();
  const sampledSeconds = snapshot.time - 0.2;
  assert.ok(1 - sampledSeconds <= 1 / PROGRESS_REFRESH_HZ + 1e-9);
  assert.equal(snapshot.chartTime, `${sampledSeconds.toFixed(3)} s`);
  assert.equal(snapshot.beat, `Beat ${(sampledSeconds * 2).toFixed(3)}`);
});

test("progress samples publish immediately while paused or seeking", () => {
  const progress = createProgressState();
  const readouts = createFrameReadouts({ progress, audio: { playing: false, time: 0 } }, {});
  const tempo = { points: [{ beat: 0, secondsPerBeat: 0.5 }] };
  let publications = 0;
  progress.snapshot.subscribe(() => publications++);
  for (let frame = 1; frame <= 5; frame++) {
    readouts.publishProgress(frame, frame / 100, frame / 100, tempo, frame);
  }
  assert.equal(publications, 5);
  assert.equal(progressPublishDue(10, 9.99, false), true);
  assert.equal(progressPublishDue(10, 10 - 1000 / 30, true), true);
  assert.equal(progressPublishDue(10, 10, true), false);
});

test("playhead is scheduled when its time advances and skipped when it does not", () => {
  const scheduler = new EditorRenderScheduler();
  const chart = {};
  const request = {
    now: 0,
    seconds: 0,
    playing: true,
    previewVisible: false,
    previewHighDensity: false,
    contentRefreshRate: 144,
    timelineRevision: 1,
    viewportOrigin: 0,
    previewChart: chart,
    previewRevision: 0,
    previewSession: null,
    previewSelection: null,
    authoringRegionVisible: true,
  };
  scheduler.tick(request, { paint() {} });
  const unchanged = scheduler.tick({ ...request, now: 1000 / 144 }, { paint() {} });
  assert.equal(unchanged.work.timeline, false);
  assert.equal(unchanged.work.playhead, false);
  const next = scheduler.tick({ ...request, now: 2000 / 144, seconds: 0.1 }, { paint() {} });
  assert.equal(next.work.timeline, false);
  assert.equal(next.work.playhead, true);
});

test("a replaced chart or decoded image forces an immediate preview frame", () => {
  const scheduler = new EditorRenderScheduler();
  const request = {
    now: 0,
    seconds: 0,
    playing: true,
    previewVisible: true,
    previewHighDensity: true,
    contentRefreshRate: 1,
    timelineRevision: 1,
    viewportOrigin: 0,
    previewChart: {},
    previewRevision: 1,
    previewSession: null,
    previewSelection: null,
    authoringRegionVisible: true,
  };
  const seen = [];
  const adapter = {
    paint(_request, work) {
      seen.push(work);
    },
  };
  scheduler.tick(request, adapter);
  scheduler.tick({ ...request, now: 1 }, adapter);
  assert.equal(seen.at(-1).preview, false);
  scheduler.tick(
    { ...request, now: 2, previewRevision: 2, timelineRevision: 2, force: true },
    adapter,
  );
  assert.equal(seen.at(-1).preview, true);
  assert.equal(seen.at(-1).previewInvalidated, true);
  scheduler.tick({ ...request, now: 3, previewChart: {}, previewRevision: 3 }, adapter);
  assert.equal(seen.at(-1).preview, true);
  assert.equal(seen.at(-1).previewInvalidated, true);
});
