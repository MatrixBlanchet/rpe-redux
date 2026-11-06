/**
 * Verifies the curve-note editor releases its anchor pick and preview ghost when
 * its pane closes.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { createValue } from "../../../core/state/values.ts";
import { createCurveEditor } from "../../../frontend/screens/editor/inspector/curveNotes/curveEditor.ts";

/** Creates a curve editor with no timeline or host side effects. */
function createTestEditor() {
  const fields = createValue({ initial: null });
  const pickMode = createValue({ initial: null });
  let invalidations = 0;
  const editor = createCurveEditor({
    state: { fields, pickMode },
    getDivision: () => 4,
    getNotes: () => [],
    setPickMode: pickMode.set,
    activatePane: () => {},
    showSingleNoteTimeline: () => {},
    closePane: () => {},
    invalidate: () => {
      invalidations += 1;
    },
    notify: () => {},
    reportError: () => {},
    commit: () => {},
  });
  return { editor, pickMode, invalidations: () => invalidations };
}

test("deactivating the curve editor cancels an in-progress anchor pick", () => {
  const { editor, pickMode } = createTestEditor();

  editor.capture(false);
  assert.equal(pickMode.get(), "start");
  editor.deactivate();
  assert.equal(pickMode.get(), null);
});

test("deactivating the curve editor drops its preview ghost", () => {
  const { editor, invalidations } = createTestEditor();

  editor.openPanel();
  assert.ok(editor.ghost().length > 0, "an open pane previews its anchors");

  editor.setPreview(false);
  assert.deepEqual(editor.ghost(), [], "the preview toggle hides the ghost");
  editor.setPreview(true);
  assert.ok(editor.ghost().length > 0, "turning the preview back on restores it");

  const before = invalidations();
  editor.deactivate();
  assert.deepEqual(
    editor.ghost(),
    [],
    "leaving the pane drops the ghost even with preview enabled and valid values",
  );
  assert.ok(invalidations() > before, "leaving the pane requests an immediate repaint");
});
