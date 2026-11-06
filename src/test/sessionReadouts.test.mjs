/**
 * Session readout contract: the status-bar publisher reads only the session and
 * edit clock. It no longer materializes a metadata/media sentence that no
 * surface consumes.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { createChart } from "../core/global/chart/chart.ts";
import { EditorSession } from "../core/edit/session/session.ts";
import { createSessionReadouts } from "../frontend/screens/editor/workspace/runtime/bridge/sessionReadouts.ts";

test("publishing session readouts does not scan assets for a dead status cell", () => {
  const session = new EditorSession(createChart());
  let renders = 0;
  let markerPaints = 0;
  const readouts = createSessionReadouts({
    editClock: { format: () => "00 h, 00 m, 00 s" },
    createChartInfoPresenter: () => ({
      render() {
        renders += 1;
        return 1;
      },
      updateClock() {},
      dispose() {},
    }),
    renderTimelineMarkers() {
      markerPaints += 1;
    },
    // The old implementation called this to build a status string. The test
    // would fail if that read comes back without a visible consumer.
    assets() {
      throw new Error("session readouts must not inspect asset bytes");
    },
  });

  readouts.publish(session);
  assert.equal(renders, 1);
  assert.equal(markerPaints, 1);
  readouts.dispose();
});
