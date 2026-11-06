/** Checks desktop prerequisites run together and all finish before failure returns. */
import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runBuildPrerequisites } from "../../scripts/buildPrerequisites.mjs";

test("independent prerequisites overlap and both complete", async () => {
  const dir = mkdtempSync(join(tmpdir(), "redux-build-test-"));
  try {
    for (const [own, other] of [
      ["a", "b"],
      ["b", "a"],
    ]) {
      writeFileSync(
        join(dir, `${own}.mjs`),
        `import { writeFileSync, existsSync } from "node:fs";\nwriteFileSync("${own}.started", "");\nconst deadline = Date.now() + 4000;\nwhile (!existsSync("${other}.started")) { if (Date.now() > deadline) process.exit(1); await new Promise(resolve => setTimeout(resolve, 10)); }\n`,
      );
    }
    await runBuildPrerequisites([join(dir, "a.mjs"), join(dir, "b.mjs")], dir);
    assert.equal(existsSync(join(dir, "a.started")), true);
    assert.equal(existsSync(join(dir, "b.started")), true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a failed prerequisite waits for the other child before rejecting", async () => {
  const dir = mkdtempSync(join(tmpdir(), "redux-build-test-"));
  try {
    writeFileSync(join(dir, "fail.mjs"), "process.exit(7);\n");
    writeFileSync(
      join(dir, "finish.mjs"),
      'import { writeFileSync } from "node:fs"; await new Promise(resolve => setTimeout(resolve, 100)); writeFileSync("finished", "");\n',
    );
    await assert.rejects(
      runBuildPrerequisites([join(dir, "fail.mjs"), join(dir, "finish.mjs")], dir),
      /failed \(7\)/,
    );
    assert.equal(existsSync(join(dir, "finished")), true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
