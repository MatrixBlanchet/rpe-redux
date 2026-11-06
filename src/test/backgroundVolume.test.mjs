/** Background volume follows focus and preserves each audio owner's base level. */
import assert from "node:assert/strict";
import test from "node:test";
import "../core/settings/features/audio.ts";
import { settingsRegistry } from "../core/settings/settings.ts";
import { values } from "../core/state/values.ts";
import { rampGain } from "../core/media/gainRamp.ts";
import { bindBackgroundVolume } from "../frontend/platform/backgroundVolume.ts";

test("background setting defaults to 40 percent and follows focus and visibility", () => {
  assert.equal(settingsRegistry.definition("background-volume")?.default, 0.4);
  const previous = { window: globalThis.window, document: globalThis.document };
  const previousValue = values.byId.get("background-volume");
  const win = new EventTarget();
  const doc = new EventTarget();
  let focused = true;
  doc.hidden = false;
  doc.hasFocus = () => focused;
  globalThis.window = win;
  globalThis.document = doc;
  const levels = [];
  try {
    values.byId.set("background-volume", 0.4);
    const dispose = bindBackgroundVolume((value) => levels.push(value));
    assert.equal(levels.at(-1), 1);
    focused = false;
    win.dispatchEvent(new Event("blur"));
    assert.equal(levels.at(-1), 0.4);
    values.byId.set("background-volume", 0.2);
    assert.equal(levels.at(-1), 0.2);
    doc.hidden = true;
    focused = true;
    doc.dispatchEvent(new Event("visibilitychange"));
    assert.equal(levels.at(-1), 0.2);
    doc.hidden = false;
    doc.dispatchEvent(new Event("visibilitychange"));
    assert.equal(levels.at(-1), 1);
    dispose();
    const count = levels.length;
    win.dispatchEvent(new Event("blur"));
    assert.equal(levels.length, count);
  } finally {
    values.byId.set("background-volume", previousValue);
    globalThis.window = previous.window;
    globalThis.document = previous.document;
  }
});

test("a new gain transition holds the current level before ramping", () => {
  const calls = [];
  const gain = {
    cancelAndHoldAtTime(time) {
      calls.push(["hold", time]);
    },
    linearRampToValueAtTime(value, time) {
      calls.push(["ramp", value, time]);
    },
  };
  rampGain(gain, 5, 0.4);
  assert.deepEqual(calls, [
    ["hold", 5],
    ["ramp", 0.4, 5.36],
  ]);
});
