/**
 * Verifies degenerate easing and bezier inputs stay finite and deterministic.
 *
 * A flat sub-range and repeated bezier control points previously divided by a
 * zero span or derivative, which leaked NaN into `EventTrack` samples.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { bezier, easing, easingIntegral, easingWithRange } from "../core/utils/easing.ts";
import { EventTrack } from "../core/global/chart/timing/events.ts";

const tempo = { seconds: (beat) => Number(beat) };

test("a flat easing sub-range falls back to linear progress", () => {
  const progresses = [0, 0.17, 0.5, 0.83, 1];
  for (const progress of progresses) {
    const value = easing(progress, 2, 0.5, 0.5);
    assert.ok(Number.isFinite(value), `easing(${progress}) produced ${value}`);
    assert.equal(value, progress, "a zero-width range maps to the same progress");
    assert.equal(
      easingWithRange(progress, 2, 0.5, 0.5, Math.SQRT1_2, 0),
      progress,
      "the precompiled range path uses the same fallback",
    );
    const integral = easingIntegral(progress, 2, 0.5, 0.5);
    assert.ok(Number.isFinite(integral), `easingIntegral(${progress}) produced ${integral}`);
    assert.equal(integral, (progress * progress) / 2);
  }
  assert.equal(easing(0.5, 2, 0.5, 0.5), 0.5);
});

test("a repeated bezier control point stays finite at every progress", () => {
  const points = [1, 0, 0, 0.5];
  for (let index = 0; index <= 100; index += 1) {
    const progress = index / 100;
    const value = bezier(progress, points);
    assert.ok(Number.isFinite(value), `bezier(${progress}) produced ${value}`);
  }
  assert.equal(bezier(0, points), 0);
  assert.equal(bezier(1, points), 1);

  for (const degenerate of [
    [0, 0, 0, 0],
    [1, 0, 1, 0],
    [1, 2, 0, -1],
  ]) {
    for (const progress of [0, 0.25, 0.5, 0.75, 1]) {
      assert.ok(
        Number.isFinite(bezier(progress, degenerate)),
        `points ${degenerate} progress ${progress} produced a non-finite value`,
      );
    }
  }
});

test("EventTrack samples stay finite for flat easing and degenerate bezier", () => {
  const flat = new EventTrack(
    [
      {
        startTime: 0,
        endTime: 1,
        start: -100,
        end: 100,
        easingType: 2,
        easingLeft: 0.5,
        easingRight: 0.5,
      },
    ],
    tempo,
  );
  const bezierTrack = new EventTrack(
    [
      {
        startTime: 0,
        endTime: 1,
        start: 0,
        end: 100,
        easingType: 1,
        bezier: true,
        bezierPoints: [1, 0, 0, 0.5],
      },
    ],
    tempo,
  );
  for (const seconds of [-0.5, 0, 0.25, 0.5, 0.75, 1, 1.5]) {
    const flatValue = flat.value(seconds);
    assert.ok(Number.isFinite(flatValue), `flat event at ${seconds} produced ${flatValue}`);
    const bezierValue = bezierTrack.value(seconds);
    assert.ok(Number.isFinite(bezierValue), `bezier event at ${seconds} produced ${bezierValue}`);
  }
});
