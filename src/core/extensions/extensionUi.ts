/**
 * Host boundary for Extension-owned UI surfaces.
 *
 * Core deliberately knows only the shape of a panel or overlay mount. The
 * frontend adapts those values to React and keeps the inspector frame, stage
 * layer, and sidebar markup host-owned. This is a capability boundary and
 * lifecycle seam. Package code runs in the iframe sandbox; this layer only
 * adapts the bridge registrations to the host UI.
 */
import { createLateBound } from "../utils/lateBound.ts";
import type { ExtensionDisposer } from "./registry.ts";
import type { ExtensionDesignCatalog, ExtensionDesignPanelDefinition } from "./designComponents.ts";

/** Host-side renderer for one panel tree; the frontend owns mounting the result. */
export type ExtensionPanelComponent = () => unknown;

export interface ExtensionPanelDefinition {
  /** Local id; the host namespaces it under the Extension id. */
  readonly id: string;
  /** Host-side renderer for a sandbox panel tree. */
  readonly component?: ExtensionPanelComponent;
  /**
   * Imperative alternative to `component`: the host creates a panel-sized
   * element and the Extension fills it. Return a cleanup for unmount.
   */
  readonly mount?: ExtensionElementMount;
}

/** Host-owned element handed to an imperative Extension panel or overlay; returns cleanup. */
export type ExtensionElementMount = (
  element: HTMLElement,
  signal: AbortSignal,
) => ExtensionDisposer;

/** One Extension-owned non-interactive layer over the editor stage. */
export interface ExtensionOverlayDefinition {
  /** Local id; the host namespaces it under the Extension id. */
  readonly id: string;
  /** Optional paint order; lower values render first. */
  readonly order?: number;
  /**
   * Where the host mounts the overlay. `stage` follows the editor stage (the
   * default); `window` fills the application window and can place content over
   * the toolbar and inspector as well.
   */
  readonly scope?: "stage" | "window";
  /**
   * Mount into the host-owned stage-sized element and return a cleanup.
   *
   * Overlays sit above the authoring canvases but below shell notices. The
   * host layer ignores pointer input; set `pointer-events: auto` on a child
   * only when the overlay needs direct interaction.
   */
  readonly mount: ExtensionElementMount;
}

export interface ExtensionIconDescriptor {
  /** A design-system icon name. Unknown names render the host fallback glyph. */
  readonly name: string;
  /** A literal or Extension-resolved accessible label. */
  readonly label: string;
  readonly domId?: string;
}

export interface ExtensionSidebarItem {
  /** Local id for this icon route. */
  readonly id: string;
  /** The local panel id opened when the icon is activated. */
  readonly panelId: string;
  readonly icon: ExtensionIconDescriptor;
  readonly order?: number;
}

/** A sidebar divider is registered independently of icon routes. */
export interface ExtensionSidebarDivider {
  readonly kind: "divider";
  readonly id: string;
  readonly order?: number;
}

export type ExtensionSidebarDefinition = ExtensionSidebarItem | ExtensionSidebarDivider;

/** Origin and lifetime of one UI registration request. */
export interface ExtensionUiRequest {
  readonly source: { readonly id: string; readonly name: string };
  readonly signal: AbortSignal;
}

/** UI surfaces the host can mount for a package. */
export type ExtensionUiCapability = "panel" | "sidebar" | "overlay";

/** Host adapter that mounts Extension panels, sidebar routes, and overlays. */
export interface ExtensionUiHost {
  readonly capabilities: readonly ExtensionUiCapability[];
  registerPanel(
    request: ExtensionUiRequest,
    definition: ExtensionPanelDefinition,
  ): ExtensionDisposer;
  /** Return the immutable design-component catalog for the current host. */
  designCatalog(): Promise<ExtensionDesignCatalog>;
  /** Register a validated design-component panel in a host-owned slot. */
  registerDesignPanel(
    request: ExtensionUiRequest,
    definition: ExtensionDesignPanelDefinition,
  ): ExtensionDisposer;
  registerSidebar(
    request: ExtensionUiRequest,
    definition: ExtensionSidebarDefinition,
  ): ExtensionDisposer;
  registerOverlay(
    request: ExtensionUiRequest,
    definition: ExtensionOverlayDefinition,
  ): ExtensionDisposer;
}

/** Raised when the host UI seam is missing or does not support a surface. */
export class ExtensionUiError extends Error {
  readonly code: "unavailable" | "unsupported";
  readonly capability: ExtensionUiCapability;

  /** Record the failure kind and the surface that was requested. */
  constructor(
    code: "unavailable" | "unsupported",
    capability: ExtensionUiCapability,
    message: string,
  ) {
    super(message);
    this.name = "ExtensionUiError";
    this.code = code;
    this.capability = capability;
  }
}

const hostBinding = createLateBound<ExtensionUiHost>();

/** Attach the frontend-owned UI host and return a disposer for that binding. */
export function connectExtensionUiHost(host: ExtensionUiHost): () => void {
  return hostBinding.bind(host);
}

/** The connected UI host, or null before the frontend mounts it. */
export function getExtensionUiHost(): ExtensionUiHost | null {
  return hostBinding.value();
}

/** Resolve a host that supports `capability`, or throw a structured UI error. */
export function requireExtensionUiHost(capability: ExtensionUiCapability): ExtensionUiHost {
  const host = hostBinding.value();
  if (!host) {
    throw new ExtensionUiError(
      "unavailable",
      capability,
      `Extension UI host is unavailable for capability: ${capability}`,
    );
  }
  if (!host.capabilities.includes(capability)) {
    throw new ExtensionUiError(
      "unsupported",
      capability,
      `Extension UI capability is unsupported: ${capability}`,
    );
  }
  return host;
}
