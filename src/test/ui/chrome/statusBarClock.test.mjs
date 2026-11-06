/** The status bar clock follows the interface language without changing the editor clock. */
import assert from "node:assert/strict";
import test from "node:test";
import { formatEditClock } from "../../../frontend/chrome/statusbar/chartInfoPresenter.ts";
import { getLanguage, setLanguage } from "../../../i18n/index.ts";

test("the edit clock is written as a digital clock in Chinese", () => {
  const previous = getLanguage();
  try {
    setLanguage("zh");
    assert.equal(formatEditClock("00 h, 00 m, 01 s"), "00:00:01");
  } finally {
    setLanguage(previous);
  }
});

test("the edit clock keeps explicit unit letters in English", () => {
  const previous = getLanguage();
  try {
    setLanguage("en");
    assert.equal(formatEditClock("00 h, 00 m, 01 s"), "00 h 00 m 01 s");
  } finally {
    setLanguage(previous);
  }
});

test("an unrecognized clock shape is left unchanged", () => {
  assert.equal(formatEditClock("01:02"), "01:02");
});
