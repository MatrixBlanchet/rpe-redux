/** The shared z-index ladder: one ordered table of paint ranks, bottom to top. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "../..");
const tokens = readFileSync(resolve(root, "src/design/styles/tokens.less"), "utf8");

// Bottom-to-top order that `src/design/styles/tokens.less` documents. The title
// row and the modal layer share a rank on purpose: the modal scrim is a later
// portal at the same number, so it covers the title row, while the window
// controls stay above both.
const LADDER = [
  "--z-nav",
  "--z-content-overlay",
  "--z-floating",
  "--z-menu",
  "--z-search",
  "--z-collab",
  "--z-extension",
  "--z-titlebar",
  "--z-modal",
  "--z-guide",
  "--z-popover",
  "--z-debug",
  "--z-window-controls",
  "--z-toast",
  "--z-performance-hud",
];

/** Read one numeric rung from the token sheet, failing when it is absent. */
function rungValue(name) {
  const match = tokens.match(new RegExp(`${name}\\s*:\\s*(\\d+)\\s*;`, "u"));
  assert.ok(match, `${name} is missing from the ladder`);
  return Number(match[1]);
}

test("every floating layer has a rung and the rungs rise bottom to top", () => {
  const ranks = LADDER.map(rungValue);
  for (let index = 1; index < ranks.length; index += 1) {
    const previous = ranks[index - 1];
    const current = ranks[index];
    assert.ok(
      current >= previous,
      `${LADDER[index]} (${current}) must not paint below ${LADDER[index - 1]} (${previous})`,
    );
    if (LADDER[index - 1] === "--z-titlebar") {
      continue;
    }
    assert.ok(
      current - previous >= 10,
      `${LADDER[index]} must leave room below it for local child offsets`,
    );
  }
});

test("the title row and the modal layer keep their shared rank", () => {
  assert.equal(rungValue("--z-titlebar"), rungValue("--z-modal"));
});

test("root rungs stay compact and on the 100-step ladder", () => {
  for (const name of LADDER) {
    const value = rungValue(name);
    assert.ok(value > 0 && value <= 2000, `${name} must stay inside the compact ladder`);
    assert.equal(value % 100, 0, `${name} must sit on a 100-step rung`);
  }
});

test("only documented ranks exist, and the title-row popup stays local", () => {
  const defined = [...tokens.matchAll(/^\s*(--z-[a-z0-9-]+)\s*:\s*[^;]+;/gmu)].map(
    (match) => match[1],
  );
  const known = new Set([...LADDER, "--z-titlebar-popup"]);
  assert.deepEqual(
    defined.filter((name) => !known.has(name)),
    [],
    "every --z-* definition must belong to the documented ladder",
  );
  const popup = tokens.match(/--z-titlebar-popup\s*:\s*(-?\d+)\s*;/u);
  assert.ok(popup, "--z-titlebar-popup is missing");
  const popupRank = Number(popup[1]);
  assert.ok(
    popupRank >= -1 && popupRank <= 9,
    "title-row popups order themselves inside the title row, not on the root ladder",
  );
});
