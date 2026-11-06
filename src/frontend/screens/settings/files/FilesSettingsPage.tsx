/** The Files page: backup export/import. */
import { FilesDataBackup } from "./FilesDataBackup.tsx";
import { registerSettingsPage } from "../settingsContributions.ts";

/** The Files page body; the backup section owns every control. */
function FilesSettingsPage() {
  return <FilesDataBackup />;
}

registerSettingsPage("files", {
  keywords: "settings.search.backupKeywords",
  component: FilesSettingsPage,
});
