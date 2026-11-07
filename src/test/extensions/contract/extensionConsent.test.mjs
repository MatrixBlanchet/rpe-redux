/**
 * Per-capability consent rules for the Extension install dialog.
 *
 * Pure cases pin the risk grouping, default selection, all-or-nothing decision,
 * and sensitive set.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  CONSENT_RISK_ORDER,
  consentDecision,
  consentGroups,
  defaultConsentSelection,
  sensitiveCapabilities,
} from "../../../frontend/screens/settings/extensions/capabilityConsent.ts";

/** Flatten grouped rows back to capability names for order assertions. */
function capabilitiesOf(groups) {
  return groups.flatMap((group) => group.rows.map((row) => row.capability));
}

test("consent groups keep the read, write, sensitive order", () => {
  const groups = consentGroups([
    "ui.dialog",
    "chart.write",
    "chart.read",
    "document.write",
    "chart.read",
  ]);
  assert.deepEqual(
    groups.map((group) => group.risk),
    [...CONSENT_RISK_ORDER],
  );
  assert.deepEqual(
    groups.map((group) => group.rows.length),
    [1, 1, 2],
  );
  assert.deepEqual(capabilitiesOf(groups), [
    "chart.read",
    "chart.write",
    "document.write",
    "ui.dialog",
  ]);
});

test("only declared capabilities and non-empty groups are shown", () => {
  const groups = consentGroups(["chart.read"]);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].risk, "read");
  assert.deepEqual(capabilitiesOf(groups), ["chart.read"]);
  assert.deepEqual(consentGroups([]), []);
});

test("read rows start checked and write or sensitive rows stay unchecked", () => {
  const selection = defaultConsentSelection([
    "chart.write",
    "chart.read",
    "document.write",
    "ui.notice",
  ]);
  assert.deepEqual([...selection], ["chart.read"]);
});

test("unchecking any declared capability blocks installation and names it", () => {
  const declared = ["chart.read", "chart.write", "document.write"];

  const partial = consentDecision(declared, new Set(["chart.read"]));
  assert.equal(partial.ok, false);
  assert.deepEqual(partial.missing, ["chart.write", "document.write"]);

  const readUnchecked = consentDecision(declared, new Set(["chart.write", "document.write"]));
  assert.equal(readUnchecked.ok, false);
  assert.deepEqual(readUnchecked.missing, ["chart.read"]);

  const complete = consentDecision(declared, new Set(declared));
  assert.equal(complete.ok, true);
  assert.deepEqual(complete.missing, []);

  assert.equal(consentDecision(declared, declared).ok, true);
});

test("sensitive capabilities are the second-confirmation set", () => {
  assert.deepEqual(
    sensitiveCapabilities(["ui.dialog", "chart.write", "document.write", "chart.read"]),
    ["document.write", "ui.dialog"],
  );
});

test("the deprecated host.patch name never reaches consent", () => {
  assert.deepEqual(capabilitiesOf(consentGroups(["host.patch"])), []);
  assert.deepEqual([...defaultConsentSelection(["host.patch"])], []);
  assert.deepEqual(consentDecision(["host.patch"], []), { ok: true, missing: [] });
  assert.deepEqual(sensitiveCapabilities(["host.patch"]), []);
});
