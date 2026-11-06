/**
 * The host context a cell-mode sandbox receives.
 *
 * Cells share the Extension iframe and bridge, but not the Extension lifecycle.
 * This adapter supplies the gated API plus inert handles for every surface a
 * cell is not allowed to use. The iframe never exposes these handles to cell
 * code; they exist so the shared sandbox factory can keep one host contract.
 */
import type { ReduxApi } from "../api/index.ts";
import type {
  ExtensionHostContext,
  ExtensionJsonStore,
  MaterializedExtensionManifest,
} from "../extensions/extensionContract.ts";
import { createExtensionI18n } from "../extensions/i18n.ts";
import { ExtensionScope } from "../extensions/extensionRuntimeSupport.ts";

/** One stable error for a surface that a code cell must not reach. */
function unavailable(action: string): never {
  throw new Error(`Code cells do not expose ${action}`);
}

/** A store that refuses every operation; cells have no persistent state. */
function deniedStore(kind: string): ExtensionHostContext["settings"] {
  return {
    get: () => unavailable(`${kind}.get`),
    set: () => unavailable(`${kind}.set`),
    delete: () => unavailable(`${kind}.delete`),
    clear: () => unavailable(`${kind}.clear`),
  };
}

/** A JSON-capable store that refuses every operation. */
function deniedJsonStore(kind: string): ExtensionJsonStore {
  return {
    ...deniedStore(kind),
    getJSON: () => unavailable(`${kind}.getJSON`),
    setJSON: () => unavailable(`${kind}.setJSON`),
  };
}

/**
 * Build the host half of one cell's bridge.
 *
 * `api` must already be gated for the cell profile; each interactive surface
 * returns the same stable "not exposed" error.
 */
export function createCodeCellHostContext(
  manifest: MaterializedExtensionManifest,
  api: ReduxApi,
  scope: ExtensionScope,
): ExtensionHostContext {
  const ui: ExtensionHostContext["ui"] = {
    capabilities: Object.freeze([]),
    notice: () => unavailable("ui.notice"),
    confirm: () => unavailable("ui.confirm"),
    input: () => unavailable("ui.input"),
    select: () => unavailable("ui.select"),
    guide: () => unavailable("ui.guide"),
    progress: () => unavailable("ui.progress"),
    designCatalog: () => unavailable("ui.designCatalog"),
    registerDesignPanel: () => unavailable("ui.registerDesignPanel"),
    registerPanel: () => unavailable("ui.registerPanel"),
    registerSidebar: () => unavailable("ui.registerSidebar"),
    registerOverlay: () => unavailable("ui.registerOverlay"),
  };
  return Object.freeze({
    manifest,
    signal: scope.controller.signal,
    api,
    i18n: createExtensionI18n(manifest.id, undefined),
    ui,
    events: { on: () => unavailable("events.on") },
    hooks: {
      register: () => unavailable("hooks.register"),
      invoke: () => unavailable("hooks.invoke"),
    },
    scripts: { register: () => unavailable("scripts.register") },
    settings: deniedStore("settings"),
    storage: deniedJsonStore("storage"),
    timers: {
      setTimeout: () => unavailable("timers.setTimeout"),
      setInterval: () => unavailable("timers.setInterval"),
      requestAnimationFrame: () => unavailable("timers.requestAnimationFrame"),
      clearTimeout: () => unavailable("timers.clearTimeout"),
      clearInterval: () => unavailable("timers.clearInterval"),
      cancelAnimationFrame: () => unavailable("timers.cancelAnimationFrame"),
    },
    styles: { add: () => unavailable("styles.add") },
    services: {
      provide: () => unavailable("services.provide"),
      resolve: () => unavailable("services.resolve"),
      call: () => unavailable("services.call"),
      onChange: () => unavailable("services.onChange"),
      provideData: () => unavailable("services.provideData"),
      readData: () => unavailable("services.readData"),
      updateData: () => unavailable("services.updateData"),
      onDataChange: () => unavailable("services.onDataChange"),
    },
    addCleanup: (cleanup: () => void) => scope.add(cleanup),
  });
}
