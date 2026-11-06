/**
 * Title-bar badge for an imported chart's compatibility report.
 *
 * It appears only while the open document came from an import that recorded
 * issues, and it opens the same list the import notice links to. A file opened
 * directly, or an import that carried everything, shows nothing.
 */
import { useSyncExternalStore } from "react";
import { ChipButton } from "../../../design/components/chip/ChipButton.tsx";
import { useTranslation } from "../../../i18n/react.ts";
import { values } from "../../../core/state/values.ts";
import { editorProjectId } from "../../../core/edit/state/publishedValues.ts";
import { showImportReport } from "../../overlays/modals/importReportPrompt.ts";
import { useImportReports } from "../../screens/welcome/importReport.ts";

// Stable store bindings: an inline subscribe function makes React re-subscribe
// on every render of the title bar.
const subscribeProjectId = (listener: () => void): (() => void) =>
  values.byId.subscribe(editorProjectId.id, listener);
const readProjectId = (): string => values.byId.get<string>(editorProjectId.id);

/** A warning pill pointing at the current project's import report. */
export function ImportBadge() {
  const { t } = useTranslation();
  const projectId = useSyncExternalStore(subscribeProjectId, readProjectId, readProjectId);
  const reports = useImportReports();
  const report = reports.find((entry) => entry.projectId === projectId);
  if (!report) {
    return null;
  }
  return (
    <ChipButton
      className="redux-import-badge"
      icon="info"
      data-tip-title={t("workspace.welcome.importReport.badgeHint")}
      onClick={() => showImportReport(report.source, [report])}
    >
      {t("workspace.welcome.importReport.badge", { count: report.issues.length })}
    </ChipButton>
  );
}
