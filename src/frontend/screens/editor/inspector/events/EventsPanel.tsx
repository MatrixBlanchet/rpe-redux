/**
 * Hosts whichever event inspector the runtime selected, event or shader.
 *
 * Rows are built in `eventInspector.ts`; this frame only mounts the reported
 * component and re-keys the shader view per selection, so its internal parameter
 * choice resets with the selected track.
 */
import { createElement } from "react";
import { useTranslation } from "../../../../../i18n/react.ts";
import { InspectorEmpty } from "../InspectorEmpty.tsx";
import { useEditorRuntimeValue } from "../../workspace/runtime/composition/EditorRuntime.tsx";
import type { EventInspectorSnapshot } from "./model.ts";

/** Mounts the event inspector snapshot the runtime selected. */
export function EventsPanel() {
  const eventInspector = useEditorRuntimeValue(
    (runtime) => runtime.ui.events.inspector,
    null as EventInspectorSnapshot,
  );
  const { t } = useTranslation();
  return (
    <>
      {eventInspector?.kind === "event" &&
        createElement(eventInspector.component, eventInspector.props)}
      {eventInspector?.kind === "shader" &&
        createElement(eventInspector.component, {
          ...eventInspector.props,
          key: eventInspector.props.state.selection,
        })}
      {!eventInspector && (
        <InspectorEmpty>{t("editorPanels.inspector.event.emptyHint")}</InspectorEmpty>
      )}
    </>
  );
}
