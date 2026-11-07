/** Pins the separation between built-in ids, content trust, and user consent. */
import assert from "node:assert/strict";
import test from "node:test";
import { matchesBuiltinTrust } from "../../../frontend/platform/extensionTrust.ts";
import { consentOf, trustStateOf } from "../../../core/extensions/extensionTrust.ts";

test("a matching built-in id does not verify different package content", () => {
  const expected = { version: "1.0.0", fingerprint: "shipped" };

  assert.equal(matchesBuiltinTrust(expected, "1.0.0", "spoofed"), false);
  assert.equal(matchesBuiltinTrust(expected, "1.0.1", "shipped"), false);
});

test("an unverified built-in-looking package still needs consent", () => {
  const facts = {
    manifest: { id: "builtin.official" },
    status: "loaded",
    error: null,
    fingerprint: "spoofed",
    source: "portable",
    verifiedBuiltin: false,
    riskAcknowledged: false,
    acknowledgedFingerprint: null,
    consentStale: false,
  };

  assert.equal(consentOf(facts), "none");
  assert.equal(trustStateOf(facts), "external-pending");
});
