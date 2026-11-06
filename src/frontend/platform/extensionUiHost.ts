/**
 * Adapts Extension UI capabilities to the host-owned Inspector and sidebar.
 *
 * This is the only layer that knows both the Extension registration contract
 * and React. Panel content remains free-form React; the surrounding frame,
 * sidebar button and panel identity stay owned by the application shell.
 */
import { createElement, useEffect, useRef, type ReactNode } from "react";
import {
  getSidebarEntry,
  registerSidebarDivider,
  registerSidebarItem,
} from "../../core/shell/registries/sidebar.ts";
import { connectSidebarNavigationHost } from "../../core/api/sidebar.ts";
import { CLOSE_INSPECTOR_EVENT } from "../../core/shell/shellEventNames.ts";
import {
  connectExtensionUiHost,
  type ExtensionOverlayDefinition,
  type ExtensionPanelDefinition,
  type ExtensionSidebarDefinition,
  type ExtensionUiRequest,
} from "../../core/extensions/extensionUi.ts";
import { registerInspectorPanel, openPane } from "../screens/editor/inspector/controller.ts";
import { registerExtensionOverlay } from "./extensionOverlays.ts";
import { Button } from "../../design/components/button/Button.tsx";
import {
  extensionDesignCatalog,
  normalizeExtensionDesignPanel,
  type ExtensionDesignEvent,
  type ExtensionDesignNode,
  type ExtensionDesignPanelDefinition,
} from "../../core/extensions/designComponents.ts";

/** Prefixes a local UI id with its owning Extension and validates the local part. */
function scopedId(owner: string, localId: string): string {
  const value = localId.trim();
  if (!value || value.length > 128 || !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(value)) {
    throw new Error(
      "Extension UI ids must be bounded and use letters, digits, dots, underscores, or hyphens",
    );
  }
  return `extension:${owner}:${value}`;
}

/** Rejects registration once the owning Extension has been disposed. */
function assertActive(request: ExtensionUiRequest): void {
  if (request.signal.aborted) {
    throw new Error(`Extension is already disposed: ${request.source.id}`);
  }
}

/** Runs a disposer once, either explicitly or when the Extension aborts. */
function ownedBySignal(request: ExtensionUiRequest, disposer: () => void): () => void {
  let active = true;
  const dispose = () => {
    if (!active) {
      return;
    }
    active = false;
    request.signal.removeEventListener("abort", dispose);
    disposer();
  };
  request.signal.addEventListener("abort", dispose, { once: true });
  return dispose;
}

/** Builds the React renderer for a panel, wrapping an imperative mount when given one. */
function panelRenderer(
  request: ExtensionUiRequest,
  definition: ExtensionPanelDefinition,
): () => ReactNode {
  if (typeof definition.component === "function") {
    const render = definition.component;
    return () =>
      createElement(
        "div",
        {
          className: "extension-panel-scope",
          "data-redux-extension-scope": request.source.id,
        },
        render() as ReactNode,
      );
  }
  const mount = definition.mount;
  /** Host component for a panel that mounts extension-owned DOM into a container. */
  return function ExtensionPanelMount() {
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
      const element = ref.current;
      if (!element || !mount) {
        return;
      }
      return mount(element, request.signal);
    }, [mount, request.signal]);
    return createElement("div", {
      ref,
      className: "extension-panel-mount",
      "data-redux-extension-scope": request.source.id,
    });
  };
}

/** Render one validated design component with host-owned design primitives. */
function designNodeRenderer(
  node: ExtensionDesignNode,
  onEvent: ((event: ExtensionDesignEvent) => void) | undefined,
  key: string,
): ReactNode {
  const props = node.props;
  const id = typeof props.id === "string" ? props.id : "";
  if (node.type === "text") {
    return createElement(
      "span",
      {
        key,
        className: `extension-design-text extension-design-text-${String(props.size ?? "body")}`,
      },
      String(props.text),
    );
  }
  if (node.type === "button") {
    return createElement(
      Button,
      {
        key,
        variant:
          (props.variant as "ghost" | "outlined" | "solid" | "plain" | "danger" | "link") ??
          "ghost",
        size: (props.size as "sm" | "md" | "lg") ?? "md",
        disabled: props.disabled === true,
        onClick: () => onEvent?.({ nodeId: id, kind: "click" }),
      },
      String(props.label),
    );
  }
  return createElement(
    "div",
    {
      key,
      className: `extension-design-stack extension-design-stack-${String(props.direction ?? "column")} extension-design-gap-${String(props.gap ?? "none")} extension-design-align-${String(props.align ?? "stretch")}`,
      "data-extension-design-node": id || undefined,
    },
    ...(node.children ?? []).map((child, index) =>
      designNodeRenderer(child, onEvent, `${key}:${index}`),
    ),
  );
}

/** Registers an inspector panel owned by the requesting Extension. */
function registerPanel(request: ExtensionUiRequest, definition: ExtensionPanelDefinition) {
  assertActive(request);
  if (typeof definition.component !== "function" && typeof definition.mount !== "function") {
    throw new Error(`Extension panel must provide a component or mount: ${definition.id}`);
  }
  const id = scopedId(request.source.id, definition.id);
  return ownedBySignal(
    request,
    registerInspectorPanel({
      id,
      component: panelRenderer(request, definition),
    }),
  );
}

/** Registers a validated declarative design panel in a host-owned slot. */
function registerDesignPanel(
  request: ExtensionUiRequest,
  definition: ExtensionDesignPanelDefinition,
) {
  assertActive(request);
  const normalized = normalizeExtensionDesignPanel(definition);
  return ownedBySignal(
    request,
    registerInspectorPanel({
      id: scopedId(request.source.id, normalized.id),
      component: () =>
        createElement(
          "div",
          {
            className: "extension-design-panel",
            "data-redux-extension-scope": request.source.id,
            "data-extension-design-slot": normalized.slot,
            "data-extension-design-version": normalized.component.version,
          },
          designNodeRenderer(normalized.component, normalized.onEvent, normalized.id),
        ),
    }),
  );
}

/** Registers a sidebar item or divider that opens the Extension's panel. */
function registerSidebar(request: ExtensionUiRequest, definition: ExtensionSidebarDefinition) {
  assertActive(request);
  if ("kind" in definition) {
    if (definition.kind !== "divider") {
      throw new Error("Invalid sidebar entry kind");
    }
    return ownedBySignal(
      request,
      registerSidebarDivider(
        {
          kind: "divider",
          id: scopedId(request.source.id, definition.id),
          order: definition.order ?? 1000,
        },
        request.source.id,
      ),
    );
  }
  const panelId = scopedId(request.source.id, definition.panelId);
  return ownedBySignal(
    request,
    registerSidebarItem(
      {
        id: scopedId(request.source.id, definition.id),
        order: definition.order ?? 1000,
        panelId,
        icon: {
          ...definition.icon,
          ...(definition.icon.domId === undefined
            ? {}
            : { domId: scopedId(request.source.id, definition.icon.domId) }),
        },
        onActivate: () => {
          openPane(panelId);
        },
      },
      request.source.id,
    ),
  );
}

/** Registers a stage or window overlay owned by the requesting Extension. */
function registerOverlay(request: ExtensionUiRequest, definition: ExtensionOverlayDefinition) {
  assertActive(request);
  return ownedBySignal(request, registerExtensionOverlay(request, definition));
}

/**
 * Connects the shell navigation behind `api.sidebar.open` and `api.sidebar.close`.
 *
 * The gate has already resolved and owner-checked the id. Opening runs the same
 * activation the rail button uses; closing asks the mounted inspector to close
 * only when the route's panel is the active pane, so another panel stays intact.
 */
function connectSidebarNavigation(): () => void {
  return connectSidebarNavigationHost({
    open(id) {
      const entry = getSidebarEntry(id);
      if (!entry || "kind" in entry) {
        return false;
      }
      entry.onActivate();
      return true;
    },
    close(id) {
      const entry = getSidebarEntry(id);
      if (!entry || "kind" in entry || !entry.panelId) {
        return false;
      }
      window.dispatchEvent(
        new CustomEvent<string>(CLOSE_INSPECTOR_EVENT, { detail: entry.panelId }),
      );
      return true;
    },
  });
}

/** Installs the frontend capability adapter before packaged Extensions load. */
export function installExtensionUiHost(): () => void {
  const disposeUi = connectExtensionUiHost({
    capabilities: ["panel", "sidebar", "overlay"],
    registerPanel,
    designCatalog: async () => extensionDesignCatalog(),
    registerDesignPanel,
    registerSidebar,
    registerOverlay,
  });
  const disposeNavigation = connectSidebarNavigation();
  return () => {
    disposeUi();
    disposeNavigation();
  };
}
