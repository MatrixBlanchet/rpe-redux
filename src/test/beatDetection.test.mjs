/** Fixed-tempo detection and the engine-to-chart timing handoff. */
import assert from "node:assert/strict";
import test from "node:test";
import { detectBeatGridFromSamples, mixToMono } from "../core/media/beatDetection.ts";
import { chartWithDetectedTiming } from "../core/global/chart/editing/drafts.ts";
import { createChart } from "../core/global/chart/chart.ts";

const SAMPLE_RATE = 22050;

/** A deterministic generator so the fixtures do not depend on Math.random. */
function random(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return (state / 0xffffffff) * 2 - 1;
  };
}

/** A kick-like transient: a falling sine with a short noise click. */
function kick(randomValue) {
  const length = Math.round(SAMPLE_RATE * 0.32);
  const values = new Float32Array(length);
  for (let index = 0; index < length; index++) {
    const time = index / SAMPLE_RATE;
    const frequency = 48 + 90 * Math.exp(-time * 30);
    const body = Math.sin(2 * Math.PI * frequency * time) * Math.exp(-time * 9);
    const click = randomValue() * Math.exp(-time * 160) * 0.3;
    values[index] = (body + click) * 0.8;
  }
  return values;
}

/** A snare transient: mid tone plus noise. */
function snare(randomValue) {
  const length = Math.round(SAMPLE_RATE * 0.2);
  const values = new Float32Array(length);
  for (let index = 0; index < length; index++) {
    const time = index / SAMPLE_RATE;
    const tone = Math.sin(2 * Math.PI * 190 * time) * 0.45;
    const noise = randomValue() * 0.55;
    values[index] = (tone + noise) * Math.exp(-time * 18) * 0.7;
  }
  return values;
}

/** Mix one sample into a buffer at a time in seconds. */
function place(buffer, sample, seconds, gain = 1) {
  const start = Math.round(seconds * SAMPLE_RATE);
  for (let index = 0; index < sample.length; index++) {
    const target = start + index;
    if (target >= 0 && target < buffer.length) {
      buffer[target] += sample[index] * gain;
    }
  }
}

/** A kick without a click: the energy attack is later than the flux edge. */
function softKick(randomValue) {
  const length = Math.round(SAMPLE_RATE * 0.4);
  const values = new Float32Array(length);
  for (let index = 0; index < length; index++) {
    const time = index / SAMPLE_RATE;
    const frequency = 42 + 60 * Math.exp(-time * 8);
    values[index] =
      Math.sin(2 * Math.PI * frequency * time) * Math.exp(-time * 4) * 0.8 + randomValue() * 0.001;
  }
  return values;
}

/** A steady four-on-the-floor pattern with a backbeat. */
function fourOnTheFloor({ bpm, offset, seconds = 12, seed = 7 }) {
  const randomValue = random(seed);
  const buffer = new Float32Array(Math.round(SAMPLE_RATE * seconds));
  const beat = 60 / bpm;
  for (let index = 0; index * beat + offset < seconds; index++) {
    const time = offset + index * beat;
    place(buffer, kick(randomValue), time, 1);
    if (index % 4 === 1 || index % 4 === 3) {
      place(buffer, snare(randomValue), time, 0.65);
    }
  }
  return buffer;
}

/** A breakbeat whose snare backbeat makes the half-time candidate plausible. */
function breakbeat({ bpm, offset, seconds = 12, seed = 11 }) {
  const randomValue = random(seed);
  const buffer = new Float32Array(Math.round(SAMPLE_RATE * seconds));
  const beat = 60 / bpm;
  for (let index = 0; index * beat + offset < seconds; index++) {
    const time = offset + index * beat;
    if (index % 4 === 0 || index % 4 === 2) {
      place(buffer, kick(randomValue), time, 0.95);
    }
    if (index % 4 === 1 || index % 4 === 3) {
      place(buffer, snare(randomValue), time, 0.75);
    }
    place(buffer, kick(randomValue), time + beat * 0.5, 0.25);
  }
  return buffer;
}

test("detects a four-on-the-floor BPM and its first-beat offset", () => {
  const result = detectBeatGridFromSamples(fourOnTheFloor({ bpm: 128, offset: 0.35 }), SAMPLE_RATE);
  assert.ok(result);
  assert.ok(Math.abs(result.bpm - 128) < 0.25, `BPM was ${result.bpm}`);
  assert.ok(Math.abs(result.offsetMs - 350) < 2, `offset was ${result.offsetMs}`);
  assert.ok(result.confidence > 0.7, `confidence was ${result.confidence}`);
  assert.ok(result.beatTimes.length > 10);
});

test("refines the offset against a slow attack instead of the flux edge", () => {
  const randomValue = random(13);
  const buffer = new Float32Array(Math.round(SAMPLE_RATE * 16));
  const beat = 60 / 123;
  for (let index = 0; index * beat + 0.62 < 16; index++) {
    place(buffer, softKick(randomValue), 0.62 + index * beat, 1);
  }
  const result = detectBeatGridFromSamples(buffer, SAMPLE_RATE);
  assert.ok(result);
  assert.ok(Math.abs(result.offsetMs - 620) < 2.5, `offset was ${result.offsetMs}`);
});

test("offers the half-time reading when the backbeat supports it", () => {
  const result = detectBeatGridFromSamples(breakbeat({ bpm: 174, offset: 0.62 }), SAMPLE_RATE);
  assert.ok(result);
  assert.ok(Math.abs(result.bpm - 174) < 0.4, `BPM was ${result.bpm}`);
  const half = result.candidates.find((candidate) => Math.abs(candidate.bpm - 87) < 0.4);
  assert.ok(half, "the 87 BPM half-time candidate should be listed");
  assert.equal(half.relation, "half");
});

test("returns a low-confidence fixed answer for silence and noise", () => {
  const silence = new Float32Array(SAMPLE_RATE * 4);
  const quiet = detectBeatGridFromSamples(silence, SAMPLE_RATE);
  assert.ok(quiet, "silence must still produce a fixed answer");
  assert.equal(quiet.bpm, 120);
  assert.equal(quiet.offsetMs, 0);
  assert.equal(quiet.confidence, 0);
  assert.ok(quiet.beatTimes.length >= 1);

  const randomValue = random(3);
  const noise = new Float32Array(SAMPLE_RATE * 4);
  for (let index = 0; index < noise.length; index++) {
    noise[index] = randomValue() * 0.2;
  }
  const noisy = detectBeatGridFromSamples(noise, SAMPLE_RATE);
  assert.ok(noisy, "noise must still produce a fixed answer");
  assert.ok(noisy.confidence < 0.6, "noise must not produce a confident tempo");
  assert.ok(noisy.confidence >= 0 && noisy.confidence <= 1);
});

test("mixes a phase-inverted stereo pair without cancelling the beat", () => {
  const mono = new Float32Array([0.4, -0.2, 0.8]);
  const buffer = {
    length: mono.length,
    numberOfChannels: 2,
    duration: 3 / SAMPLE_RATE,
    sampleRate: SAMPLE_RATE,
    getChannelData: (channel) =>
      channel === 0 ? mono : Float32Array.from(mono, (value) => -value),
  };
  const mixed = mixToMono(buffer);
  assert.deepEqual([...mixed], [...mono]);
});

test("applying a detected result replaces the timing and offset in one chart", () => {
  const chart = createChart();
  const next = chartWithDetectedTiming(chart, 174.02, 620.4);
  assert.equal(next.BPMList.length, 1);
  assert.equal(next.BPMList[0].bpm, 174.02);
  assert.deepEqual(next.BPMList[0].startTime, [0, 0, 1]);
  assert.equal(next.META.offset, 620.4);
  assert.notEqual(next, chart);
});
