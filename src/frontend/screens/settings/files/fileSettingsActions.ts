/**
 * Register the Files-page actions and return their disposers.
 *
 * The data-folder action is registered like any other toolbar action so a
 * setting action row can invoke it by id.
 */
import { invoke } from "@tauri-apps/api/core";
import { toolbar } from "../../../../core/shell/registries/toolbar.ts";
import { showToast } from "../../../../design/patterns/ToastHost.tsx";
import { t } from "../../../../i18n/index.ts";

/** Register the Files-page actions; returns the toolbar disposers. */
export function registerFileSettingsActions() {
  return [
    toolbar.register({
      kind: "action",
      id: "files.openAppData",
      group: "settings",
      order: 10,
      icon: "open",
      label: "settings.field.open-data-folder.label",
      tooltip: "settings.field.open-data-folder.description",
      toolbar: false,
      run: () => {
        void invoke("open_app_data_folder").catch((reason: unknown) => {
          showToast({
            message: t("settings.action.openDataFolderFailed", {
              message: reason instanceof Error ? reason.message : String(reason),
            }),
            level: "error",
            source: t("settings.field.open-data-folder.label"),
          });
        });
      },
    }),
  ];
}
