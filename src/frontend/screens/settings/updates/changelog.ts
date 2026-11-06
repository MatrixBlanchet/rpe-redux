/**
 * Imperative entry point for the changelog modal.
 *
 * The modal queue owns stacking and focus; this module only presents the shared
 * changelog body, so Help, the update badge, and the post-update launch path all
 * open the same surface.
 */
import { createElement } from "react";
import { t } from "../../../../i18n/index.ts";
import { dismissModal, presentModal } from "../../../overlays/modals/modalQueue.ts";
import { bindChangelogLauncher } from "./changelogLauncher.ts";
import { ChangelogContent } from "./ChangelogContent.tsx";
import { getUpdateState, refreshUpdateSettings } from "./updateStore.ts";

const CHANGELOG_ID = "help.changelog";

/** Whether any remote release notes are loaded. */
export function changelogAvailable(): boolean {
  return getUpdateState().releases.length > 0;
}

/** Open the read-only release modal when notes exist; returns whether it opened. */
export function openChangelog(): boolean {
  if (!changelogAvailable()) {
    return false;
  }
  refreshUpdateSettings();
  const close = () => dismissModal(CHANGELOG_ID);
  presentModal(CHANGELOG_ID, {
    label: t("chrome.menu.help.changelog"),
    description: t("chrome.changelog.description"),
    className: "redux-changelog-dialog",
    onClose: close,
    children: createElement(ChangelogContent, { onClose: close }),
  });
  return true;
}

bindChangelogLauncher(openChangelog);
