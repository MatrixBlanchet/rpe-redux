/**
 * The one-time test-version notice shown after a prerelease editor is ready.
 *
 * The notice is version-bound: the opt-out footer action records the current
 * product version, so an update shows it again while ordinary launches stay
 * quiet. It waits for the chart-loading dialog to leave first, so it never
 * covers a document that is still opening. Stable versions never render it.
 */
import { useEffect, useState } from "react";
import { Button } from "../../../design/components/button/Button.tsx";
import { Modal } from "../../../design/components/modal/Modal.tsx";
import { appVersion } from "../../../core/platform/appInfo.ts";
import { loadingProgress } from "../../../core/global/document/loading.ts";
import { PREFERENCE_SECTIONS, preferences } from "../../../core/state/preferences.ts";
import { isPrereleaseVersion } from "../../../core/utils/version.ts";
import { isRecord } from "../../../core/utils/guards.ts";
import { useTranslation } from "../../../i18n/react.ts";

const DISMISSED_VERSION_KEY = "startup.test-feature-warning.version";
const CHART_SETTLE_POLL_MS = 150;
/** Four quiet polls (600 ms) let a startup document open and finish loading. */
const CHART_SETTLE_TICKS = 4;

/** Reads the product version the notice was last dismissed for. */
function dismissedVersion(): string | null {
  const values = preferences.read<unknown>(PREFERENCE_SECTIONS.values, null);
  if (!isRecord(values)) {
    return null;
  }
  const value = values[DISMISSED_VERSION_KEY];
  return typeof value === "string" && value.trim() ? value : null;
}

/** Records the current product version as dismissed. */
function rememberVersion(version: string): void {
  const values = preferences.read<unknown>(PREFERENCE_SECTIONS.values, null);
  preferences.write(PREFERENCE_SECTIONS.values, {
    ...(isRecord(values) ? values : {}),
    [DISMISSED_VERSION_KEY]: version,
  });
}

/** Shown once per prerelease version on user-facing hosts. */
export function ExperimentalWarning({ enabled }: { enabled: boolean }) {
  const { t } = useTranslation();
  const [version, setVersion] = useState("");
  const [closed, setClosed] = useState(false);
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    let active = true;
    void appVersion().then((value) => {
      if (active) {
        setVersion(value.trim());
      }
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }
    let quiet = 0;
    const timer = window.setInterval(() => {
      if (loadingProgress.getSnapshot()) {
        quiet = 0;
        return;
      }
      quiet += 1;
      if (quiet >= CHART_SETTLE_TICKS) {
        setSettled(true);
        window.clearInterval(timer);
      }
    }, CHART_SETTLE_POLL_MS);
    return () => window.clearInterval(timer);
  }, [enabled]);

  // The debug host sets the automation facade; skip the notice so it cannot
  // block automated journeys.
  const automated = (globalThis as { __REDUX_TEST_API__?: unknown }).__REDUX_TEST_API__ === true;
  const open =
    enabled &&
    settled &&
    isPrereleaseVersion(version) &&
    !automated &&
    !closed &&
    dismissedVersion() !== version;

  /** Closes the notice for this session only. */
  const close = () => {
    setClosed(true);
  };

  /** Closes the notice and remembers the current version. */
  const dismiss = () => {
    if (version) {
      rememberVersion(version);
    }
    setClosed(true);
  };

  return (
    <Modal
      open={open}
      onClose={close}
      priority={-10}
      className="redux-test-warning"
      label={t("settings.startup.testWarning.title")}
      description={t("settings.startup.testWarning.description")}
      actions={
        <>
          <Button variant="outlined" onClick={dismiss}>
            {t("settings.startup.testWarning.dontShow")}
          </Button>
          <Button variant="solid" onClick={close}>
            {t("common.action.close")}
          </Button>
        </>
      }
    />
  );
}
