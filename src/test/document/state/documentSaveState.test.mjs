/**
 * Saved-state ownership: the history fingerprint is the dirty baseline, a
 * replaced chart with equal content stays clean, and one explicit save
 * publishes one saved revision.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { createChart } from "../../../core/global/chart/chart.ts";
import { createDocumentChangeCoordinator } from "../../../core/edit/document/changeCoordinator.ts";
import { History } from "../../../core/edit/session/history.ts";
import { EditorSession } from "../../../core/edit/session/session.ts";
import { applyChartTransaction } from "../../../core/edit/transaction/preview.ts";

/** Copy a chart with a different metadata name. */
function named(chart, name) {
  return { ...chart, META: { ...chart.META, name } };
}

test("a saved fingerprint keeps an equal replacement chart clean", () => {
  const history = new History(createChart());
  const edited = named(history.document, "edited");
  history.record("edit", edited, {}, {}, { normalized: true });
  assert.equal(history.dirty, true);

  history.markSaved(edited);
  assert.equal(history.dirty, false);

  // A save can install a new chart object with the same content.
  history.document = named(history.document, "edited");
  assert.equal(history.dirty, false);

  history.document = named(history.document, "changed");
  assert.equal(history.dirty, true);
});

test("undo after a save becomes dirty again", () => {
  const session = new EditorSession(createChart());
  const result = applyChartTransaction(session, { metadata: { name: "saved" } });
  assert.equal(result.status, "committed");
  session.history.markSaved();
  assert.equal(session.history.dirty, false);

  assert.equal(session.travel("undo"), true);
  assert.equal(session.history.dirty, true);
  assert.equal(session.travel("redo"), true);
  assert.equal(session.history.dirty, false);
});

test("markUnsaved requires an initial save and markSaved clears it", () => {
  const history = new History(createChart());
  assert.equal(history.dirty, false);
  history.markUnsaved();
  assert.equal(history.dirty, true);
  history.markSaved();
  assert.equal(history.dirty, false);
});

test("a created document stays clean until an edit and returns clean after a save", () => {
  const session = new EditorSession(createChart());
  // Mirrors `document.create`: the installed chart becomes the coordinator's
  // baseline before any edit is accepted.
  const coordinator = createDocumentChangeCoordinator();
  coordinator.replaceDocument({
    chartFingerprint: session.history.fingerprint(),
    savedChartFingerprint: session.history.savedFingerprint,
  });
  // Mirrors the document runtime gate: the coordinator copies the history
  // baseline on every accepted mutation instead of deriving its own.
  session.setMutationGate({
    run: (kind, operation) =>
      coordinator.admitSync({
        kind,
        run: operation,
        revisions: () => {
          const history = session.history;
          return {
            chartFingerprint: history.fingerprint(),
            savedChartFingerprint: history.savedFingerprint,
          };
        },
      }),
  });

  assert.equal(session.history.dirty, false);
  assert.equal(coordinator.snapshot().dirty, false);

  const result = applyChartTransaction(session, { metadata: { name: "edited" } });
  assert.equal(result.status, "committed");
  assert.equal(session.history.dirty, true);
  assert.equal(coordinator.snapshot().dirty, true);

  session.history.markSaved();
  coordinator.admitSync({
    kind: "save",
    run: () => undefined,
    revisions: () => {
      const history = session.history;
      return {
        chartFingerprint: history.fingerprint(),
        savedChartFingerprint: history.savedFingerprint,
        source: "synced",
      };
    },
  });
  assert.equal(session.history.dirty, false);
  assert.equal(coordinator.snapshot().dirty, false);
});

test("one explicit save publishes one saved revision transition", async () => {
  const coordinator = createDocumentChangeCoordinator({
    initial: {
      chartFingerprint: "a",
      savedChartFingerprint: "a",
      lifecycle: "open",
      source: "synced",
    },
  });
  let previous = coordinator.snapshot().revisions.savedChartFingerprint;
  const transitions = [];
  const unsubscribe = coordinator.subscribe((state) => {
    if (state.revisions.savedChartFingerprint !== previous) {
      previous = state.revisions.savedChartFingerprint;
      transitions.push(previous);
    }
  });
  try {
    coordinator.admitSync({
      kind: "history",
      run: () => undefined,
      revisions: () => ({ chartFingerprint: "b", savedChartFingerprint: "a" }),
    });
    assert.equal(coordinator.snapshot().dirty, true);

    const admitted = await coordinator.submit({
      kind: "save",
      run: () => ({
        status: "accepted",
        revisions: {
          chartFingerprint: "b",
          savedChartFingerprint: "b",
          source: "synced",
        },
      }),
    });
    assert.equal(admitted.status, "accepted");
    assert.equal(coordinator.snapshot().dirty, false);
    assert.deepEqual(transitions, ["b"]);
  } finally {
    unsubscribe();
  }
});
