/**
 * The extension-development docs row on the Help page.
 *
 * The target is the loopback documentation site, not an external HTTPS link, so
 * the row uses `openDocsSite` instead of the schema's `open-url` action. Failures
 * arrive as a toast; the row itself stays a single quiet button.
 */
import { IconButton } from "../../../../design/components/button/IconButton.tsx";
import { showToast } from "../../../../design/patterns/ToastHost.tsx";
import { useTranslation } from "../../../../i18n/react.ts";
import { openDocsSite } from "../../../../core/platform/desktop/docsSite.ts";
import { registerSettingControl } from "../settingsContributions.ts";
import type { SettingControlProps } from "../settingsContributions.ts";

/** Open the local docs site and report a rejected URL, blocked popup, or opener failure. */
export function DocsOpenControl({ field }: SettingControlProps) {
  const { t } = useTranslation();
  const label = t("settings.field.docs.label");

  return (
    <div data-docs-open>
      <IconButton
        id={field.key}
        icon="forward"
        label={label}
        tooltip={false}
        onClick={() => {
          void openDocsSite().catch((reason: unknown) => {
            showToast({
              message: t("settings.field.docs.openFailed", {
                message: reason instanceof Error ? reason.message : String(reason),
              }),
              level: "error",
              source: label,
            });
          });
        }}
      />
    </div>
  );
}

registerSettingControl("help-docs", DocsOpenControl);
