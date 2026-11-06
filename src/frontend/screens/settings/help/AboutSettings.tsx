/**
 * The About page of the settings window.
 *
 * The product mark, the publisher mark, the version and provenance lines share
 * one centred page that fills at least one viewport. The developer section
 * appears only after the logo gesture.
 */
import { useRef } from "react";
import { AppLockup } from "../../../../design/components/brand/AppLockup.tsx";
import { Button } from "../../../../design/components/button/Button.tsx";
import { SolstMark } from "../../../../design/components/brand/SolstMark.tsx";
import { getThemeAppearance } from "../../../../core/theme/themes.ts";
import { useTranslation } from "../../../../i18n/react.ts";
import { registerSettingsPage, type SettingsPageContext } from "../settingsContributions.ts";
import { toggleDeveloperReveal } from "../../../../core/state/developerReveal.ts";
import { useUpdateState } from "../updates/useUpdateState.ts";
import { isPrereleaseVersion } from "../../../../core/utils/version.ts";

/** Clicks needed on the logo to reveal or hide the developer tools. */
const REVEAL_CLICKS = 10;

/**
 * The product information page.
 *
 * It shows the version, provenance, and licence lines; the developer actions
 * stay behind a deliberate logo gesture and are remembered across restarts.
 */
export function AboutSettings({ theme, openCategory }: SettingsPageContext) {
  const { t } = useTranslation();
  const { currentVersion } = useUpdateState();
  const clicks = useRef(0);
  // Both marks use the ink with the higher contrast against the themed surface.
  const surface = getThemeAppearance(theme);

  /** Count logo clicks and reveal the developer category on the final one. */
  const clickLogo = () => {
    clicks.current += 1;
    if (clicks.current < REVEAL_CLICKS) {
      return;
    }
    clicks.current = 0;
    if (toggleDeveloperReveal()) {
      // A newly revealed developer category opens immediately.
      openCategory("developer");
    }
  };

  return (
    <div className="redux-help">
      <div className="redux-help-content">
        <section className="redux-help-hero">
          <Button type="button" variant="plain" className="redux-help-logo" onClick={clickLogo}>
            <AppLockup surface={surface} size={208} alt={t("common.appName")} />
          </Button>
          <p className="redux-help-version">
            {t("settings.help.version", { version: currentVersion })}
            {isPrereleaseVersion(currentVersion) && (
              <span className="redux-version-channel">{t("settings.version.test")}</span>
            )}
          </p>
          <p className="redux-help-line">{t("settings.help.upstreamBy")}</p>
          <SolstMark
            surface={surface}
            size={158}
            alt={t("settings.help.solstLabel")}
            className="redux-help-publisher"
          />
          <p className="redux-help-line">{t("settings.help.poweredBy")}</p>
          <p className="redux-help-line">{t("settings.help.rightsLine")}</p>
          <p className="redux-help-license">{t("settings.help.licenseLine")}</p>
        </section>
      </div>
    </div>
  );
}

registerSettingsPage("about", {
  keywords: "settings.search.aboutKeywords",
  hideTitle: true,
  component: AboutSettings,
});
