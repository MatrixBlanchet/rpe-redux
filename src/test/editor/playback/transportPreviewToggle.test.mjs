/** RPE preview keys: I toggles the preview, O hides the editor before restoring it. */
import assert from "node:assert/strict";
import { after, test } from "node:test";
import { displayValues } from "../../../frontend/screens/settings/editorDisplaySettings.ts";
import {
  connectViewControls,
  viewControls,
} from "../../../frontend/screens/editor/workspace/runtime/commands/viewControls.ts";
import {
  connectTransport,
  transport,
} from "../../../frontend/screens/editor/workspace/runtime/commands/transport.ts";

// View controls redraw through a window resize event; Node has no window.
if (typeof globalThis.window === "undefined") {
  globalThis.window = { dispatchEvent() {} };
}

/** A transport whose clock and calls the tests can inspect. */
function createPlayback() {
  return {
    audio: { playing: false, time: 2 },
    pending: false,
    playCalls: 0,
    pauseCalls: 0,
    seekCalls: [],
    play() {
      this.playCalls += 1;
      this.audio.playing = true;
      return Promise.resolve();
    },
    pause() {
      this.pauseCalls += 1;
      this.audio.playing = false;
    },
    seek(seconds) {
      this.seekCalls.push(seconds);
      this.audio.time = seconds;
      this.audio.playing = false;
    },
  };
}

/** The runtime surface the view controls touch. */
function createViewRuntime(session) {
  return {
    realtimePreview: { visible: true, showGameUI: false },
    applyDisplaySettings() {},
    persist() {},
    invalidate() {},
    getSession: () => session,
    setRealtimePreviewEnabled(enabled) {
      displayValues.previewEnabled.set(enabled);
    },
  };
}

/** Connect one editor's view + transport bindings for a test. */
function connect() {
  const session = { chart: {} };
  const playback = createPlayback();
  connectViewControls(createViewRuntime(session));
  connectTransport({
    togglePlayback: async () => {},
    seekBeat() {},
    playback,
    getSession: () => session,
    invalidate() {},
    reportError(error) {
      throw error;
    },
  });
  return playback;
}

after(() => {
  viewControls.exitPlaybackPreview();
});

test("I opens the preview, then closes it and pauses on the second press", () => {
  const playback = connect();

  transport.startPlayback();
  assert.equal(viewControls.playbackPreviewActive(), true);
  assert.equal(playback.audio.playing, true);
  assert.equal(playback.playCalls, 1);

  transport.startPlayback();
  assert.equal(viewControls.playbackPreviewActive(), false);
  assert.equal(playback.audio.playing, false);
  assert.equal(playback.pauseCalls, 1);
});

test("I enters the preview without stopping an editor playback", () => {
  const playback = connect();
  playback.audio.playing = true;

  transport.startPlayback();
  assert.equal(viewControls.playbackPreviewActive(), true);
  assert.equal(playback.audio.playing, true);
  assert.equal(playback.pauseCalls, 0);
});

test("O hides a playing editor, then restores it and stops the clock", () => {
  const playback = connect();
  playback.audio.playing = true;

  transport.stopPlayback();
  assert.equal(viewControls.playbackPreviewActive(), true);
  assert.equal(playback.audio.playing, true);
  assert.equal(playback.pauseCalls, 0);

  transport.stopPlayback();
  assert.equal(viewControls.playbackPreviewActive(), false);
  assert.equal(playback.audio.playing, false);
  assert.deepEqual(playback.seekCalls, [2]);
});

test("O enters the preview and starts playing when the editor is idle", () => {
  const playback = connect();

  transport.stopPlayback();
  assert.equal(viewControls.playbackPreviewActive(), true);
  assert.equal(playback.audio.playing, true);
  assert.equal(playback.playCalls, 1);
});

test("O leaves a paused preview instead of starting playback again", () => {
  const playback = connect();

  transport.startPlayback();
  playback.audio.playing = false;

  transport.stopPlayback();
  assert.equal(viewControls.playbackPreviewActive(), false);
  assert.equal(playback.playCalls, 1);
  assert.equal(playback.pauseCalls, 0);
});
