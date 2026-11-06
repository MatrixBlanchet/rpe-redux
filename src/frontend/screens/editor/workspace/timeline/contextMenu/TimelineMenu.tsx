/**
 * Timeline right-click menu: shared context rows plus the marker actions the
 * timeline publishes with its snapshot.
 *
 * Row composition, shortcut hints, and contributed entries live in the shared
 * overlay component; this site only supplies its snapshot.
 */
import { useState } from "react";
import { useTranslation } from "../../../../../../i18n/react.ts";
import { ContextMenuPopup } from "../../../../../overlays/contextMenu/ContextMenuPopup.tsx";
import { ContextMenuRows } from "../../../../../overlays/contextMenu/ContextMenuRows.tsx";
import { useEditorRuntime } from "../../runtime/composition/EditorRuntime.tsx";
import { createTimelineMenuState } from "./timelineMenuState.ts";

/** The timeline's right-click menu. */
export function TimelineMenu() {
  const { t } = useTranslation();
  const runtime = useEditorRuntime();
  const [fallback] = useState(createTimelineMenuState);
  const store = runtime?.ui.timelineMenu ?? fallback;
  return (
    <ContextMenuPopup
      store={store}
      label={t("workspace.dialogs.timelineMenu")}
      className="timeline-menu"
    >
      {(snapshot, close) => (
        <ContextMenuRows
          surface={snapshot.surface}
          target={snapshot.target}
          actions={snapshot.actions}
          close={close}
        />
      )}
    </ContextMenuPopup>
  );
}
