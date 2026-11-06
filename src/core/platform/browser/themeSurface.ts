/**
 * The theme's single step into the document.
 *
 * `core/theme/` owns what a theme *is* (a package of CSS custom properties, an
 * appearance family, and a validated chrome recipe). Writing those properties
 * and preset names onto the document and telling the theme-aware controls to
 * re-read them is a host step, so it lives here.
 *
 * The event name is part of this seam: `redux-theme` is a DOM event, and its
 * listeners (the preview renderer, the settings window) are mounted independently
 * of whoever changed the theme.
 *
 * ```ts
 * applyThemeToDocument({ "--surface": "#0b0d12" }, "dark", "dark", chrome);
 * // document.documentElement.dataset.skin === "dark"
 * // document.documentElement.dataset.theme === "dark"
 * // document.documentElement.dataset.chromeInspector === "floating"
 * // document.documentElement.dataset.chromeDrawerSide === "left"
 * ```
 */

import type { ThemeChrome } from "../../theme/packages.ts";

/** Which of the two document-level looks the styles key off. */
export type ThemeMode = "light" | "dark";

const applied = new Set<string>();

/** CSS variables owned by `chrome.metrics`; absent metrics remove them again. */
const METRIC_VARIABLES: Readonly<Record<string, string>> = Object.freeze({
  panelGap: "--chrome-panel-gap",
  toolbarGap: "--theme-toolbar-gap",
  toolbarCell: "--theme-toolbar-cell",
  toolbarWidth: "--chrome-toolbar-width",
  inspectorWidth: "--inspector-width",
  drawerListWidth: "--drawer-list-width",
  sidebarWidth: "--theme-sidebar-width",
  sidebarExpandedWidth: "--theme-sidebar-expanded-width",
  titlebarHeight: "--titlebar-height",
  windowControlSize: "--theme-window-control-size",
  fieldControlWidth: "--field-control-width",
  fieldGap: "--theme-field-gap",
});

/**
 * Writes the palette, the theme id, the light/dark family, the chrome preset
 * names, and announces it.
 *
 * The palette is applied as inline custom properties on the root element: the
 * stylesheets only ever read the tokens, so a package can replace every colour
 * without a stylesheet of its own. Properties the new theme does not define are
 * removed, so switching from a package with extra tokens does not leak them into
 * the next one. Chrome presets become `data-chrome-*` attributes; the numeric
 * blur radius is the only inline custom property because it is not motion.
 */
export function applyThemeToDocument(
  colors: Readonly<Record<string, string>>,
  skin: string,
  mode: ThemeMode,
  chrome: ThemeChrome,
): void {
  const root = document.documentElement;
  for (const name of applied) {
    if (!(name in colors)) {
      root.style.removeProperty(name);
      applied.delete(name);
    }
  }
  for (const [name, value] of Object.entries(colors)) {
    root.style.setProperty(name, value);
    applied.add(name);
  }
  root.style.colorScheme = mode;
  root.dataset.skin = skin;
  root.dataset.theme = mode;

  root.dataset.chromeDensity = chrome.layout.density;
  root.dataset.chromeInspector = chrome.layout.inspector;
  root.dataset.chromeInspectorSide = chrome.layout.inspectorSide;
  // Styles key off the resolved direction, so `auto` never reaches the
  // stylesheet: the drawer grows toward the stage beside the inspector.
  root.dataset.chromeDrawerSide =
    chrome.layout.drawerSide === "auto"
      ? chrome.layout.inspectorSide === "left"
        ? "right"
        : "left"
      : chrome.layout.drawerSide;
  root.dataset.chromeSidebar = chrome.layout.sidebar;
  root.dataset.chromeToolbar = chrome.layout.toolbar;
  root.dataset.chromeToolbarPlacement = chrome.layout.toolbarPlacement;
  root.dataset.chromeToolbarFlow = chrome.layout.toolbarFlow;
  root.style.setProperty("--chrome-toolbar-columns", String(chrome.layout.toolbarColumns));
  root.dataset.chromeTransport = chrome.layout.transport;
  root.dataset.chromeTransportAnchor = chrome.layout.transportAnchor;
  root.dataset.chromeTransportDraggable = String(chrome.layout.transportDraggable);
  root.dataset.chromeStatusbar = chrome.layout.statusBar;
  root.dataset.chromeShape = chrome.surface.shape;
  root.dataset.chromeMaterial = chrome.surface.material;
  root.dataset.chromePattern = chrome.surface.pattern;
  root.dataset.chromeAmbient = chrome.surface.ambient;
  root.dataset.chromeMotion = chrome.motion.level;
  root.dataset.chromeSpeed = chrome.motion.speed;
  root.dataset.chromeHover = chrome.motion.hover;
  root.dataset.chromeEntrance = chrome.motion.entrance;
  root.dataset.chromeTitlebarDensity = chrome.titlebar.density;
  root.dataset.chromeWindowControls = chrome.titlebar.windowControls;
  root.dataset.chromeMenu = chrome.titlebar.menu;
  root.style.setProperty("--theme-backdrop-blur", `${chrome.surface.backdropBlur}px`);
  for (const [key, variable] of Object.entries(METRIC_VARIABLES)) {
    const value = chrome.metrics[key as keyof typeof chrome.metrics];
    if (value === undefined) {
      root.style.removeProperty(variable);
      continue;
    }
    root.style.setProperty(variable, key === "fieldControlWidth" ? `${value}%` : `${value}px`);
  }

  window.dispatchEvent(new Event("redux-theme"));
  // Layout presets can resize the workspace and inspector columns. Let the
  // imperative canvases remeasure after the browser has applied the new grid.
  requestAnimationFrame(() => window.dispatchEvent(new Event("resize")));
}
