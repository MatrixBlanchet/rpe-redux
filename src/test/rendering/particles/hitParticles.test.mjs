/** Verifies the RPE Recorder-derived hit particle burst geometry and lifetime. */
import assert from "node:assert/strict";
import test from "node:test";
import {
  HIT_PARTICLE_LIFETIME,
  hitParticles,
} from "../../../frontend/screens/editor/workspace/preview/drawing/hitParticles.ts";

test("the burst is deterministic and bounded by its lifetime", () => {
  const first = hitParticles(0.13, 42, 175, 1350);
  const second = hitParticles(0.13, 42, 175, 1350);
  assert.equal(first.length, 4);
  assert.deepEqual(first, second);
  assert.equal(hitParticles(HIT_PARTICLE_LIFETIME, 42, 175, 1350).length, 0);
  assert.equal(hitParticles(-0.01, 42, 175, 1350).length, 0);
});

test("travel scales with burst width and stays inside the recorded envelope", () => {
  const age = HIT_PARTICLE_LIFETIME - 1e-6;
  const distance = (particles) =>
    Math.max(...particles.map((particle) => Math.hypot(particle.x, particle.y)));
  const small = distance(hitParticles(age, 7, 175, 1000));
  const large = distance(hitParticles(age, 7, 175, 2000));
  assert.ok(large > small * 1.9);
  assert.ok(large <= 2000 * 0.25 * (4 / 9) * 0.88 + 1);
});

test("square size follows the note width and stays inside the jitter band", () => {
  const progress = 0.5;
  const particles = hitParticles(progress * HIT_PARTICLE_LIFETIME, 11, 200, 1350);
  const sizeCurve = 0.5 + 0.5 * (1 - (1 - progress * 1.5) ** 2);
  const expected = 200 * 0.175 * 0.5 * sizeCurve;
  for (const particle of particles) {
    assert.ok(particle.radius >= expected * 0.92);
    assert.ok(particle.radius <= expected * 1.08);
  }
});
