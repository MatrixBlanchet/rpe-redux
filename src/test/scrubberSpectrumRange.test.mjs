/** The scrubber spectrum stays full-track while the A-B range is rendered separately. */
import assert from "node:assert/strict";
import test from "node:test";
import { editorLoopRange } from "../core/edit/state/publishedValues.ts";
import { createScrubberSpectrumLoader } from "../frontend/chrome/transport/scrubberSpectrumLoader.ts";

const RATE = 48000;

function buffer(channels) {
  const length = channels[0].length;
  return {
    length,
    numberOfChannels: channels.length,
    duration: length / RATE,
    getChannelData: (index) => channels[index],
  };
}

function settle() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

test("an A-B loop does not trigger spectrum re-analysis or scaling", async () => {
  editorLoopRange.set(null);
  const full = { tag: "full" };
  const calls = [];
  const paints = [];
  const left = new Float32Array(RATE);
  const right = new Float32Array(RATE);
  const loader = createScrubberSpectrumLoader({
    audio: { decodeForAnalysis: async () => buffer([left, right]) },
    spectrum: {
      clear() {},
      setData(data) {
        paints.push(data);
      },
    },
    schedule: (task) => task(),
    analyze: (source, options) => {
      calls.push({
        length: source.length,
        duration: source.duration,
        options,
      });
      return full;
    },
  });

  try {
    loader.queue("range.wav");
    await settle();
    assert.equal(calls.length, 1);
    assert.equal(calls[0].options.spectrumFrames, 512);
    assert.equal(paints.at(-1), full);

    editorLoopRange.set({ start: 0.25, end: 0.5 });
    await delay(200);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].options.spectrumFrames, 512);
    assert.equal(paints.at(-1), full);

    editorLoopRange.set(null);
    await delay(20);
    assert.equal(calls.length, 1);
    assert.equal(paints.at(-1), full);
  } finally {
    loader.dispose();
    editorLoopRange.set(null);
  }
});
