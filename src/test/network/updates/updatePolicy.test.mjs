/** Verify the bandwidth policy used before automatic update package downloads. */
import assert from "node:assert/strict";
import test from "node:test";
import { allowsAutomaticDownload } from "../../../core/platform/desktop/updatePolicy.ts";

test("never blocks every connection", () => {
  for (const connection of ["wifi", "cellular", "ethernet", "other", "offline", "unknown"]) {
    assert.equal(
      allowsAutomaticDownload("never", {
        kind: connection,
        available: connection !== "offline" && connection !== "unknown",
        metered: null,
      }),
      false,
    );
  }
});

test("all permits connected network classes but not unknown or offline", () => {
  for (const kind of ["wifi", "cellular", "ethernet", "other"]) {
    assert.equal(allowsAutomaticDownload("all", { kind, available: true, metered: null }), true);
  }
  assert.equal(
    allowsAutomaticDownload("all", { kind: "offline", available: false, metered: null }),
    false,
  );
  assert.equal(
    allowsAutomaticDownload("all", { kind: "unknown", available: false, metered: null }),
    false,
  );
});

test("wifi policy accepts only an unmetered Wi-Fi connection", () => {
  assert.equal(
    allowsAutomaticDownload("wifi", { kind: "wifi", available: true, metered: null }),
    true,
  );
  assert.equal(
    allowsAutomaticDownload("wifi", { kind: "wifi", available: true, metered: true }),
    false,
  );
  assert.equal(
    allowsAutomaticDownload("wifi", { kind: "ethernet", available: true, metered: false }),
    false,
  );
  assert.equal(
    allowsAutomaticDownload("wifi", { kind: "cellular", available: true, metered: true }),
    false,
  );
  assert.equal(
    allowsAutomaticDownload("wifi", { kind: "unknown", available: true, metered: null }),
    false,
  );
});
