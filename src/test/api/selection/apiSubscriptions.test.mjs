/** Subscription handles return disposers directly instead of result envelopes. */
import assert from "node:assert/strict";
import test from "node:test";
import { selection } from "../../../core/api/selection.ts";
import { createChart } from "../../../core/global/chart/chart.ts";
import { connectSelectionApi } from "../../../core/edit/selection/api.ts";
import { EditorSession } from "../../../core/edit/session/session.ts";

test("selection.subscribe returns a disposer before and after the editor mounts", () => {
  const unmounted = selection.subscribe(() => {});
  assert.equal(typeof unmounted, "function");
  unmounted();

  const chart = createChart();
  const session = new EditorSession(chart);
  const disconnect = connectSelectionApi({ session: () => session });
  let calls = 0;
  try {
    const stop = selection.subscribe(() => {
      calls += 1;
    });
    assert.equal(typeof stop, "function");
    assert.equal("ok" in stop, false);
    session.notify();
    assert.equal(calls, 1);
    stop();
    session.notify();
    assert.equal(calls, 1, "an unsubscribed listener must stop receiving snapshots");
  } finally {
    disconnect();
  }
});
