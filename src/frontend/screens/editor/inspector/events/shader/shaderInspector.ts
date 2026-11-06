/**
 * Builds the shader inspector for the selected paint events.
 *
 * Definitions are read from the shipped GLSL and cached by shader path, and the
 * per-session UI state survives re-renders. Source loading is asynchronous, so a
 * late result publishes only while its update generation is current.
 */
import { selectedEvents, transformEvents } from "../../../../../../core/edit/events/eventEdits.ts";
import { shaderParameters } from "../../../../../../core/global/chart/shader/shaderEvents.ts";
import type { JudgeLineEvent } from "../../../../../../core/global/chart/chart.ts";
import type { EditorSession } from "../../../../../../core/edit/session/session.ts";
import { readShaderSource } from "../../../../../platform/shaderSource.ts";
import { t } from "../../../../../../i18n/index.ts";
import type { ShaderDefinition, ShaderInspectorState } from "./ShaderInspectorView.tsx";
import type { EventInspectorState } from "../model.ts";

const sources = new Map<string, Promise<ShaderDefinition[]>>();
const states = new WeakMap<EditorSession, ShaderInspectorState>();

/** Loads and caches a shader's parameter definitions by shader path. */
export function parametersFor(name: string, source: string): Promise<ShaderDefinition[]> {
  const portable = /(?:_pr\.glsl|\/pr\/)/i.test(source);
  const path = portable ? `pr/${name}_pr` : name;
  const cached = sources.get(path);
  if (cached) {
    return cached;
  }
  const pending = readShaderSource(`redux/shaders/${path}.glsl`)
    .then((text) => {
      if (text === null) {
        throw new Error(t("editorPanels.inspector.shader.loadFailed"));
      }
      return shaderParameters(text);
    })
    .catch((error: unknown) => {
      sources.delete(path);
      throw error;
    });
  sources.set(path, pending);
  return pending;
}

/** Publishes the shader inspector for the selected paint events. */
export function renderShaderInspector(
  session: EditorSession,
  reportError: (error: unknown) => void,
  refresh: () => void,
  inspectorState: EventInspectorState,
): void {
  const entries = selectedEvents(session).filter((entry) => entry.type === "paintEvents");
  const event = entries[0]?.event;
  if (!event) {
    inspectorState.clear();
    return;
  }
  const selection = `${session.lineIndex}:${entries.map((entry) => entry.index).join(",")}`;
  const existing = states.get(session);
  const shaderState =
    existing?.selection === selection ? existing : { selection, parameter: "", open: false };
  states.set(session, shaderState);
  const revision = inspectorState.beginUpdate();
  const change = (label: string, transform: (current: JudgeLineEvent) => JudgeLineEvent): void => {
    transformEvents(session, label, (current, type) =>
      type === "paintEvents" ? transform(current) : current,
    );
  };
  const props = {
    event,
    session,
    state: shaderState,
    reportError,
    refresh,
    parametersFor,
    setParameter: (parameter: string) => {
      shaderState.parameter = parameter;
    },
    setOpen: (open: boolean) => {
      shaderState.open = open;
    },
    setLiveEventEdit: (active: boolean) => {
      session.liveEventEdit = active;
    },
    setAutoAlign: (active: boolean) => {
      session.shaderAutoAlign = active;
    },
    change,
  };
  void import("./ShaderInspectorView.tsx")
    .then(({ ShaderInspectorView }) => {
      if (inspectorState.isCurrentUpdate(revision)) {
        inspectorState.inspector.set({ kind: "shader", component: ShaderInspectorView, props });
      }
    })
    .catch(reportError);
}
