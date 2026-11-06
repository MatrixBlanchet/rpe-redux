/**
 * The scripts pane.
 *
 * The full extension list lives in Settings, so this pane only lists the scripts
 * that enabled extensions registered with the host. Each entry has exactly one
 * action: running it. A script that declares parameters asks for them through
 * the parameter dialog; remembered values only prefill that dialog, so pressing
 * the one button is always the whole interaction.
 */
import { useSyncExternalStore } from "react";
import { resolveExtensionText } from "../../../../../core/extensions/i18n.ts";
import {
  scriptRegistry,
  type ExtensionScriptSnapshot,
} from "../../../../../core/extensions/scripts.ts";
import { Button } from "../../../../../design/components/button/Button.tsx";
import { EmptyState } from "../../../../../design/components/empty-state/EmptyState.tsx";
import { useTranslation } from "../../../../../i18n/react.ts";
import { openSettings } from "../../../settings/settingsWindowController.ts";
import { rememberedOrDefaultParameterValues, requestParameterValues } from "./ParameterForm.tsx";

/** Localized extension name, falling back to the owner id. */
function sourceName(script: ExtensionScriptSnapshot): string {
  return (
    resolveExtensionText(script.owner, script.manifest.translations, { key: "name" }) ||
    script.owner
  );
}

/** The registry key is `owner:scriptId`; parameter memory is keyed by the bare id. */
function definitionId(script: ExtensionScriptSnapshot): string {
  const prefix = `${script.owner}:`;
  return script.id.startsWith(prefix) ? script.id.slice(prefix.length) : script.id;
}

/** One script entry and its single run action. */
function ScriptCard({ script }: { script: ExtensionScriptSnapshot }) {
  const { t, tRaw } = useTranslation();
  const run = async () => {
    const schema = script.parameters;
    if (!schema) {
      void scriptRegistry.run(script.id);
      return;
    }
    // The single action always asks for parameters first; remembered values only
    // prefill the dialog, so cancelling it runs nothing at all.
    const scriptId = definitionId(script);
    const valuesToRun = await requestParameterValues({
      owner: script.owner,
      scriptId,
      schema,
      translations: script.manifest.translations,
      initialValues: rememberedOrDefaultParameterValues(script.owner, scriptId, schema),
      title: t("workspace.scripts.parameters.title", { script: tRaw(script.label) }),
      description: t("workspace.scripts.parameters.description"),
    });
    if (valuesToRun) {
      void scriptRegistry.run(script.id, valuesToRun);
    }
  };
  return (
    <article className="redux-script-card">
      <div className="redux-script-card-heading">
        <div>
          <h3>{tRaw(script.label)}</h3>
          <small>{t("workspace.scripts.source", { source: sourceName(script) })}</small>
        </div>
        <Button variant="outlined" onClick={() => void run()}>
          {t("workspace.scripts.run")}
        </Button>
      </div>
      {script.description && <p>{tRaw(script.description)}</p>}
    </article>
  );
}

/** Lists runnable scripts registered by enabled extensions. */
export function ScriptsPanel() {
  const { t } = useTranslation();
  // Every registry entry is a script the host can run, including data-only
  // packages; all entries share the same run path.
  const scripts = useSyncExternalStore(
    scriptRegistry.subscribe,
    scriptRegistry.listRecentFirst,
    scriptRegistry.listRecentFirst,
  );
  return (
    <section className="redux-scripts-panel">
      {scripts.length === 0 ? (
        <div className="redux-scripts-empty">
          <EmptyState
            icon="extension"
            title={t("editorPanels.scripts.emptyTitle")}
            description={t("editorPanels.scripts.empty")}
            actions={
              <Button variant="outlined" onClick={() => openSettings("extensions")}>
                {t("editorPanels.scripts.openSettings")}
              </Button>
            }
          />
        </div>
      ) : (
        <div className="redux-script-list">
          {scripts.map((script) => (
            <ScriptCard key={script.id} script={script} />
          ))}
        </div>
      )}
    </section>
  );
}
