/** Home audio keeps playback alive while its background gain changes. */
import assert from "node:assert/strict";
import test from "node:test";
import { LibraryPreviewAudio } from "../frontend/screens/welcome/library/libraryPreviewAudio.ts";

class FakeParam {
  value = 0;
  ramps = [];
  cancelAndHoldAtTime() {}
  cancelScheduledValues() {}
  setValueAtTime(value) {
    this.value = value;
  }
  linearRampToValueAtTime(value, time) {
    this.ramps.push({ value, time });
  }
}
class FakeGain {
  gain = new FakeParam();
  connect() {}
}
class FakeContext {
  static instances = [];
  currentTime = 10;
  state = "running";
  destination = {};
  gains = [];
  constructor() {
    FakeContext.instances.push(this);
  }
  createGain() {
    const gain = new FakeGain();
    this.gains.push(gain);
    return gain;
  }
  createMediaElementSource() {
    return { connect() {} };
  }
  close() {
    return Promise.resolve();
  }
}
class FakeAudio {
  static instances = [];
  paused = true;
  volume = 0;
  src = "";
  currentTime = 0;
  constructor() {
    FakeAudio.instances.push(this);
  }
  addEventListener() {}
  pause() {
    this.paused = true;
  }
  removeAttribute(name) {
    if (name === "src") {
      this.src = "";
    }
  }
  load() {}
  play() {
    this.paused = false;
    return Promise.resolve();
  }
}

test("background volume fades without stopping or restarting the preview", async () => {
  const previous = { Audio: globalThis.Audio, AudioContext: globalThis.AudioContext };
  FakeAudio.instances = [];
  FakeContext.instances = [];
  globalThis.Audio = FakeAudio;
  globalThis.AudioContext = FakeContext;
  try {
    const player = new LibraryPreviewAudio(() => {});
    const entry = { key: "project:a", audio: { name: "song.ogg", url: "http://localhost/song" } };
    player.select(entry);
    await new Promise((resolve) => setImmediate(resolve));
    const audio = FakeAudio.instances[0];
    const master = FakeContext.instances[0].gains[0].gain;
    assert.equal(audio.paused, false);
    assert.equal(audio.crossOrigin, "anonymous");
    player.setBackgroundVolume(0.4);
    assert.deepEqual(master.ramps.at(-1), { value: 0.4, time: 10.36 });
    assert.equal(audio.paused, false);
    assert.equal(audio.src, entry.audio.url);
    player.setBackgroundVolume(1);
    assert.deepEqual(master.ramps.at(-1), { value: 1, time: 10.36 });
    player.select(entry);
    assert.equal(audio.paused, false);
    player.dispose();
    assert.equal(audio.paused, true);
  } finally {
    globalThis.Audio = previous.Audio;
    globalThis.AudioContext = previous.AudioContext;
  }
});
