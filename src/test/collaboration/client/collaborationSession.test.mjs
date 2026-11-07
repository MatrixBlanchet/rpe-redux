/** Verifies the session gate used by room roles and remote history entries. */
import assert from "node:assert/strict";
import test from "node:test";
import { createChart } from "../../../core/global/chart/chart.ts";
import { EditorSession } from "../../../core/edit/session/session.ts";
import { selectiveUndo } from "../../../core/edit/session/selectiveUndo.ts";
import { collaborationAccess } from "../../../core/collaboration/access.ts";

function renamed(chart, name) {
  return { ...chart, META: { ...chart.META, name } };
}

test("an idle client is not treated as a read-only viewer", () => {
  assert.deepEqual(collaborationAccess("", "viewer"), { active: false, readOnly: false });
  assert.deepEqual(collaborationAccess("ROOM", "viewer"), { active: true, readOnly: true });
  assert.deepEqual(collaborationAccess("ROOM", "editor"), { active: true, readOnly: false });
});

test("a viewer cannot commit, while an authoritative remote commit still applies", () => {
  const session = new EditorSession(createChart());
  session.setCollaborationAccess(true, true);
  assert.equal(session.commitChart("local", renamed(session.chart, "local")), false);
  assert.equal(session.commitRemoteChart("remote", renamed(session.chart, "remote")), true);
  assert.equal(session.chart.META.name, "remote");
});

test("linear undo stops at an authoritative remote entry", () => {
  const session = new EditorSession(createChart());
  session.setCollaborationAccess(true, false);
  assert.equal(session.commitRemoteChart("remote", renamed(session.chart, "remote")), true);
  assert.equal(session.travel("undo"), false);
  assert.equal(session.chart.META.name, "remote");
});

test("collaborative undo references the author's original transaction", () => {
  const session = new EditorSession(createChart());
  session.setCollaborationAccess(true, false);
  session.setCollaborationActor("actor-a");
  assert.equal(session.commitChart("local", renamed(session.chart, "local")), true);
  const entry = session.history.undoStack.at(-1);
  assert.equal(entry.origin.clientId, "actor-a");
  assert.match(entry.origin.requestId, /[0-9a-z-]/i);
  const result = selectiveUndo(session, entry.id, "undo local");
  assert.equal(result.status, "committed");
  const compensation = session.history.undoStack.at(-1);
  assert.equal(compensation.origin.kind, "collaborative-undo");
  assert.equal(compensation.origin.clientId, "actor-a");
  assert.equal(compensation.origin.undoOf, entry.origin.requestId);
  assert.notEqual(compensation.origin.requestId, entry.origin.requestId);

  session.setCollaborationActor("actor-b");
  assert.equal(selectiveUndo(session, entry.id, "not mine").status, "unavailable");
});

test("leaving the room permits local history again", () => {
  const session = new EditorSession(createChart());
  session.setCollaborationAccess(true, false);
  session.commitRemoteChart("remote", renamed(session.chart, "remote"));
  session.setCollaborationAccess(false, false);
  assert.equal(session.travel("undo"), true);
  assert.equal(session.chart.META.name, createChart().META.name);
});

test("room undo compensates the newest own entry beneath a remote commit", () => {
  const session = new EditorSession(createChart());
  session.setCollaborationAccess(true, false);
  session.setCollaborationActor("actor-a");
  assert.equal(session.commitChart("mine", renamed(session.chart, "mine")), true);
  const mine = session.history.undoStack.at(-1);
  const remote = {
    ...session.chart,
    META: { ...session.chart.META, level: "remote-level" },
  };
  assert.equal(session.commitRemoteChart("remote", remote), true);

  assert.equal(session.travel("undo"), true);
  assert.equal(session.chart.META.name, createChart().META.name);
  assert.equal(session.chart.META.level, "remote-level");
  const compensation = session.history.undoStack.at(-1);
  assert.equal(compensation.origin.kind, "collaborative-undo");
  assert.equal(compensation.origin.undoOf, mine.origin.requestId);
  assert.equal(session.travel("redo"), false);
});
