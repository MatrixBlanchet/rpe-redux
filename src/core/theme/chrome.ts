/**
 * The theme chrome recipe vocabulary and parser.
 *
 * Every member is a closed preset or a bounded integer. The renderer maps these
 * names onto host-authored CSS and React slots; a package never supplies style
 * text, markup, or executable values. Keeping the vocabulary in its own module
 * also keeps the package schema file focused on the document-level contract.
 */

/** Panel rhythm selected by a theme. */
export const THEME_DENSITIES = ["compact", "comfortable", "spacious"] as const;
export type ThemeDensity = (typeof THEME_DENSITIES)[number];

/** How the inspector participates in the workbench grid. */
export const THEME_INSPECTOR_LAYOUTS = ["docked", "floating", "overlay"] as const;
export type ThemeInspectorLayout = (typeof THEME_INSPECTOR_LAYOUTS)[number];

/** Which side the inspector reads from. */
export const THEME_INSPECTOR_SIDES = ["left", "right"] as const;
export type ThemeInspectorSide = (typeof THEME_INSPECTOR_SIDES)[number];

/**
 * Which way the document drawer grows.
 *
 * `auto` follows the stage: a right-hand inspector expands left and a left-hand
 * inspector expands right. `left` and `right` force that direction regardless
 * of the inspector side.
 */
export const THEME_DRAWER_SIDES = ["auto", "left", "right"] as const;
export type ThemeDrawerSide = (typeof THEME_DRAWER_SIDES)[number];

/** Whether the rail sits on the right, on top, or inside the inspector. */
export const THEME_SIDEBAR_LAYOUTS = ["rail", "floating", "top", "inspector"] as const;
export type ThemeSidebarLayout = (typeof THEME_SIDEBAR_LAYOUTS)[number];

/** Whether the toolbar is flush or a raised card. */
export const THEME_TOOLBAR_LAYOUTS = ["docked", "floating"] as const;
export type ThemeToolbarLayout = (typeof THEME_TOOLBAR_LAYOUTS)[number];

/** Where the toolbar sits in the window frame. */
export const THEME_TOOLBAR_PLACEMENTS = ["top", "left"] as const;
export type ThemeToolbarPlacement = (typeof THEME_TOOLBAR_PLACEMENTS)[number];

/** How registered toolbar rows become a visual flow. */
export const THEME_TOOLBAR_FLOWS = ["rows", "single", "grid"] as const;
export type ThemeToolbarFlow = (typeof THEME_TOOLBAR_FLOWS)[number];

/** Column count for the grid toolbar flow. */
export const THEME_TOOLBAR_COLUMNS = [2, 3, 4] as const;
export type ThemeToolbarColumns = (typeof THEME_TOOLBAR_COLUMNS)[number];

/** Title-row rhythm. */
export const THEME_TITLEBAR_DENSITIES = ["compact", "normal", "tall"] as const;
export type ThemeTitlebarDensity = (typeof THEME_TITLEBAR_DENSITIES)[number];

/** Caption-button framing for minimize, maximize, and close. */
export const THEME_WINDOW_CONTROL_STYLES = ["system", "compact", "capsule"] as const;
export type ThemeWindowControlStyle = (typeof THEME_WINDOW_CONTROL_STYLES)[number];

/** Application-menu presentation: one hamburger or expanded section triggers. */
export const THEME_MENU_STYLES = ["hamburger", "expanded"] as const;
export type ThemeMenuStyle = (typeof THEME_MENU_STYLES)[number];

/** Whether the transport card stays in the toolbar or floats above the window. */
export const THEME_TRANSPORT_LAYOUTS = ["toolbar", "floating"] as const;
export type ThemeTransportLayout = (typeof THEME_TRANSPORT_LAYOUTS)[number];

/** Which corner a floating transport card starts in. */
export const THEME_TRANSPORT_ANCHORS = [
  "top-left",
  "top-right",
  "bottom-left",
  "bottom-right",
] as const;
export type ThemeTransportAnchor = (typeof THEME_TRANSPORT_ANCHORS)[number];

/** Status-bar presence and framing. */
export const THEME_STATUS_BAR_LAYOUTS = ["docked", "floating", "hidden"] as const;
export type ThemeStatusBarLayout = (typeof THEME_STATUS_BAR_LAYOUTS)[number];

/** Corner scale. */
export const THEME_SHAPES = ["square", "soft", "round"] as const;
export type ThemeShape = (typeof THEME_SHAPES)[number];

/** Panel material presets. */
export const THEME_MATERIALS = ["solid", "raised", "glass", "flat"] as const;
export type ThemeMaterial = (typeof THEME_MATERIALS)[number];

/** Workbench backdrop patterns drawn from theme tokens. */
export const THEME_PATTERNS = ["none", "grid", "dots", "scanlines"] as const;
export type ThemePattern = (typeof THEME_PATTERNS)[number];

/** Decorative ambient layers drawn from theme tokens. */
export const THEME_AMBIENTS = ["none", "aurora", "pulse"] as const;
export type ThemeAmbient = (typeof THEME_AMBIENTS)[number];

/** Overall motion budget. */
export const THEME_MOTION_LEVELS = ["none", "subtle", "expressive"] as const;
export type ThemeMotionLevel = (typeof THEME_MOTION_LEVELS)[number];

/** Duration multiplier preset. */
export const THEME_MOTION_SPEEDS = ["slow", "normal", "fast"] as const;
export type ThemeMotionSpeed = (typeof THEME_MOTION_SPEEDS)[number];

/** Pointer feedback on action surfaces. */
export const THEME_HOVER_EFFECTS = ["none", "lift", "glow"] as const;
export type ThemeHoverEffect = (typeof THEME_HOVER_EFFECTS)[number];

/** Entrance animation for the main panels. */
export const THEME_ENTRANCES = ["none", "fade", "rise", "slide"] as const;
export type ThemeEntrance = (typeof THEME_ENTRANCES)[number];

/** Layout presets the theme picks for the window frame. */
export interface ThemeChromeLayout {
  density: ThemeDensity;
  inspector: ThemeInspectorLayout;
  inspectorSide: ThemeInspectorSide;
  /** Direction the document drawer opens; `auto` grows toward the stage. */
  drawerSide: ThemeDrawerSide;
  sidebar: ThemeSidebarLayout;
  toolbar: ThemeToolbarLayout;
  toolbarPlacement: ThemeToolbarPlacement;
  toolbarFlow: ThemeToolbarFlow;
  /** Column count when `toolbarFlow` is `grid`. */
  toolbarColumns: ThemeToolbarColumns;
  /** Registered action ids in the order the theme wants them drawn. */
  toolbarOrder: readonly string[];
  transport: ThemeTransportLayout;
  transportAnchor: ThemeTransportAnchor;
  transportDraggable: boolean;
  statusBar: ThemeStatusBarLayout;
}

/** Surface presets the theme picks for panel paint. */
export interface ThemeChromeSurface {
  shape: ThemeShape;
  material: ThemeMaterial;
  /** Backdrop blur in CSS pixels, bounded by the parser. */
  backdropBlur: number;
  pattern: ThemePattern;
  ambient: ThemeAmbient;
}

/** Motion presets the theme picks for transitions and entrances. */
export interface ThemeChromeMotion {
  level: ThemeMotionLevel;
  speed: ThemeMotionSpeed;
  hover: ThemeHoverEffect;
  entrance: ThemeEntrance;
}

/** Title-row framing: height rhythm and caption-button grouping. */
export interface ThemeChromeTitlebar {
  density: ThemeTitlebarDensity;
  windowControls: ThemeWindowControlStyle;
  /** One hamburger sheet or the section labels as a classic menu bar. */
  menu: ThemeMenuStyle;
}

/**
 * Bounded numeric overrides for the frame.
 *
 * Every value is a plain integer in CSS pixels except `fieldControlWidth`,
 * which is a percentage of the field row. An omitted value keeps the preset
 * default, so a package opts into only the measurements it wants to change.
 */
export interface ThemeChromeMetrics {
  /** Gap between floating panels and the window edge. */
  panelGap?: number;
  /** Gap between toolbar cells. */
  toolbarGap?: number;
  /** Square toolbar cell edge. */
  toolbarCell?: number;
  /** Width of the left toolbar column. */
  toolbarWidth?: number;
  /** Docked or floating inspector column width; the drawer's property column. */
  inspectorWidth?: number;
  /** Document drawer list column width; added to `inspectorWidth` when open. */
  drawerListWidth?: number;
  /** Collapsed rail width. */
  sidebarWidth?: number;
  /** Expanded rail width. */
  sidebarExpandedWidth?: number;
  /** Title-row height. */
  titlebarHeight?: number;
  /** Minimize, maximize, and close button edge. */
  windowControlSize?: number;
  /** Control column share of a labelled field row. */
  fieldControlWidth?: number;
  /** Column gap between a field label and its control. */
  fieldGap?: number;
}

/**
 * The validated chrome recipe carried by a theme package.
 *
 * Every member is a closed preset. The renderer maps these names onto CSS and
 * React slots that ship with the host, so a package can reshape the frame
 * without supplying any executable or style text of its own.
 */
export interface ThemeChrome {
  layout: ThemeChromeLayout;
  surface: ThemeChromeSurface;
  motion: ThemeChromeMotion;
  titlebar: ThemeChromeTitlebar;
  metrics: ThemeChromeMetrics;
}

/** The recipe used by packages that predate the chrome schema. */
export const DEFAULT_THEME_CHROME: ThemeChrome = Object.freeze({
  layout: Object.freeze({
    density: "comfortable",
    inspector: "docked",
    inspectorSide: "right",
    drawerSide: "auto",
    sidebar: "rail",
    toolbar: "docked",
    toolbarPlacement: "top",
    toolbarFlow: "rows",
    toolbarColumns: 2,
    toolbarOrder: Object.freeze([]),
    transport: "toolbar",
    transportAnchor: "bottom-right",
    transportDraggable: true,
    statusBar: "docked",
  }),
  surface: Object.freeze({
    shape: "soft",
    material: "solid",
    backdropBlur: 0,
    pattern: "none",
    ambient: "none",
  }),
  motion: Object.freeze({
    level: "subtle",
    speed: "normal",
    hover: "none",
    entrance: "fade",
  }),
  titlebar: Object.freeze({
    density: "normal",
    windowControls: "system",
    menu: "expanded",
  }),
  metrics: Object.freeze({}),
});

const MAX_BACKDROP_BLUR = 24;
const CHROME_KEYS: ReadonlySet<string> = new Set([
  "layout",
  "surface",
  "motion",
  "titlebar",
  "metrics",
]);
const CHROME_LAYOUT_KEYS: ReadonlySet<string> = new Set([
  "density",
  "inspector",
  "inspectorSide",
  "drawerSide",
  "sidebar",
  "toolbar",
  "toolbarPlacement",
  "toolbarFlow",
  "toolbarColumns",
  "toolbarOrder",
  "transport",
  "transportAnchor",
  "transportDraggable",
  "statusBar",
]);
const CHROME_SURFACE_KEYS: ReadonlySet<string> = new Set([
  "shape",
  "material",
  "backdropBlur",
  "pattern",
  "ambient",
]);
const CHROME_MOTION_KEYS: ReadonlySet<string> = new Set(["level", "speed", "hover", "entrance"]);
const CHROME_TITLEBAR_KEYS: ReadonlySet<string> = new Set(["density", "windowControls", "menu"]);
const METRIC_RANGES: Readonly<Record<keyof ThemeChromeMetrics, readonly [number, number]>> = {
  panelGap: [0, 32],
  toolbarGap: [0, 16],
  toolbarCell: [28, 56],
  toolbarWidth: [200, 480],
  inspectorWidth: [280, 720],
  drawerListWidth: [160, 560],
  sidebarWidth: [40, 120],
  sidebarExpandedWidth: [160, 320],
  titlebarHeight: [32, 56],
  windowControlSize: [28, 56],
  fieldControlWidth: [24, 72],
  fieldGap: [8, 32],
};
const METRIC_KEYS: ReadonlySet<string> = new Set(Object.keys(METRIC_RANGES));

/** Read an unknown value as a plain object, or null for arrays and primitives. */
function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/** Read one member of a closed enum, applying the default when absent. */
function chromeEnum<T extends string>(
  input: Record<string, unknown>,
  key: string,
  allowed: readonly T[],
  fallback: T,
): T | null {
  const value = input[key];
  if (value === undefined) {
    return fallback;
  }
  return typeof value === "string" && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : null;
}

/** True when a group contains only the keys its contract documents. */
function hasOnlyKeys(input: Record<string, unknown>, allowed: ReadonlySet<string>): boolean {
  return Object.keys(input).every((key) => allowed.has(key));
}

/**
 * Parse bounded frame metrics.
 *
 * Unknown keys reject the package so a misspelled knob is visible instead of
 * silently doing nothing. Omitted keys stay absent, which keeps the density and
 * title-bar presets in charge of their own defaults.
 */
function parseMetrics(value: unknown): ThemeChromeMetrics | null {
  if (value === undefined) {
    return {};
  }
  const input = record(value);
  if (!input || !hasOnlyKeys(input, METRIC_KEYS)) {
    return null;
  }
  const metrics: ThemeChromeMetrics = {};
  for (const [key, raw] of Object.entries(input)) {
    const range = METRIC_RANGES[key as keyof ThemeChromeMetrics];
    if (typeof raw !== "number" || !Number.isInteger(raw) || raw < range[0] || raw > range[1]) {
      return null;
    }
    metrics[key as keyof ThemeChromeMetrics] = raw;
  }
  return metrics;
}

/** Parse the title-row presets; absent keeps the documented frame. */
function parseTitlebar(value: unknown): ThemeChromeTitlebar | null {
  if (value === undefined) {
    return DEFAULT_THEME_CHROME.titlebar;
  }
  const input = record(value);
  if (!input || !hasOnlyKeys(input, CHROME_TITLEBAR_KEYS)) {
    return null;
  }
  const density = chromeEnum(
    input,
    "density",
    THEME_TITLEBAR_DENSITIES,
    DEFAULT_THEME_CHROME.titlebar.density,
  );
  const windowControls = chromeEnum(
    input,
    "windowControls",
    THEME_WINDOW_CONTROL_STYLES,
    DEFAULT_THEME_CHROME.titlebar.windowControls,
  );
  const menu = chromeEnum(input, "menu", THEME_MENU_STYLES, DEFAULT_THEME_CHROME.titlebar.menu);
  return density && windowControls && menu ? { density, windowControls, menu } : null;
}

const MAX_TOOLBAR_ORDER = 64;
const TOOLBAR_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{0,63}$/;

/** Parse the grid column count; only the published values are accepted. */
function parseToolbarColumns(value: unknown): ThemeToolbarColumns | null {
  if (value === undefined) {
    return DEFAULT_THEME_CHROME.layout.toolbarColumns;
  }
  return typeof value === "number" && (THEME_TOOLBAR_COLUMNS as readonly number[]).includes(value)
    ? (value as ThemeToolbarColumns)
    : null;
}

/**
 * Parse a toolbar order override.
 *
 * The list only reorders registered entries; it cannot add, remove, or rename
 * one. Unknown ids are harmless because the host keeps every unlisted entry in
 * its registry position.
 */
function parseToolbarOrder(value: unknown): readonly string[] | null {
  if (value === undefined) {
    return DEFAULT_THEME_CHROME.layout.toolbarOrder;
  }
  if (!Array.isArray(value) || value.length > MAX_TOOLBAR_ORDER) {
    return null;
  }
  const seen = new Set<string>();
  for (const id of value) {
    if (typeof id !== "string" || !TOOLBAR_ID_PATTERN.test(id) || seen.has(id)) {
      return null;
    }
    seen.add(id);
  }
  return Object.freeze([...value]);
}

/** Parse the optional chrome recipe; absent means the documented defaults. */
export function parseChrome(value: unknown): ThemeChrome | null {
  if (value === undefined) {
    return DEFAULT_THEME_CHROME;
  }
  const input = record(value);
  if (!input || !hasOnlyKeys(input, CHROME_KEYS)) {
    return null;
  }

  const layoutInput = input.layout === undefined ? {} : record(input.layout);
  if (layoutInput === null || !hasOnlyKeys(layoutInput, CHROME_LAYOUT_KEYS)) {
    return null;
  }
  const density = chromeEnum(
    layoutInput,
    "density",
    THEME_DENSITIES,
    DEFAULT_THEME_CHROME.layout.density,
  );
  const inspector = chromeEnum(
    layoutInput,
    "inspector",
    THEME_INSPECTOR_LAYOUTS,
    DEFAULT_THEME_CHROME.layout.inspector,
  );
  const inspectorSide = chromeEnum(
    layoutInput,
    "inspectorSide",
    THEME_INSPECTOR_SIDES,
    DEFAULT_THEME_CHROME.layout.inspectorSide,
  );
  const drawerSide = chromeEnum(
    layoutInput,
    "drawerSide",
    THEME_DRAWER_SIDES,
    DEFAULT_THEME_CHROME.layout.drawerSide,
  );
  const sidebar = chromeEnum(
    layoutInput,
    "sidebar",
    THEME_SIDEBAR_LAYOUTS,
    DEFAULT_THEME_CHROME.layout.sidebar,
  );
  const toolbar = chromeEnum(
    layoutInput,
    "toolbar",
    THEME_TOOLBAR_LAYOUTS,
    DEFAULT_THEME_CHROME.layout.toolbar,
  );
  const toolbarPlacement = chromeEnum(
    layoutInput,
    "toolbarPlacement",
    THEME_TOOLBAR_PLACEMENTS,
    DEFAULT_THEME_CHROME.layout.toolbarPlacement,
  );
  const toolbarFlow = chromeEnum(
    layoutInput,
    "toolbarFlow",
    THEME_TOOLBAR_FLOWS,
    DEFAULT_THEME_CHROME.layout.toolbarFlow,
  );
  const toolbarColumns = parseToolbarColumns(layoutInput.toolbarColumns);
  const toolbarOrder = parseToolbarOrder(layoutInput.toolbarOrder);
  const transport = chromeEnum(
    layoutInput,
    "transport",
    THEME_TRANSPORT_LAYOUTS,
    DEFAULT_THEME_CHROME.layout.transport,
  );
  const transportAnchor = chromeEnum(
    layoutInput,
    "transportAnchor",
    THEME_TRANSPORT_ANCHORS,
    DEFAULT_THEME_CHROME.layout.transportAnchor,
  );
  const transportDraggable =
    layoutInput.transportDraggable === undefined
      ? DEFAULT_THEME_CHROME.layout.transportDraggable
      : layoutInput.transportDraggable;
  if (typeof transportDraggable !== "boolean") {
    return null;
  }
  const statusBar = chromeEnum(
    layoutInput,
    "statusBar",
    THEME_STATUS_BAR_LAYOUTS,
    DEFAULT_THEME_CHROME.layout.statusBar,
  );
  if (
    !density ||
    !inspector ||
    !inspectorSide ||
    !drawerSide ||
    !sidebar ||
    !toolbar ||
    !toolbarPlacement ||
    !toolbarFlow ||
    !toolbarColumns ||
    !toolbarOrder ||
    !transport ||
    !transportAnchor ||
    !statusBar
  ) {
    return null;
  }

  const surfaceInput = input.surface === undefined ? {} : record(input.surface);
  if (surfaceInput === null || !hasOnlyKeys(surfaceInput, CHROME_SURFACE_KEYS)) {
    return null;
  }
  const shape = chromeEnum(surfaceInput, "shape", THEME_SHAPES, DEFAULT_THEME_CHROME.surface.shape);
  const material = chromeEnum(
    surfaceInput,
    "material",
    THEME_MATERIALS,
    DEFAULT_THEME_CHROME.surface.material,
  );
  const pattern = chromeEnum(
    surfaceInput,
    "pattern",
    THEME_PATTERNS,
    DEFAULT_THEME_CHROME.surface.pattern,
  );
  const ambient = chromeEnum(
    surfaceInput,
    "ambient",
    THEME_AMBIENTS,
    DEFAULT_THEME_CHROME.surface.ambient,
  );
  if (!shape || !material || !pattern || !ambient) {
    return null;
  }
  let backdropBlur = DEFAULT_THEME_CHROME.surface.backdropBlur;
  if (surfaceInput.backdropBlur !== undefined) {
    const raw = surfaceInput.backdropBlur;
    if (typeof raw !== "number" || !Number.isInteger(raw) || raw < 0 || raw > MAX_BACKDROP_BLUR) {
      return null;
    }
    backdropBlur = raw;
  }

  const motionInput = input.motion === undefined ? {} : record(input.motion);
  if (motionInput === null || !hasOnlyKeys(motionInput, CHROME_MOTION_KEYS)) {
    return null;
  }
  const level = chromeEnum(
    motionInput,
    "level",
    THEME_MOTION_LEVELS,
    DEFAULT_THEME_CHROME.motion.level,
  );
  const speed = chromeEnum(
    motionInput,
    "speed",
    THEME_MOTION_SPEEDS,
    DEFAULT_THEME_CHROME.motion.speed,
  );
  const hover = chromeEnum(
    motionInput,
    "hover",
    THEME_HOVER_EFFECTS,
    DEFAULT_THEME_CHROME.motion.hover,
  );
  const entrance = chromeEnum(
    motionInput,
    "entrance",
    THEME_ENTRANCES,
    DEFAULT_THEME_CHROME.motion.entrance,
  );
  if (!level || !speed || !hover || !entrance) {
    return null;
  }

  const titlebar = parseTitlebar(input.titlebar);
  const metrics = parseMetrics(input.metrics);
  if (!titlebar || !metrics) {
    return null;
  }

  return {
    layout: {
      density,
      inspector,
      inspectorSide,
      drawerSide,
      sidebar,
      toolbar,
      toolbarPlacement,
      toolbarFlow,
      toolbarColumns,
      toolbarOrder,
      transport,
      transportAnchor,
      transportDraggable,
      statusBar,
    },
    surface: { shape, material, backdropBlur, pattern, ambient },
    motion: { level, speed, hover, entrance },
    titlebar,
    metrics,
  };
}
