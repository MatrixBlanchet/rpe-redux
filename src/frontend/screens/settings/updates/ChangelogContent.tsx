/**
 * The changelog modal body.
 *
 * Release notes come from the configured GitHub Releases source. The surface is
 * opened only when that source has returned at least one release; there is no
 * bundled changelog in this build. Status, actions, and release rows are the
 * same shared components the Help page uses.
 */
import { Button } from "../../../../design/components/button/Button.tsx";
import { useTranslation } from "../../../../i18n/react.ts";
import { openSettings } from "../settingsWindowController.ts";
import {
  releaseNotesFromRemote,
  ReleaseNotesList,
  UpdateActionBar,
  UpdateStatusNotice,
  UpdateStatusText,
} from "./UpdatePanels.tsx";
import { useUpdateState } from "./useUpdateState.ts";
import { isPrereleaseVersion } from "../../../../core/utils/version.ts";

/** The changelog modal body with release notes and the shared update actions. */
export function ChangelogContent({ onClose }: { onClose(): void }): React.JSX.Element {
  const { t } = useTranslation();
  const state = useUpdateState();
  const remote = state.releases.length > 0;
  const releases = releaseNotesFromRemote(state.releases);

  return (
    <div className="redux-changelog">
      <header className="redux-changelog-meta">
        <span>
          {t("settings.updates.current", { version: state.currentVersion })}
          {isPrereleaseVersion(state.currentVersion) && (
            <span className="redux-version-channel">{t("settings.version.test")}</span>
          )}
        </span>
        <span className="redux-changelog-source">{t("chrome.changelog.github")}</span>
      </header>

      <div className="redux-changelog-notices">
        <UpdateStatusNotice state={state} showUnconfigured />
      </div>

      <div className="redux-changelog-entries">
        {releases.length > 0 ? (
          <ReleaseNotesList releases={releases} currentVersion={state.currentVersion} />
        ) : (
          <p className="redux-changelog-hint">{t("chrome.changelog.empty")}</p>
        )}
      </div>

      <footer className="redux-changelog-actions">
        {state.repo && (
          <span className="redux-changelog-status">
            <UpdateStatusText state={state} />
          </span>
        )}
        <UpdateActionBar
          state={state}
          requireRepo
          showCheck={!state.portable}
          showReleaseLink={remote}
          leading={
            <Button
              variant="outlined"
              onClick={() => {
                onClose();
                window.setTimeout(() => openSettings("help"), 220);
              }}
            >
              {t("chrome.changelog.settings")}
            </Button>
          }
        />
      </footer>
    </div>
  );
}
