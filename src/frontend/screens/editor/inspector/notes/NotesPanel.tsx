/**
 * Presents the selected-note summary and delegates editable fields to the note
 * property view. Selection and mutation remain in the editor runtime, so this
 * pane only subscribes to snapshots and emits design-system controls.
 */
import { useEffect, useLayoutEffect, useRef } from "react";
import { useTranslation } from "../../../../../i18n/react.ts";
import { mergeRefs } from "../../../../platform/mergeRefs.ts";
import { onboardingAnchorRef } from "../../../../onboarding/anchors.ts";
import { InspectorEmpty } from "../InspectorEmpty.tsx";
import { NotePropertiesView } from "./NotePropertiesView.tsx";
import { useEditorRuntimeValue } from "../../workspace/runtime/composition/EditorRuntime.tsx";
import type { NotePropertiesSnapshot } from "./model.ts";

/** Renders the selected note's properties. */
export function NotesPanel() {
  const noteProperties = useEditorRuntimeValue(
    (runtime) => runtime.ui.notes.properties,
    null as NotePropertiesSnapshot | null,
  );
  const { t } = useTranslation();
  const panel = useRef<HTMLDivElement>(null);
  const focusedField = useRef<string | null>(null);

  // A new revision remounts the property view so its drafts pick up external
  // values. That remount also drops DOM focus, which would stop a wheel edit
  // after its first step; put focus back on the same field after the commit.
  useLayoutEffect(() => {
    const root = panel.current;
    const field = focusedField.current;
    if (!root || !field) {
      return;
    }
    const active = document.activeElement;
    if (active instanceof HTMLElement && root.contains(active)) {
      return;
    }
    if (active !== null && active !== document.body && active !== document.documentElement) {
      focusedField.current = null;
      return;
    }
    const target = root.querySelector<HTMLElement>(`[data-inspector-field="${CSS.escape(field)}"]`);
    const focusable = target?.matches("input,select,textarea,button")
      ? target
      : target?.querySelector<HTMLElement>("input,select,textarea,button");
    focusable?.focus({ preventScroll: true });
  });

  // A pointer press outside the note fields means the user has moved on; a
  // later revision must not pull focus back into the pane.
  useEffect(() => {
    const clearOutside = (event: PointerEvent) => {
      const root = panel.current;
      if (!root || !(event.target instanceof Node) || root.contains(event.target)) {
        return;
      }
      focusedField.current = null;
    };
    document.addEventListener("pointerdown", clearOutside, true);
    return () => document.removeEventListener("pointerdown", clearOutside, true);
  }, []);

  return (
    <div
      ref={mergeRefs(panel, onboardingAnchorRef("notes-properties"))}
      className="notes-panel-properties"
      onFocusCapture={(event) => {
        const target = event.target;
        if (!(target instanceof Element)) {
          return;
        }
        const field = target
          .closest("[data-inspector-field]")
          ?.getAttribute("data-inspector-field");
        if (field) {
          focusedField.current = field;
        }
      }}
    >
      {noteProperties ? (
        <NotePropertiesView key={noteProperties.revision} {...noteProperties} />
      ) : (
        <InspectorEmpty>{t("editorPanels.inspector.emptyHint")}</InspectorEmpty>
      )}
    </div>
  );
}
