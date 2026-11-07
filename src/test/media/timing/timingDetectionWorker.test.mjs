/** The timing worker's single fixed-BPM reply and transferred buffers. */
import assert from "node:assert/strict";
import test from "node:test";
import { analyzeTimingRequest } from "../../../frontend/screens/editor/workspace/timingDetection/timingDetectionWorkerProtocol.ts";

const SAMPLE_RATE = 22050;

test("the worker protocol replies with one fixed result and three transfers", () => {
  const samples = new Float32Array(SAMPLE_RATE * 4);
  const message = analyzeTimingRequest({
    type: "analyze",
    samples,
    sampleRate: SAMPLE_RATE,
    duration: 4,
  });
  assert.equal(message.reply.type, "result");
  const result = message.reply.result;
  assert.ok(result);
  assert.equal(result.bpm, 120);
  assert.equal(result.confidence, 0);
  assert.equal("mode" in result, false);
  assert.equal("variable" in result, false);
  assert.deepEqual(message.transfer, [
    result.waveform.peaks.buffer,
    result.onset.buffer,
    result.beatTimes.buffer,
  ]);
  assert.equal(message.transfer.length, 3);
  assert.ok(message.transfer.every((buffer) => buffer instanceof ArrayBuffer));
});

test("the worker protocol keeps a fixed answer for very short audio", () => {
  const message = analyzeTimingRequest({
    type: "analyze",
    samples: new Float32Array(16),
    sampleRate: SAMPLE_RATE,
    duration: 16 / SAMPLE_RATE,
  });
  assert.equal(message.reply.type, "result");
  assert.ok(message.reply.result);
  assert.ok(Number.isFinite(message.reply.result.bpm));
  assert.ok(message.reply.result.confidence >= 0 && message.reply.result.confidence <= 1);
  assert.equal(message.transfer.length, 3);
});
