/**
 * Shared fake host and side-effect ledger for the Extension lifecycle tests.
 *
 * The harness models the seams the runtime owns (styles, timers, UI, sandbox)
 * and installs one representative resource of every kind. Snapshots are read
 * back from the real process-wide registries, so a test asserts that the host
 * returned to its pre-enable baseline rather than that a dispose callback ran.
 */
import { connectExtensionUiHost } from "../core/extensions/extensionUi.ts";
import { scriptRegistry } from "../core/extensions/scripts.ts";
import { settingsRegistry } from "../core/settings/settings.ts";
import { PREFERENCE_SECTIONS, readPreference } from "../core/state/preferences.ts";
import { values as valueRegistry } from "../core/state/values.ts";
import { shortcutRegistry } from "../core/shortcuts/registry.ts";
import { getSidebarEntries } from "../core/shell/registries/sidebar.ts";
import { contextMenu as contextMenuRegistry } from "../core/shell/registries/contextMenu.ts";
import { toolbar as toolbarRegistry } from "../core/shell/registries/toolbar.ts";
import { readExtensionOrder } from "../core/extensions/extensionRuntimeSupport.ts";

/** Every capability the ledger fixture exercises. */
export const LEDGER_CAPABILITIES = Object.freeze([
  "scripts",
  "events",
  "settings",
  "storage",
  "styles",
  "timers",
  "values",
  "shortcuts",
  "ui.notice",
  "ui.panel",
  "ui.sidebar",
  "ui.overlay",
  "ui.toolbar",
  "ui.contextMenu",
]);

/** A process-unique suffix for ids that live in process-wide registries. */
export function uniqueSuffix() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/** Build a code-package manifest accepted by the runtime. */
export function manifestFor(id, capabilities = LEDGER_CAPABILITIES, extra = {}) {
  return {
    kind: "extension",
    id,
    name: id,
    version: "1.0.0",
    engines: { "rpe-redux": 1 },
    entry: "index.js",
    capabilities,
    ...extra,
  };
}

/** A timer host with a live-handle table the ledger can read. */
function createFakeTimers() {
  const live = new Map();
  let nextHandle = 0;
  /** Create one tracked handle. */
  const schedule = (kind, delay) => {
    const handle = { id: ++nextHandle, kind, delay };
    live.set(handle, kind);
    return handle;
  };
  /** Release one tracked handle. */
  const clear = (handle) => {
    if (handle && typeof handle === "object") {
      live.delete(handle);
    }
  };
  return {
    live,
    host: Object.freeze({
      setTimeout: (_callback, delay) => schedule("timeout", delay),
      setInterval: (_callback, delay) => schedule("interval", delay),
      requestAnimationFrame: (_callback) => schedule("frame", 0),
      clearTimeout: clear,
      clearInterval: clear,
      cancelAnimationFrame: clear,
    }),
  };
}

/** A style sink with an owner-tagged live-sheet table. */
function createFakeStyleHost() {
  const live = new Map();
  let nextSheet = 0;
  return {
    host: Object.freeze({
      add(cssText, owner) {
        const sheet = ++nextSheet;
        live.set(sheet, { owner, cssText });
        return () => live.delete(sheet);
      },
    }),
    count(owners) {
      let count = 0;
      for (const { owner } of live.values()) {
        if (owners.has(owner)) {
          count += 1;
        }
      }
      return count;
    },
  };
}

/** A UI host that unmounts on the activation signal, like the frontend host. */
function createFakeUiHost() {
  const live = new Map();
  let nextSurface = 0;
  /** Register one surface and tie its cleanup to the activation signal. */
  const register = (kind) => (request, definition) => {
    const key = `${kind}:${++nextSurface}`;
    live.set(key, { kind, owner: request.source.id, id: definition.id });
    let active = true;
    const dispose = () => {
      if (!active) {
        return;
      }
      active = false;
      live.delete(key);
    };
    request.signal.addEventListener("abort", dispose, { once: true });
    return dispose;
  };
  return {
    host: Object.freeze({
      capabilities: Object.freeze(["panel", "sidebar", "overlay"]),
      registerPanel: register("panel"),
      registerSidebar: register("sidebar"),
      registerOverlay: register("overlay"),
    }),
    entries(owners) {
      return [...live.values()]
        .filter((entry) => owners.has(entry.owner))
        .map((entry) => `${entry.kind}:${entry.id}`)
        .sort();
    },
    count() {
      return live.size;
    },
    clear() {
      live.clear();
    },
  };
}

/**
 * Create the host seams and install the UI binding.
 *
 * `dispose()` releases in-flight sandboxes, clears fake surfaces, and unbinds
 * the UI host so one test cannot feed registrations to the next.
 */
export function createLedgerState() {
  const timers = createFakeTimers();
  const styles = createFakeStyleHost();
  const ui = createFakeUiHost();
  const disconnectUi = connectExtensionUiHost(ui.host);
  const sandboxes = new Set();
  return {
    timers,
    styles,
    ui,
    sandboxes,
    dispose() {
      for (const sandbox of [...sandboxes]) {
        sandbox.dispose();
      }
      sandboxes.clear();
      ui.clear();
      disconnectUi();
    },
  };
}

/** Add one token to the fake iframe callback table. */
function addCallback(sandbox) {
  const token = Symbol("callback");
  sandbox.callbacks.add(token);
  return () => sandbox.callbacks.delete(token);
}

/**
 * Register the representative side effects through one activation context.
 *
 * Events, scripts, styles, and timers travel through the runtime scope; toolbar,
 * sidebar, context-menu, settings rows, explicit shortcuts, and UI surfaces
 * travel through the sandbox disposer table or the activation abort signal.
 * Values are owned by the runtime's owner sweep.
 */
export function installLedgerResources(context, sandbox) {
  const owner = context.manifest.id;
  const api = context.api;
  sandbox.track(
    api.toolbar.register({
      kind: "action",
      id: "command",
      order: 900,
      group: "test",
      label: "Ledger command",
      tooltip: "Ledger command",
      icon: "info",
      run: () => undefined,
    }),
  );
  sandbox.track(
    api.sidebar.register({
      id: "entry",
      order: 900,
      icon: { name: "info", label: "Ledger entry" },
      onActivate: () => undefined,
    }),
  );
  sandbox.track(
    api.contextMenu.register({
      id: "menu",
      order: 900,
      contexts: ["notes"],
      label: "Ledger menu",
      run: () => undefined,
    }),
  );
  sandbox.track(
    api.settings.registerNavigation({
      key: "nav",
      label: "Ledger navigation",
      order: 900,
    }),
  );
  sandbox.track(
    api.settings.registerSetting({
      key: "flag",
      navigation: "nav",
      group: "Ledger",
      label: "Ledger flag",
      control: "toggle",
      default: false,
    }),
  );
  const category = api.shortcuts.registerCategory({
    id: "probe",
    title: "Ledger probe",
    order: 900,
  });
  sandbox.track(category.dispose);
  sandbox.track(
    api.shortcuts.registerShortcut({
      id: "probe",
      category: "probe",
      title: "Ledger probe",
      scope: "editor",
      defaults: [{ key: "F6" }],
    }),
  );
  const counter = api.values.define({ id: "counter", initial: 0, persist: true });
  counter.set(3);
  api.values.byId.set("flag", true);
  // Event fixtures must use the host allowlist; arbitrary names are refused.
  context.events.on("document:opened", () => undefined);
  addCallback(sandbox);
  context.scripts.register({
    id: "script",
    label: "Ledger script",
    defaultShortcuts: [{ key: "F7" }],
    run: () => undefined,
  });
  // Override both shortcut defaults so the shortcut section has persisted keys
  // in addition to the in-memory binding views.
  api.values.byId.set(`shortcut:extension.${owner}.probe`, ["F10"]);
  api.values.byId.set(`shortcut:extension.${owner}.script.script`, ["F11"]);
  context.styles.add(".extension-ledger-fixture { color: red; }");
  context.timers.setInterval(() => undefined, 1000);
  sandbox.track(context.ui.registerPanel({ id: "panel", component: () => null }));
  sandbox.track(
    context.ui.registerOverlay({
      id: "overlay",
      mount: () => () => undefined,
    }),
  );
  sandbox.track(
    context.ui.registerSidebar({
      id: "sidebar",
      panelId: "panel",
      icon: { name: "info", label: "Ledger sidebar" },
    }),
  );
}

/**
 * Create one fake sandbox with a disposer table and callback table.
 *
 * `register` defaults to the full ledger fixture; `afterRegister` receives the
 * context after registrations land, which lets a test hold the activation open
 * while it inspects or cancels the in-flight scope.
 */
export function createFakeSandbox(input, options = {}) {
  const sandbox = {
    started: false,
    disposed: false,
    callbacks: new Set(),
    disposers: [],
    /** Track one host disposer for the sandbox's own teardown pass. */
    track(disposer) {
      if (typeof disposer !== "function") {
        throw new TypeError("the fake sandbox can only track disposer functions");
      }
      sandbox.disposers.push(disposer);
    },
    async start() {
      sandbox.started = true;
      (options.register ?? installLedgerResources)(input.context, sandbox);
      await options.afterRegister?.(input.context, sandbox);
    },
    dispose() {
      if (sandbox.disposed) {
        return;
      }
      sandbox.disposed = true;
      const errors = [];
      for (const disposer of sandbox.disposers) {
        try {
          disposer();
        } catch (error) {
          errors.push(error);
        }
      }
      sandbox.disposers.length = 0;
      sandbox.callbacks.clear();
      options.onDispose?.(sandbox);
      if (errors.length) {
        throw new AggregateError(errors, "fake sandbox cleanup failed");
      }
    },
  };
  return sandbox;
}

/** Create a factory that removes a sandbox from the live table on dispose. */
export function createSandboxFactory(state, options = {}) {
  return (input) => {
    const sandbox = createFakeSandbox(input, {
      register: options.register,
      afterRegister: options.afterRegister,
      onDispose(value) {
        state.sandboxes.delete(value);
        options.onDispose?.(value);
      },
    });
    state.sandboxes.add(sandbox);
    return sandbox;
  };
}

/**
 * Snapshot every registry resource owned by one or more Extension ids.
 *
 * The snapshot sorts ids so registration order never enters the comparison;
 * values are the non-default cells owned by the package, and `callbacks` is the
 * fake iframe table that a real sandbox clears on dispose.
 */
export function ledgerSnapshot(owners, state) {
  const ownerSet = new Set(Array.isArray(owners) ? owners : [owners]);
  /** Whether an id belongs to one of the owners. */
  const owns = (id) =>
    [...ownerSet].some(
      (owner) =>
        id === owner ||
        id.startsWith(`${owner}.`) ||
        id.startsWith(`extension.${owner}`) ||
        id.startsWith(`extension:${owner}`),
    );
  const shortcuts = shortcutRegistry
    .shortcuts()
    .filter((shortcut) => owns(shortcut.id))
    .map((shortcut) => ({
      id: shortcut.id,
      bindings: shortcut.bindings.map((binding) =>
        [binding.key, ...(binding.modifiers ?? [])].join("+"),
      ),
    }))
    .sort((left, right) => left.id.localeCompare(right.id));
  return {
    toolbar: toolbarRegistry
      .getSnapshot()
      .filter((entry) => owns(entry.id))
      .map((entry) => entry.id)
      .sort(),
    sidebar: getSidebarEntries()
      .filter((entry) => owns(entry.id))
      .map((entry) => entry.id)
      .sort(),
    contextMenu: contextMenuRegistry
      .getSnapshot()
      .filter((entry) => owns(entry.id))
      .map((entry) => entry.id)
      .sort(),
    settingsDefinitions: settingsRegistry
      .definitions()
      .filter((definition) => owns(definition.key))
      .map((definition) => definition.key)
      .sort(),
    settingsNavigations: settingsRegistry
      .navigations()
      .filter((navigation) => owns(navigation.key))
      .map((navigation) => navigation.key)
      .sort(),
    shortcutCategories: shortcutRegistry
      .categories()
      .filter((category) => owns(category.id))
      .map((category) => category.id)
      .sort(),
    shortcuts,
    scripts: scriptRegistry
      .list()
      .filter((script) => ownerSet.has(script.owner))
      .map((script) => script.id)
      .sort(),
    values: Object.keys(valueRegistry.snapshot())
      .filter((id) => ownerSet.has(valueRegistry.ownerOf(id)))
      .sort(),
    styles: state.styles.count(ownerSet),
    timers: state.timers.live.size,
    ui: state.ui.entries(ownerSet),
    sandboxes: state.sandboxes.size,
    callbacks: [...state.sandboxes].reduce((total, sandbox) => total + sandbox.callbacks.size, 0),
  };
}

/** Snapshot the persisted keys that belong to one or more Extension ids. */
export function persistedSnapshot(owners, store) {
  const ownerSet = new Set(Array.isArray(owners) ? owners : [owners]);
  /** Whether a stored key or its payload names one of the owners. */
  const owns = (key) =>
    [...ownerSet].some(
      (owner) =>
        key === owner ||
        key.startsWith(`${owner}.`) ||
        key.startsWith(`extension.${owner}`) ||
        key.startsWith(`shortcut:extension.${owner}`) ||
        key.startsWith(`extension:${owner}`),
    );
  /** Filter and sort the keys of one preference section. */
  const keys = (section) => Object.keys(section).filter(owns).sort();
  const globalSettings = readPreference(PREFERENCE_SECTIONS.settings, {});
  const globalValues = readPreference(PREFERENCE_SECTIONS.values, {});
  const globalShortcuts = readPreference(PREFERENCE_SECTIONS.shortcuts, {});
  const runtimeSettings = store.read(PREFERENCE_SECTIONS.settings, {});
  return {
    settings: keys(globalSettings),
    values: keys(globalValues),
    shortcuts: keys(globalShortcuts),
    runtimeState: keys(runtimeSettings),
    order: readExtensionOrder(store)
      .filter((id) => ownerSet.has(id))
      .sort(),
  };
}

/** Replace every Extension owner id in a snapshot with a stable logical token. */
export function canonicalize(value, ownerMap) {
  if (typeof value === "string") {
    let result = value;
    for (const [owner, token] of ownerMap) {
      result = result.split(owner).join(`<${token}>`);
    }
    return result;
  }
  if (Array.isArray(value)) {
    return value.map((entry) => canonicalize(entry, ownerMap));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [
        canonicalize(key, ownerMap),
        canonicalize(entry, ownerMap),
      ]),
    );
  }
  return value;
}
