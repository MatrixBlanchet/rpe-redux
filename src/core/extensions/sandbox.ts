/**
 * The sandbox-facing Extension contract.
 *
 * A sandboxed package receives asynchronous mirrors of the host handles and a
 * declarative UI tree; it never receives the host DOM. Code runs in an
 * opaque-origin iframe, and these types are the only values that cross the
 * message bridge.
 */
import type { ReduxApi } from "../api/index.ts";
import type { SettingsApi } from "../api/settings.ts";
import type { ExtensionThemeTokens } from "../api/theme.ts";
import type { Shortcut, ShortcutScope } from "../shortcuts/types.ts";
import type { ExtensionCapability } from "./capabilities.ts";
import type {
  PublicHookInvokeOptions,
  PublicHookInvocationResult,
  PublicHookPayloadSchema,
} from "./publicHooks.ts";
import type {
  ExtensionDataInfo,
  ExtensionDataProviderDefinition,
  ExtensionServiceDefinition,
  ExtensionServiceInfo,
} from "./serviceRegistry.ts";
import type { ExtensionParameterSchema } from "./parameters.ts";
import type { ExtensionScriptStep } from "./steps.ts";
import type { ExtensionI18n, ExtensionText, ExtensionTranslations } from "./i18n.ts";
import type {
  ExtensionHostContext,
  MaterializedExtensionManifest,
  TrustedExtensionManifest,
} from "./extensionContract.ts";
import type {
  ExtensionDesignCatalog,
  ExtensionDesignEvent,
  ExtensionDesignPanelDefinition,
} from "./designComponents.ts";

/** Every call crosses the bridge, so results arrive as promises. */
export type AsyncApi<T> = T extends (...args: infer A) => infer R
  ? (...args: A) => Promise<Awaited<R>>
  : T extends readonly unknown[]
    ? T
    : T extends object
      ? { readonly [K in keyof T]: AsyncApi<T[K]> }
      : T;

/** Host-only handles that never cross the package bridge. */
type HostOnlyHandle = "settings" | "workspace" | "extensions";

/** The sandbox sees the host handles minus host-only and unsupported operations. */
type SandboxHostApi = Omit<ReduxApi, HostOnlyHandle | "theme"> & {
  readonly settings: SettingsApi;
  /**
   * Token reads become promises like every other bridged call. The subscription
   * returns no disposer: its lifetime is the activation.
   */
  readonly theme: {
    tokens(): ExtensionThemeTokens;
    subscribe(listener: () => void): void;
  };
};

/** The asynchronous `redux` facade available inside the sandbox. */
export type SandboxReduxApi = AsyncApi<SandboxHostApi>;

/** The cell facade adds the exact grant list to the normal async facade. */
export type SandboxCodeCellApi = AsyncApi<
  SandboxHostApi & { capabilities(): readonly ExtensionCapability[] }
>;

/** A CSS declaration set. Custom properties are allowed. */
export type SandboxStyle = Readonly<Record<string, string | number>>;

/** One host-rendered element in a declarative Extension surface. */
export interface SandboxElementNode {
  readonly kind: "element";
  readonly tag: string;
  /** Stable id used to route an input/click event back to the package. */
  readonly id?: string;
  readonly class?: string;
  readonly style?: SandboxStyle;
  readonly attrs?: Readonly<Record<string, string | number | boolean>>;
  readonly text?: string;
  readonly children?: readonly SandboxUiNode[];
}

/** Plain text inside a declarative surface. */
export interface SandboxTextNode {
  readonly kind: "text";
  readonly text: string;
}

/** One node in a declarative surface tree. */
export type SandboxUiNode = SandboxElementNode | SandboxTextNode;

/** What the host renderer sends back for one interactive node. */
export interface SandboxUiEvent {
  readonly nodeId: string;
  readonly kind: "click" | "input" | "change" | "file";
  readonly value?: string;
  readonly checked?: boolean;
  readonly file?: SandboxPickedImage;
}

/** An image selected through the host picker and returned as a data URL. */
export interface SandboxPickedImage {
  readonly name: string;
  readonly type: string;
  readonly dataUrl: string;
}

/** Control handle for one rendered panel or overlay tree. */
export interface SandboxSurfaceHandle {
  /** Replace the rendered tree; `replace` remounts inputs to reset their values. */
  update(tree: SandboxUiNode, options?: { replace?: boolean }): void;
  dispose(): void;
}

/** One panel tree and the event callback routed back to the package. */
export interface SandboxPanelDefinition {
  readonly id: string;
  readonly tree: SandboxUiNode;
  onEvent?(event: SandboxUiEvent): void;
}

/** A panel tree hosted above the editor stage or the window. */
export interface SandboxOverlayDefinition extends SandboxPanelDefinition {
  readonly order?: number;
  readonly scope?: "stage" | "window";
}

/** A sidebar icon route or a standalone divider. */
export type SandboxSidebarDefinition =
  | {
      readonly id: string;
      readonly panelId: string;
      readonly icon: { readonly name: string; readonly label: string; readonly domId?: string };
      readonly order?: number;
    }
  | { readonly kind: "divider"; readonly id: string; readonly order?: number };

/** Promise-based mirror of the host key/value store. */
export interface SandboxStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
}

/** Storage adds JSON helpers over the same owner-scoped string entries. */
export interface SandboxJsonStore extends SandboxStore {
  /** Parse one stored value; missing or unparseable text resolves to null. */
  getJSON<T = unknown>(key: string): Promise<T | null>;
  /** Serialize plain JSON data under the 256 KB value bound. */
  setJSON(key: string, value: unknown): Promise<void>;
}

/** Cross-Extension service operations exposed through the asynchronous bridge. */
export interface SandboxServices {
  provide(
    definition: Omit<ExtensionServiceDefinition, "methods"> & {
      methods: Readonly<Record<string, (...args: readonly unknown[]) => unknown>>;
    },
  ): () => void;
  resolve(id: string, version?: string): Promise<ExtensionServiceInfo | null>;
  call(id: string, method: string, args?: readonly unknown[]): Promise<unknown>;
  onChange(id: string, listener: (info: ExtensionServiceInfo | null) => void): () => void;
  provideData<T>(definition: ExtensionDataProviderDefinition<T>): () => void;
  readData<T = unknown>(id: string, version?: string): Promise<ExtensionDataInfo<T> | null>;
  updateData(id: string, value: unknown): Promise<void>;
  onDataChange<T = unknown>(
    id: string,
    listener: (info: ExtensionDataInfo<T> | null) => void,
  ): () => void;
}

/** Host UI calls available across the sandbox bridge. */
export interface SandboxUiContext {
  notice(message: ExtensionText, options?: Readonly<Record<string, unknown>>): void;
  confirm(message: ExtensionText): Promise<boolean>;
  input(options: Readonly<Record<string, unknown>>): Promise<string | null>;
  select(options: Readonly<Record<string, unknown>>): Promise<string | null>;
  guide(options: Readonly<Record<string, unknown>>): Promise<unknown>;
  progress(
    title: ExtensionText,
    totalSteps?: number,
  ): {
    update(message: string, options?: Readonly<Record<string, unknown>>): void;
    close(): void;
  };
  /** Host-mediated image picker; the package never receives a file handle. */
  pickImage(options?: { maxBytes?: number }): Promise<SandboxPickedImage | null>;
  registerPanel(definition: SandboxPanelDefinition): SandboxSurfaceHandle;
  /** Read the versioned host design-component and slot catalog. */
  designCatalog(): Promise<ExtensionDesignCatalog>;
  /** Register a declarative design component in a host-owned panel slot. */
  registerDesignPanel(
    definition: Omit<ExtensionDesignPanelDefinition, "onEvent"> & {
      onEvent?(event: ExtensionDesignEvent): void;
    },
  ): () => void;
  registerOverlay(definition: SandboxOverlayDefinition): SandboxSurfaceHandle;
  registerSidebar(definition: SandboxSidebarDefinition): () => void;
}

/** The context a sandboxed script receives. */
export interface SandboxScriptContext {
  readonly manifest: MaterializedExtensionManifest;
  readonly signal: AbortSignal;
  readonly api: SandboxReduxApi;
  readonly i18n: ExtensionI18n;
  readonly params: Readonly<Record<string, unknown>>;
  readonly ui: SandboxUiContext;
}

/** A script contribution declared inside the sandbox. */
export interface SandboxScriptDefinition {
  readonly id: string;
  readonly label: ExtensionText;
  readonly description?: ExtensionText;
  readonly icon?: string;
  readonly defaultShortcuts?: readonly Shortcut[];
  /** Where the script shortcut runs; defaults to the editor workspace. */
  readonly shortcutScope?: ShortcutScope;
  readonly parameters?: ExtensionParameterSchema;
  readonly steps?: readonly ExtensionScriptStep[];
  run?(context: SandboxScriptContext): void | Promise<void>;
}

/** The context a sandboxed entry receives. It has no host DOM, IPC, or network. */
export interface SandboxExtensionContext {
  readonly manifest: MaterializedExtensionManifest;
  readonly signal: AbortSignal;
  readonly api: SandboxReduxApi;
  readonly i18n: ExtensionI18n;
  readonly ui: SandboxUiContext;
  readonly events: {
    on(name: string, callback: (payload: unknown) => void, priority?: number): () => void;
  };
  readonly hooks: {
    register(
      name: string,
      callback: (payload: Record<string, unknown>) => unknown | Promise<unknown>,
      schema: PublicHookPayloadSchema,
      priority?: number,
    ): () => void;
    invoke(
      name: string,
      payload: Record<string, unknown>,
      options?: PublicHookInvokeOptions,
    ): Promise<PublicHookInvocationResult>;
  };
  readonly services: SandboxServices;
  readonly scripts: {
    register(definition: SandboxScriptDefinition): () => void;
  };
  readonly settings: SandboxStore;
  readonly storage: SandboxJsonStore;
  readonly timers: {
    setTimeout(callback: () => void, delay: number): ReturnType<typeof globalThis.setTimeout>;
    setInterval(callback: () => void, delay: number): ReturnType<typeof globalThis.setInterval>;
    requestAnimationFrame(callback: FrameRequestCallback): number;
    clearTimeout(handle: ReturnType<typeof globalThis.setTimeout>): void;
    clearInterval(handle: ReturnType<typeof globalThis.setInterval>): void;
    cancelAnimationFrame(handle: number): void;
  };
  readonly styles: { add(cssText: string): () => void };
  addCleanup(cleanup: () => void): () => void;
}

/** The default export shape a sandboxed entry module provides. */
export interface SandboxedExtensionDefinition {
  manifest: TrustedExtensionManifest;
  translations?: ExtensionTranslations;
  activate?(context: SandboxExtensionContext): void | Promise<void>;
}

/** One captured console entry from a cell. */
export interface SandboxCellLog {
  readonly level: "log" | "info" | "warn" | "error";
  readonly text: string;
  readonly atMs: number;
}

/** One cell failure as reported by the iframe. */
export interface SandboxCellError {
  readonly name?: string;
  readonly message: string;
  readonly stack?: string;
}

/** The iframe-level outcome of one cell run. */
export interface SandboxCellResult {
  readonly ok: boolean;
  readonly value?: unknown;
  readonly logs: readonly SandboxCellLog[];
  readonly error?: SandboxCellError;
  readonly durationMs: number;
  readonly truncated: boolean;
}

/** A running sandbox; the host runtime owns this lifetime. */
export interface ExtensionSandboxHost {
  start(): Promise<void>;
  dispose(): void;
  /** Cell mode only: resolves when the cell finishes; absent for extensions. */
  runCell?(): Promise<SandboxCellResult>;
}

/** Whether this sandbox runs a package entry or one one-shot cell. */
export type ExtensionSandboxMode = "extension" | "cell";

/** Everything the iframe factory needs to build one sandbox. */
export interface ExtensionSandboxFactoryInput {
  /** Defaults to `extension`; cell mode uses the same iframe and bridge. */
  mode?: ExtensionSandboxMode;
  manifest: MaterializedExtensionManifest;
  translations: ExtensionTranslations | undefined;
  source: string;
  /** Capability-gated host handles used only by the bridge, never by the package. */
  context: ExtensionHostContext;
  reportFailure(error: unknown, action: string): void;
  /** Cell mode only: the value exposed to the cell as `input`. */
  input?: unknown;
  /** Cell mode only: execution budget in milliseconds. */
  timeoutMs?: number;
}

/** Frontend-owned factory that creates the iframe and bridge for one run. */
export type ExtensionSandboxFactory = (input: ExtensionSandboxFactoryInput) => ExtensionSandboxHost;
