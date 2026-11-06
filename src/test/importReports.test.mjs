/** Import reports and the RPE hotkey mapping keep the details users need. */
import assert from "node:assert/strict";
import test from "node:test";
import {
  forgetImportReport,
  importReportFor,
  recordImportReport,
} from "../frontend/screens/welcome/importReport.ts";
import { readRpeHotkeys } from "../core/migration/rpe.ts";

test("an import report is stored per project and replaced on re-import", () => {
  recordImportReport({
    projectId: "p1",
    title: "A",
    source: "RPE",
    issues: [{ scope: "A", detail: "cover.png missing" }],
  });
  recordImportReport({
    projectId: "p2",
    title: "B",
    source: "RPE",
    issues: [{ scope: "B", detail: "event layer dropped" }],
  });
  assert.equal(importReportFor("p1")?.issues.length, 1);
  recordImportReport({
    projectId: "p1",
    title: "A",
    source: "RPE",
    issues: [
      { scope: "A", detail: "cover.png missing" },
      { scope: "A", detail: "bezier flattened" },
    ],
  });
  assert.equal(importReportFor("p1")?.issues.length, 2);
  forgetImportReport("p1");
  assert.equal(importReportFor("p1"), null);
  forgetImportReport("p2");
});

test("RPE hotkeys keep unknown actions and unparsable bindings", () => {
  const report = readRpeHotkeys(
    ["AddTap Q", "NoSuchAction K", "AddDrag ???", "# comment", ""].join("\n"),
  );
  const mapped = report.entries.filter((entry) => entry.target);
  const unmapped = report.entries.filter((entry) => !entry.target);
  assert.equal(mapped.length, 1);
  assert.equal(mapped[0].target, "note.place.tap");
  assert.equal(unmapped.length, 2);
  assert.deepEqual(
    unmapped.map((entry) => entry.reason),
    ["unknown-action", "invalid-binding"],
  );
});
