/**
 * The compact brand mark in the title bar.
 *
 * The bundled application icon already carries the diamond and the glyph, so the
 * title bar renders that one asset through the shared design primitive.
 */
import { AppIcon } from "../../../design/components/brand/AppIcon.tsx";
import { useTranslation } from "../../../i18n/react.ts";

/**
 * The compact application mark at the leading edge of the title bar.
 *
 * The title bar owns placement and size; the icon primitive owns the shared
 * asset and its square attributes.
 */
export function BrandLogo() {
  const { t } = useTranslation();
  return <AppIcon size={20} alt={t("common.appName")} className="redux-titlebar-logo" />;
}
