/** The build flag contract: one output mode, one optional profile, no guesses. */
import assert from "node:assert/strict";
import test from "node:test";
import { BUILD_HELP, parseBuildFlags } from "../../scripts/buildFlags.mjs";

test("no flag selects the release installer", () => {
  assert.deepEqual(parseBuildFlags([]), { help: false, mode: "release", fast: false });
});

test("output modes and the fast profile parse independently", () => {
  assert.deepEqual(parseBuildFlags(["--debug"]), { help: false, mode: "debug", fast: false });
  assert.deepEqual(parseBuildFlags(["--portable"]), {
    help: false,
    mode: "portable",
    fast: false,
  });
  assert.deepEqual(parseBuildFlags(["--fast"]), { help: false, mode: "release", fast: true });
  assert.deepEqual(parseBuildFlags(["--portable", "--fast"]), {
    help: false,
    mode: "portable",
    fast: true,
  });
});

test("help wins over build work and names every flag", () => {
  assert.deepEqual(parseBuildFlags(["--help"]), { help: true });
  assert.deepEqual(parseBuildFlags(["-h"]), { help: true });
  for (const flag of ["--debug", "--portable", "--fast"]) {
    assert.ok(BUILD_HELP.includes(flag), `${flag} is missing from the help text`);
  }
});

test("unknown and conflicting flags fail with an actionable message", () => {
  assert.throws(() => parseBuildFlags(["--release"]), /Unknown build flag: --release/);
  assert.throws(() => parseBuildFlags(["--debug", "--portable"]), /cannot be used together/);
  assert.throws(() => parseBuildFlags(["--debug", "--fast"]), /cannot be used together/);
});
