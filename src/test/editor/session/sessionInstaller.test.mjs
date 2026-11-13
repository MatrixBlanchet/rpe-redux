/**
 * Installing a document replaces the editor session; the installer must re-apply
 * the editor-wide preferences that a fresh session would otherwise default.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { createChart } from "../../../core/global/chart/chart.ts";
import { EditorSession } from "../../../core/edit/session/session.ts";
import { createSessionInstaller } from "../../../frontend/screens/editor/workspace/document/lifecycle/sessionInstaller.ts";

/** The minimal replacement the installer reads. */
function replacement() {
  return {
    chart: createChart(),
    name: "chart.json",
    assets: new Map(),
    folders: new Set(),
    loadImages: false,
    diagnostics: [],
    readOnly: false,
  };
}

test("a replacement session adopts the editor preferences before the first frame", () => {
  let current = new EditorSession(createChart());
  let applied = 0;
  const install = createSessionInstaller({
    session: {
      current: () => current,
      replace: (session) => {
        current = session;
      },
    },
    mutationGate: { run: (kind, operation) => operation() },
    history: { clipboard: { attach() {} }, limit: () => 150, onChange() {} },
    resetSelectionView() {},
    recovery: { clearDraft() {}, autoSave: { reset() {} } },
    resetCurveDraft() {},
    installRecord() {},
    resetEditClock() {},
    hitSounds: { setProject() {} },
    images: { load() {} },
    applySettings() {
      applied += 1;
      // The real settings pass writes session-scoped preferences such as the
      // multi-line merge flag and the event cut density.
      current.multiLineMerge = false;
      current.cutDensity = 2;
    },
  });

  install(replacement());

  assert.equal(applied, 1);
  assert.equal(current.multiLineMerge, false);
  assert.equal(current.cutDensity, 2);
});
