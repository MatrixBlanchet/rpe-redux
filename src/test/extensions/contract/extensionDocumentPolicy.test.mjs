/**
 * Extension document saves must use the host's user-visible flow, never a
 * caller-supplied filesystem target. The internal document API keeps its
 * explicit export path for host automation.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { document as documentApi } from "../../../core/api/document.ts";
import { values as valuesApi } from "../../../core/api/values.ts";
import { connectDocumentApi, getDocumentApi } from "../../../core/edit/document/api.ts";
import { gateExtensionApi } from "../../../core/extensions/capabilityGate.ts";

/** A host that records whether a save chose an export path or the user flow. */
function fakeHost() {
  const calls = [];
  let userFlowSaves = 0;
  let directExports = 0;
  return {
    calls,
    get userFlowSaves() {
      return userFlowSaves;
    },
    get directExports() {
      return directExports;
    },
    descriptor() {
      return {
        status: "open",
        path: "C:\\charts\\song.json",
        name: "song.json",
        format: "json",
      };
    },
    fingerprint() {
      return null;
    },
    chart() {
      return null;
    },
    dirty() {
      return false;
    },
    async create() {},
    async openPath() {},
    async openBytes() {
      return "loaded";
    },
    async save(path) {
      calls.push(path);
      // A path takes the direct export branch; no path enters the host's
      // user-visible flow instead of skipping it.
      if (path) {
        directExports += 1;
      } else {
        userFlowSaves += 1;
      }
      return "saved";
    },
    async close() {},
  };
}

/** A facade-shaped object with only the handles the gate reads at build time. */
function fakeApi(document) {
  return {
    version: "test",
    chart: {},
    transaction: {},
    selection: {},
    document,
    library: {},
    playback: {},
    settings: {},
    toolbar: {},
    sidebar: {},
    contextMenu: {},
    values: valuesApi,
    shortcuts: {},
    diagnostics: {},
    hitTest: {},
    preview: {},
    layout: {},
    workspace: {},
    help: {},
    extensions: {},
  };
}

test("an Extension save ignores a caller-supplied path", async () => {
  const host = fakeHost();
  const disconnect = connectDocumentApi(host);
  try {
    const gated = gateExtensionApi(
      fakeApi(documentApi),
      new Set(["document.read", "document.write"]),
      "policy.owner",
    );
    const result = await gated.document.save({ path: "D:\\outside\\evil.json" });
    assert.equal(result.ok, true);
    assert.deepEqual(host.calls, [undefined], "the Extension path reached the host save flow");
    assert.equal(host.userFlowSaves, 1, "the save bypassed the user-visible flow");
    assert.equal(host.directExports, 0, "the Extension wrote directly to its chosen path");
  } finally {
    disconnect();
  }
});

test("the internal document host still forwards an explicit export path", async () => {
  const host = fakeHost();
  const disconnect = connectDocumentApi(host);
  try {
    const result = await getDocumentApi().save({ path: "D:\\exports\\song.pez" });
    assert.equal(result.ok, true);
    assert.deepEqual(host.calls, ["D:\\exports\\song.pez"]);
    assert.equal(host.directExports, 1);
    assert.equal(host.userFlowSaves, 0);
  } finally {
    disconnect();
  }
});

test("the shared document facade keeps the path for automation", async () => {
  const host = fakeHost();
  const disconnect = connectDocumentApi(host);
  try {
    const result = await documentApi.save({ path: "D:\\exports\\facade.pez" });
    assert.equal(result.ok, true);
    assert.deepEqual(host.calls, ["D:\\exports\\facade.pez"]);
    assert.equal(host.directExports, 1, "the shared facade dropped the automation path");
    assert.equal(host.userFlowSaves, 0);
  } finally {
    disconnect();
  }
});
