/**
 * The Help page.
 *
 * Its content is a flat list of schema rows — automatic updates, the beta
 * channel, the manual verify action and the survey — so the page only registers
 * the search keywords; the shared field renderer draws the rows and the single
 * "Help" title.
 */
import { registerSettingsPage } from "../settingsContributions.ts";

/** Register the Help page; its rows are contributed by the settings schema. */
export function HelpSettings() {
  return null;
}

registerSettingsPage("help", {
  keywords: "settings.search.helpKeywords",
  component: HelpSettings,
});
