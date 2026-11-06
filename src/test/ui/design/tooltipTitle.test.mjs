/** Tooltip titles reject placeholder shapes while keeping real labels intact. */
import assert from "node:assert/strict";
import test from "node:test";
import { tooltipTitle } from "../../../design/patterns/tooltipTitle.ts";

test("drops placeholder-shaped titles", () => {
  for (const value of ["（0）", "(0)", "0", "（）", "()", "", "  ", undefined]) {
    assert.equal(tooltipTitle(value), "", String(value));
  }
});

test("keeps titles that carry words, units, or ranges", () => {
  for (const value of ["1x", "10%", "X 坐标", "截取起点（0–1）"]) {
    assert.equal(tooltipTitle(value), value);
  }
});
