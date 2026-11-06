/**
 * Owns the line-info readout: when it is visible and which scene or measure
 * values it shows for the selected line and event. Text assembly lives in
 * `lineInfoPresenter`; React only renders the published snapshot.
 */
import type { JudgeLineEvent } from "../../../../../../core/global/chart/chart.ts";
import { createValue } from "../../../../../../core/state/values.ts";
import type { SceneRuntime } from "../../../../../../core/global/chart/runtime/scene.ts";
import type { TempoMap } from "../../../../../../core/global/chart/timing/tempo.ts";
import { eventList } from "../../../../../../core/edit/events/eventTracks.ts";
import { buildLineInfoText } from "./lineInfoPresenter.ts";
import type { EditorSession } from "../../../../../../core/edit/session/session.ts";

/** Published visibility and text of the line-info readout. */
export interface LineInfoSnapshot {
  visible: boolean;
  text: string;
}
/** The line-info value cell type published by the controller. */
export type LineInfoState = ReturnType<typeof createLineInfoState>;

/** Creates the value cell that holds the published readout. */
export function createLineInfoState() {
  return createValue<LineInfoSnapshot>({ initial: { visible: false, text: "" } });
}

/**
 * Creates the readout controller that resolves the text for the current frame.
 *
 * The controller hides itself at home, without a line, or when turned off; a
 * caller supplies the clock, tempo, and optional event-list override.
 */
export function createLineInfoController(deps: {
  state: LineInfoState;
  scene: SceneRuntime;
  session: () => EditorSession;
  atHome: () => boolean;
  seconds: () => number;
  tempo: () => TempoMap;
  getEventList?: (session: EditorSession, type: string) => JudgeLineEvent[];
}) {
  let visible = false;

  /** Recomputes the published text, or hides the readout when it has no subject. */
  function update() {
    const session = deps.session();
    if (!visible || !session.line || deps.atHome()) {
      deps.state.update({ visible: false });
      return;
    }
    deps.state.update({
      text: buildLineInfoText(
        deps.scene,
        session.chart,
        session.lineIndex,
        deps.seconds(),
        deps.tempo(),
        session.eventSelection,
        (type) => (deps.getEventList ?? eventList)(session, type),
      ),
    });
    deps.state.update({ visible: true });
  }

  return {
    setVisible(value: boolean) {
      visible = value;
      deps.state.update({ visible: value });
    },
    toggle() {
      visible = !visible;
    },
    hide() {
      visible = false;
      deps.state.update({ visible: false });
    },
    update,
  };
}
