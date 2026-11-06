/**
 * Relative history timestamps: second and minute caching, language selection,
 * and the bounded cache contract. The module runs without a DOM, so these tests
 * install only the document language the formatter reads.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  __testInternals,
  relativeTime,
} from "../frontend/screens/editor/inspector/relativeTime.ts";

const english = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
const chinese = new Intl.RelativeTimeFormat("zh-CN", { numeric: "auto" });

/** Installs a minimal document stub exposing the document language. */
function useLanguage(language) {
  globalThis.document = { documentElement: { lang: language } };
}

test.afterEach(() => {
  __testInternals.clearCache();
  delete globalThis.document;
});

test("second-granularity text advances with the injected clock", () => {
  useLanguage("en");
  assert.equal(relativeTime(0, 1_000), english.format(-1, "second"));
  assert.equal(relativeTime(0, 2_000), english.format(-2, "second"));
});

test("calls within the same second share one cached text", () => {
  useLanguage("en");
  const first = relativeTime(0, 1_000);
  const second = relativeTime(0, 1_600);
  assert.equal(first, english.format(-1, "second"));
  assert.equal(second, first);
  assert.equal(__testInternals.cacheSize(), 1);
});

test("crossing one minute switches from seconds to minutes", () => {
  useLanguage("en");
  __testInternals.clearCache();
  assert.equal(relativeTime(0, 1_000), english.format(-1, "second"));
  assert.equal(relativeTime(0, 60_500), english.format(-1, "minute"));
});

test("minute-granularity text stays cached until the next minute", () => {
  useLanguage("en");
  const first = relativeTime(0, 60_000);
  const second = relativeTime(0, 90_000);
  const third = relativeTime(0, 120_000);
  assert.equal(first, english.format(-1, "minute"));
  assert.equal(second, first);
  assert.equal(third, english.format(-2, "minute"));
});

test("the document language selects the formatter", () => {
  useLanguage("en");
  assert.equal(relativeTime(0, 5_000), english.format(-5, "second"));
  useLanguage("zh-CN");
  assert.equal(relativeTime(0, 5_000), chinese.format(-5, "second"));
});

test("the cache evicts oldest entries beyond its bound", () => {
  useLanguage("en");
  const now = 5_000_000;
  for (let index = 0; index < __testInternals.maxEntries + 128; index += 1) {
    relativeTime(now - index * 1_000, now);
  }
  assert.equal(__testInternals.cacheSize(), __testInternals.maxEntries);
  assert.equal(relativeTime(now - 1_000, now), english.format(-1, "second"));
});
