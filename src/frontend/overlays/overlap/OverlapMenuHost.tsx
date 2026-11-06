/**
 * Renders the layer-style overlap picker at the pointer position.
 *
 * The picker uses the shared menu renderer for consistent row anatomy, but it
 * stays a left-click chooser and never inherits right-click commands.
 */
import { ContextMenuPopup } from "../contextMenu/ContextMenuPopup.tsx";
import { ContextMenuRows } from "../contextMenu/ContextMenuRows.tsx";
import { useTranslation } from "../../../i18n/react.ts";
import { overlapMenu } from "./overlapMenu.ts";
import { overlapMenuContextSurface } from "./overlapMenuModel.ts";

/** Hosts the overlap picker and closes it after a choice runs. */
export function OverlapMenuHost() {
  const { t } = useTranslation();
  return (
    <ContextMenuPopup
      store={overlapMenu}
      label={t("editor.overlap.title")}
      className="overlap-picker"
    >
      {(snapshot, close) => (
        <ContextMenuRows
          surface={overlapMenuContextSurface()}
          actions={snapshot.actions}
          close={close}
          leading={<div className="overlap-picker-heading">{snapshot.title}</div>}
        />
      )}
    </ContextMenuPopup>
  );
}
