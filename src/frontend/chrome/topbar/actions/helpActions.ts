/**
 * Help actions.
 *
 * They open contextual tutorials, feedback questionnaire, development docs,
 * changelog, and about surfaces that explain and configure the application.
 */
import { toolbar } from "../../../../core/shell/registries/toolbar.ts";
import { openSettings } from "../../../screens/settings/settingsWindowController.ts";
import { changelogAvailable, openChangelog } from "../../../screens/settings/updates/changelog.ts";
import { openOnboardingGuide } from "../../../overlays/help/onboardingGuide.ts";
import { openExternalUrl } from "../../../../core/platform/desktop/openExternal.ts";
import { openDocsSite } from "../../../../core/platform/desktop/docsSite.ts";
import { HELP_SURVEY_URL } from "../../../../core/platform/desktop/helpLinks.ts";
import { showToast } from "../../../../design/patterns/ToastHost.tsx";
import { t, type MessageKey } from "../../../../i18n/index.ts";

/** Open a help link and report blocked popups or desktop opener failures. */
function openHelpLink(open: () => Promise<void>, labelKey: MessageKey): void {
  const source = t(labelKey);
  void open().catch((reason: unknown) => {
    showToast({
      message: t("settings.action.openLinkFailed", {
        message: reason instanceof Error ? reason.message : String(reason),
      }),
      level: "error",
      source,
    });
  });
}

/** The help group links to the settings surfaces that explain and configure the app. */
export function registerHelpActions() {
  return [
    toolbar.register({
      kind: "action",
      id: "help.onboarding-guide",
      group: "guides",
      order: 0,
      icon: "help",
      label: "chrome.menu.help.operationList",
      tooltip: "chrome.menu.help.operationListHint",
      run: () => openOnboardingGuide(),
    }),
    toolbar.register({
      kind: "action",
      id: "help.survey",
      group: "feedback",
      order: 10,
      icon: "forward",
      label: "chrome.menu.help.survey",
      tooltip: "chrome.menu.help.surveyHint",
      run: () => openHelpLink(() => openExternalUrl(HELP_SURVEY_URL), "chrome.menu.help.survey"),
    }),
    toolbar.register({
      kind: "action",
      id: "help.developer-docs",
      group: "documentation",
      order: 11,
      icon: "forward",
      label: "chrome.menu.help.developerDocs",
      tooltip: "chrome.menu.help.developerDocsHint",
      run: () => openHelpLink(openDocsSite, "chrome.menu.help.developerDocs"),
    }),
    toolbar.register({
      kind: "action",
      id: "help.changelog",
      group: "updates",
      order: 20,
      icon: "list",
      label: "chrome.menu.help.changelog",
      tooltip: "chrome.menu.help.changelogHint",
      visible: changelogAvailable,
      run: () => openChangelog(),
    }),
    toolbar.register({
      kind: "action",
      id: "help.about",
      group: "preferences",
      order: 30,
      separatorBefore: true,
      icon: "star",
      label: "chrome.menu.help.about",
      tooltip: "chrome.menu.help.aboutHint",
      run: () => openSettings("about"),
    }),
  ];
}
