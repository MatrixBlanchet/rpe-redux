/**
 * The manual update-check row on the Help page.
 *
 * The row is a label-field whose only action is the check button. Checking
 * happens in place with the shared spinner, and the result arrives as a toast so
 * the settings list stays four quiet rows.
 */
import { useState } from "react";
import { Spinner } from "../../../../design/components/spinner/Spinner.tsx";
import { Button } from "../../../../design/components/button/Button.tsx";
import { useTranslation } from "../../../../i18n/react.ts";
import { registerSettingControl } from "../settingsContributions.ts";
import type { SettingControlProps } from "../settingsContributions.ts";
import { updateErrorKey } from "../updates/updatePresentation.ts";
import { checkForUpdates, getUpdateState } from "../updates/updateStore.ts";
import { showToast } from "../../../../design/patterns/ToastHost.tsx";

/** Manual update check that reports its result as a toast. */
export function UpdateVerifyControl({ field }: SettingControlProps) {
  const { t } = useTranslation();
  const [checking, setChecking] = useState(false);

  /** Run one check and translate the resulting phase into a toast. */
  const check = async () => {
    if (checking) {
      return;
    }
    setChecking(true);
    try {
      await checkForUpdates();
      const state = getUpdateState();
      const source = t("settings.updates.verify.label");
      if (state.phase === "error") {
        showToast({
          message: t(updateErrorKey(state.errorCode), { message: state.errorDetail }),
          level: "error",
          source,
        });
      } else if (state.phase === "available" && state.latest) {
        showToast({
          message: t("settings.updates.available", { version: state.latest.version }),
          level: "info",
          source,
        });
      } else if (state.phase === "up-to-date") {
        showToast({ message: t("settings.updates.upToDate"), level: "info", source });
      } else if (state.phase === "unconfigured") {
        showToast({ message: t("settings.updates.unconfigured"), level: "info", source });
      }
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="redux-update-verify" data-update-verify>
      <Button
        id={field.key}
        variant="outlined"
        disabled={checking}
        aria-busy={checking}
        onClick={() => void check()}
      >
        {checking && <Spinner label={t("settings.updates.checking")} />}
        {t("settings.updates.verify.action")}
      </Button>
    </div>
  );
}

registerSettingControl("update-verify", UpdateVerifyControl);
