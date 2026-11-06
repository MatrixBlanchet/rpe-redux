/** Document identity selector and window-title contract for editor chrome. */
import assert from "node:assert/strict";
import test from "node:test";
import {
  formatDocumentWindowTitle,
  selectDocumentIdentity,
} from "../../../frontend/screens/editor/workspace/session/documentIdentity.ts";

const BASE = {
  open: true,
  metadataName: "Blue Zenith",
  chartName: "chart.json",
  path: "D:/charts/blue-zenith.json",
  dirty: false,
  saving: false,
  documentReadOnly: false,
  collaborationActive: false,
  collaborationReadOnly: false,
  libraryProject: false,
};

test("no open document has no document identity", () => {
  const identity = selectDocumentIdentity({ open: false });
  assert.equal(identity.open, false);
  assert.equal(identity.title, "");
  assert.equal(identity.titleSource, "untitled");
  assert.equal(identity.path, null);
  assert.equal(identity.dirty, false);
  assert.equal(identity.saveState, "none");
  assert.equal(identity.access, "editable");
});

test("a saved document uses its metadata name and remains editable", () => {
  const identity = selectDocumentIdentity(BASE);
  assert.equal(identity.open, true);
  assert.equal(identity.title, "Blue Zenith");
  assert.equal(identity.titleSource, "metadata");
  assert.equal(identity.path, "D:/charts/blue-zenith.json");
  assert.equal(identity.saveState, "saved");
  assert.equal(identity.dirty, false);
  assert.equal(identity.access, "editable");
  assert.equal(identity.readOnly, false);
});

test("an unsaved document reports the dirty state", () => {
  const identity = selectDocumentIdentity({ ...BASE, dirty: true });
  assert.equal(identity.dirty, true);
  assert.equal(identity.saveState, "unsaved");
});

test("an in-flight save takes precedence over the dirty state", () => {
  const identity = selectDocumentIdentity({ ...BASE, dirty: true, saving: true });
  assert.equal(identity.dirty, true);
  assert.equal(identity.saving, true);
  assert.equal(identity.saveState, "saving");
});

test("a document opened read-only reports the read-only access", () => {
  const identity = selectDocumentIdentity({ ...BASE, documentReadOnly: true });
  assert.equal(identity.access, "read-only");
  assert.equal(identity.readOnly, true);
});

test("a collaboration viewer is marked as read-only collaboration", () => {
  const identity = selectDocumentIdentity({
    ...BASE,
    collaborationActive: true,
    collaborationReadOnly: true,
  });
  assert.equal(identity.collaboration, "viewer");
  assert.equal(identity.access, "collaboration-viewer");
  assert.equal(identity.readOnly, true);
});

test("a collaboration editor is marked as collaboration without read-only", () => {
  const identity = selectDocumentIdentity({ ...BASE, collaborationActive: true });
  assert.equal(identity.collaboration, "active");
  assert.equal(identity.access, "collaboration");
  assert.equal(identity.readOnly, false);
});

test("a chart without metadata falls back to its file stem or untitled", () => {
  const fromFile = selectDocumentIdentity({
    ...BASE,
    metadataName: "   ",
    chartName: "charts/without-name.pez",
  });
  assert.equal(fromFile.title, "without-name");
  assert.equal(fromFile.titleSource, "file");

  const untitled = selectDocumentIdentity({
    ...BASE,
    metadataName: "",
    chartName: "",
  });
  assert.equal(untitled.title, "");
  assert.equal(untitled.titleSource, "untitled");
});

test("the window title keeps the document name first and marks unsaved state", () => {
  assert.equal(
    formatDocumentWindowTitle("Blue Zenith", false, "RPE Redux"),
    "Blue Zenith — RPE Redux",
  );
  assert.equal(
    formatDocumentWindowTitle("Blue Zenith", true, "RPE Redux"),
    "Blue Zenith * — RPE Redux",
  );
  assert.equal(formatDocumentWindowTitle("  ", false, "RPE Redux"), "RPE Redux");
});
