/**
 * Frame for the curve-note pane: the start/end capture buttons, the preview
 * toggle, and the shared curve form.
 *
 * Capture mode and field values come from runtime state; the panel never
 * computes the curve or builds events.
 */
import { Button } from "../../../../../design/components/button/Button.tsx";
import { useTranslation } from "../../../../../i18n/react.ts";
import { curveActions } from "./actions.ts";
import { CurveFieldsView } from "./CurveFieldsView.tsx";
import { useEditorRuntimeValue } from "../../workspace/runtime/composition/EditorRuntime.tsx";
import type { CurveFieldSnapshot, CurvePickMode } from "./model.ts";

/** Renders the curve-note pane controls and the shared form. */
export function CurvePanel() {
  const curvePickMode = useEditorRuntimeValue(
    (runtime) => runtime.ui.curve.pickMode,
    null as CurvePickMode,
  );
  const curveFields = useEditorRuntimeValue(
    (runtime) => runtime.ui.curve.fields,
    null as CurveFieldSnapshot | null,
  );
  const { t } = useTranslation();
  return (
    <>
      {/* Both picks are ordinary secondary actions: the explicit edge keeps the
          buttons distinct from the panel background in every state. */}
      <div className="curve-pick-actions">
        <Button
          variant="outlined"
          onClick={() => curveActions.captureCurveStart()}
          aria-pressed={curvePickMode === "start"}
        >
          {t("chrome.inspector.curveStart")}
        </Button>
        <Button
          variant="outlined"
          onClick={() => curveActions.captureCurveEnd()}
          aria-pressed={curvePickMode === "end"}
        >
          {t("chrome.inspector.curveEnd")}
        </Button>
      </div>
      {curveFields && <CurveFieldsView {...curveFields} />}
      <div className="curve-actions redux-footer-bar">
        <div className="redux-footer-actions">
          <Button variant="solid" onClick={() => curveActions.generateCurve()}>
            {t("chrome.inspector.curveGenerate")}
          </Button>
        </div>
      </div>
    </>
  );
}
