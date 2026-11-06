/** Automatic timing always answers with one fixed BPM and a confidence. */
import assert from "node:assert/strict";
import test from "node:test";
import { detectAutoTimingFromSamples } from "../core/media/beatDetection.ts";

const SAMPLE_RATE = 22050;

/** Deterministic noise so the fixture does not depend on Math.random. */
function random(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return (state / 0xffffffff) * 2 - 1;
  };
}

function kick(randomValue) {
  const length = Math.round(SAMPLE_RATE * 0.3);
  const values = new Float32Array(length);
  for (let index = 0; index < length; index++) {
    const time = index / SAMPLE_RATE;
    const frequency = 48 + 90 * Math.exp(-time * 30);
    const body = Math.sin(2 * Math.PI * frequency * time) * Math.exp(-time * 9);
    values[index] = (body + randomValue() * Math.exp(-time * 160) * 0.3) * 0.8;
  }
  return values;
}

function snare(randomValue) {
  const length = Math.round(SAMPLE_RATE * 0.18);
  const values = new Float32Array(length);
  for (let index = 0; index < length; index++) {
    const time = index / SAMPLE_RATE;
    const tone = Math.sin(2 * Math.PI * 190 * time) * 0.45;
    values[index] = (tone + randomValue() * 0.55) * Math.exp(-time * 18) * 0.7;
  }
  return values;
}

function place(buffer, sample, seconds, gain = 1) {
  const start = Math.round(seconds * SAMPLE_RATE);
  for (let index = 0; index < sample.length; index++) {
    const target = start + index;
    if (target >= 0 && target < buffer.length) {
      buffer[target] += sample[index] * gain;
    }
  }
}

/** Build a drum arrangement from explicit beat times. */
function arrangement(beatTimes, duration, seed) {
  const randomValue = random(seed);
  const buffer = new Float32Array(Math.round(SAMPLE_RATE * duration));
  beatTimes.forEach((time, index) => {
    place(buffer, kick(randomValue), time, 1);
    if (index % 4 === 1 || index % 4 === 3) {
      place(buffer, snare(randomValue), time, 0.65);
    }
  });
  return buffer;
}

/** Contiguous beats across a sequence of constant-tempo sections. */
function stepBeats(offset, sections) {
  const beats = [];
  let time = offset;
  for (const [bpm, seconds] of sections) {
    const end = time + seconds;
    const period = 60 / bpm;
    while (time < end - 1e-9) {
      beats.push(time);
      time += period;
    }
  }
  return beats;
}

/** Assert that a result is a finite fixed answer in the displayable range. */
function assertFixedAnswer(result) {
  assert.ok(result, "automatic detection must return a result");
  assert.ok(Number.isFinite(result.bpm), `BPM was ${result.bpm}`);
  assert.ok(result.bpm >= 50 && result.bpm <= 220, `BPM was ${result.bpm}`);
  assert.ok(Number.isFinite(result.offsetMs), `offset was ${result.offsetMs}`);
  assert.ok(result.offsetMs >= 0, `offset was ${result.offsetMs}`);
  assert.ok(result.confidence >= 0 && result.confidence <= 1);
  assert.ok(result.candidates.length >= 1);
  assert.equal("mode" in result, false);
  assert.equal("variable" in result, false);
}

test("empty input or an invalid sample rate is the only refusal", () => {
  assert.equal(detectAutoTimingFromSamples(new Float32Array(0), SAMPLE_RATE), null);
  assert.equal(detectAutoTimingFromSamples(new Float32Array(16), 0), null);
  assert.equal(detectAutoTimingFromSamples(new Float32Array(16), Number.NaN), null);
});

test("silence returns the 120 BPM fallback at zero confidence", () => {
  const result = detectAutoTimingFromSamples(
    new Float32Array(SAMPLE_RATE * 4),
    SAMPLE_RATE,
    SAMPLE_RATE * 4,
  );
  assertFixedAnswer(result);
  assert.equal(result.bpm, 120);
  assert.equal(result.offsetMs, 0);
  assert.equal(result.confidence, 0);
  assert.equal(result.beatTimes.length >= 1, true);
  assert.ok([...result.beatTimes].every((time) => Number.isFinite(time)));
});

test("very short audio still returns a finite fixed answer", () => {
  for (const length of [1, 32, 512]) {
    const result = detectAutoTimingFromSamples(
      new Float32Array(length),
      SAMPLE_RATE,
      length / SAMPLE_RATE,
    );
    assertFixedAnswer(result);
    assert.equal(result.bpm, 120);
    assert.ok([...result.beatTimes].every((time) => Number.isFinite(time)));
  }
});

test("unpitched noise keeps a fixed answer and a low confidence", () => {
  const randomValue = random(7);
  const noise = new Float32Array(SAMPLE_RATE * 4);
  for (let index = 0; index < noise.length; index++) {
    noise[index] = randomValue() * 0.2;
  }
  const result = detectAutoTimingFromSamples(noise, SAMPLE_RATE, 4);
  assertFixedAnswer(result);
  assert.ok(result.confidence < 0.4, `confidence was ${result.confidence}`);
});

test("a clear pulse scores above silence", () => {
  const beat = 60 / 128;
  const beats = [];
  for (let time = 0.35; time < 16; time += beat) {
    beats.push(time);
  }
  const clear = detectAutoTimingFromSamples(arrangement(beats, 16, 8), SAMPLE_RATE, 16);
  assertFixedAnswer(clear);
  assert.ok(Math.abs(clear.bpm - 128) < 0.5, `BPM was ${clear.bpm}`);
  assert.ok(clear.confidence > 0.7, `confidence was ${clear.confidence}`);
  assert.ok(clear.confidence > 0);
});

test("a step-tempo song still reports one fixed BPM", () => {
  const beats = stepBeats(0.35, [
    [120, 8],
    [150, 8],
  ]);
  const result = detectAutoTimingFromSamples(arrangement(beats, 16, 9), SAMPLE_RATE, 16);
  assertFixedAnswer(result);
  assert.ok(result.beatTimes.length > 20);
  assert.ok([...result.beatTimes].every((time) => Number.isFinite(time)));
});

test("the same input produces the same fixed answer", () => {
  const beats = [];
  for (let time = 0.5; time < 12; time += 60 / 150) {
    beats.push(time);
  }
  const samples = arrangement(beats, 12, 12);
  const first = detectAutoTimingFromSamples(samples, SAMPLE_RATE, 12);
  const second = detectAutoTimingFromSamples(samples, SAMPLE_RATE, 12);
  assert.deepEqual(
    {
      bpm: first?.bpm,
      offsetMs: first?.offsetMs,
      confidence: first?.confidence,
      beatTimes: first ? [...first.beatTimes] : null,
    },
    {
      bpm: second?.bpm,
      offsetMs: second?.offsetMs,
      confidence: second?.confidence,
      beatTimes: second ? [...second.beatTimes] : null,
    },
  );
});
