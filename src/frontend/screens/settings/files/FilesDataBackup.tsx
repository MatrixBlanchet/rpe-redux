/**
 * The Files page's backup section.
 *
 * Selected app-data parts are exported as one file and restored through the same
 * host calls, with progress and failures reported inline.
 */
import { useState, useSyncExternalStore } from "react";
import { Button } from "../../../../design/components/button/Button.tsx";
import { InlineAlert } from "../../../../design/components/alert/InlineAlert.tsx";
import { Input } from "../../../../design/components/input/Input.tsx";
import { useTranslation } from "../../../../i18n/react.ts";
import {
  APP_DATA_PARTS,
  exportAppDataBackup,
  importAppDataBackup,
  type AppDataPart,
} from "../../../../core/platform/desktop/appDataBackup.ts";
import { preferences } from "../../../../core/state/preferences.ts";
import { isStorageFailure } from "../../../../core/platform/storageFailure.ts";
import { requestConfirm } from "../../../overlays/modals/prompts.ts";

/** Render an unknown failure as its message text. */
function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Export or restore selected application-data parts and report the outcome inline. */
export function FilesDataBackup() {
  const { t } = useTranslation();
  const status = useSyncExternalStore(
    (listener) => preferences.subscribeStatus(listener),
    () => preferences.status(),
    () => preferences.status(),
  );
  const [parts, setParts] = useState<readonly AppDataPart[]>(APP_DATA_PARTS);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState("");
  const [error, setError] = useState("");

  /** Add or remove one part while preserving the canonical part order. */
  const toggle = (part: AppDataPart, checked: boolean) =>
    setParts((current) =>
      checked
        ? [...current.filter((entry) => entry !== part), part]
        : current.filter((entry) => entry !== part),
    );

  /** Write the selected parts to one backup file chosen by the host. */
  const exportBackup = async () => {
    setBusy(true);
    setResult("");
    setError("");
    try {
      if (!parts.length) {
        setError(t("settings.backup.noParts"));
        return;
      }
      const path = await exportAppDataBackup(parts);
      if (path) {
        setResult(t("settings.backup.success", { path }));
      }
    } catch (failure) {
      setError(
        isStorageFailure(failure)
          ? t("system.library.storageError")
          : t("settings.backup.error", { message: messageOf(failure) }),
      );
    } finally {
      setBusy(false);
    }
  };

  /** Restore the selected parts from a backup file and surface a restart notice. */
  const importBackup = async () => {
    setBusy(true);
    setResult("");
    setError("");
    try {
      if (!parts.length) {
        setError(t("settings.backup.noParts"));
        return;
      }
      const accepted = await requestConfirm({
        title: t("settings.backup.importConfirmTitle"),
        description: t("settings.backup.importConfirmDescription"),
        label: t("settings.backup.import"),
        cancelLabel: t("common.action.cancel"),
        destructive: true,
      });
      if (!accepted) {
        return;
      }
      const outcome = await importAppDataBackup(parts);
      if (!outcome) {
        return;
      }
      setResult(
        outcome.restartRequired
          ? t("settings.backup.importRestart", { count: outcome.parts.length })
          : t("settings.backup.importSuccess", { count: outcome.parts.length }),
      );
    } catch (failure) {
      const message = messageOf(failure);
      // Host conflicts append the conflicting path after this prefix.
      const marker = "backup_resource_conflict:";
      const position = message.indexOf(marker);
      setError(
        position >= 0
          ? t("settings.backup.resourceConflict", { path: message.slice(position + marker.length) })
          : t("settings.backup.importError", { message }),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="redux-setting-group redux-data-backup">
      <h3>{t("settings.group.backup")}</h3>
      <div className="redux-data-backup-body">
        <p className="redux-setting-description">{t("settings.backup.description")}</p>
        {status.error && (
          <InlineAlert className="modal-error">
            {t("settings.backup.preferenceWarning", { message: status.error })}
          </InlineAlert>
        )}
        <div className="redux-data-backup-parts">
          {APP_DATA_PARTS.map((part) => (
            <label key={part} className="redux-data-backup-part">
              <Input
                type="checkbox"
                checked={parts.includes(part)}
                onChange={(event) => toggle(part, event.currentTarget.checked)}
              />
              {t(`settings.backup.part.${part}`)}
            </label>
          ))}
        </div>
        <div className="redux-footer-actions">
          <Button variant="outlined" onClick={() => void exportBackup()} disabled={busy}>
            {busy ? t("settings.backup.busy") : t("settings.backup.action")}
          </Button>
          <Button variant="danger" onClick={() => void importBackup()} disabled={busy}>
            {t("settings.backup.import")}
          </Button>
        </div>
        {result && <p className="redux-setting-feedback">{result}</p>}
        {error && <InlineAlert className="modal-error">{error}</InlineAlert>}
      </div>
    </section>
  );
}
