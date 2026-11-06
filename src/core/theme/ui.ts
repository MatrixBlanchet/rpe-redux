/**
 * The theme's declarative UI layer.
 *
 * A theme may replace a published slot or component anatomy with a tree built
 * from host primitives. The tree is data: it names layout, text, icons, and
 * bound item fields, but carries no HTML, CSS, URLs, components, or handlers.
 * `frontend/platform/themeUi.tsx` renders it with the design system.
 */
import { isPackageName, type PackageName } from "../utils/packageName.ts";
import { isSafeIdentifier } from "../utils/safeIdentifier.ts";

/** Slots a theme may replace wholesale. */
export const THEME_UI_SLOTS = ["inspector.empty"] as const;
export type ThemeUiSlotId = (typeof THEME_UI_SLOTS)[number];

/** Design components whose content anatomy a theme may replace. */
export const THEME_UI_COMPONENTS = ["railItem", "menuTrigger", "windowControl"] as const;
export type ThemeUiComponentId = (typeof THEME_UI_COMPONENTS)[number];

/** Node kinds the host renderer understands. */
export const THEME_UI_NODE_KINDS = [
  "stack",
  "surface",
  "text",
  "icon",
  "dot",
  "divider",
  "spacer",
  "action",
  "repeat",
] as const;
export type ThemeUiNodeKind = (typeof THEME_UI_NODE_KINDS)[number];

export const THEME_UI_DIRECTIONS = ["row", "column"] as const;
export type ThemeUiDirection = (typeof THEME_UI_DIRECTIONS)[number];
export const THEME_UI_GAPS = ["none", "xs", "sm", "md", "lg"] as const;
export type ThemeUiGap = (typeof THEME_UI_GAPS)[number];
export const THEME_UI_ALIGNS = ["start", "center", "end", "stretch"] as const;
export type ThemeUiAlign = (typeof THEME_UI_ALIGNS)[number];
export const THEME_UI_JUSTIFIES = ["start", "center", "end", "between"] as const;
export type ThemeUiJustify = (typeof THEME_UI_JUSTIFIES)[number];
export const THEME_UI_PADDINGS = ["none", "sm", "md", "lg"] as const;
export type ThemeUiPadding = (typeof THEME_UI_PADDINGS)[number];
export const THEME_UI_TEXT_SIZES = ["caption", "label", "body", "heading"] as const;
export type ThemeUiTextSize = (typeof THEME_UI_TEXT_SIZES)[number];
export const THEME_UI_ICON_SIZES = ["sm", "md", "lg"] as const;
export type ThemeUiIconSize = (typeof THEME_UI_ICON_SIZES)[number];
export const THEME_UI_TONES = ["default", "muted", "accent", "danger"] as const;
export type ThemeUiTone = (typeof THEME_UI_TONES)[number];
export const THEME_UI_WEIGHTS = ["normal", "strong"] as const;
export type ThemeUiWeight = (typeof THEME_UI_WEIGHTS)[number];
export const THEME_UI_VARIANTS = ["plain", "outlined", "solid", "raised", "glass"] as const;
export type ThemeUiVariant = (typeof THEME_UI_VARIANTS)[number];
export const THEME_UI_SHAPES = ["square", "soft", "round", "pill"] as const;
export type ThemeUiShape = (typeof THEME_UI_SHAPES)[number];
export const THEME_UI_CONDITIONS = [
  "always",
  "active",
  "inactive",
  "expanded",
  "collapsed",
  "hasStatus",
  "noStatus",
] as const;
export type ThemeUiCondition = (typeof THEME_UI_CONDITIONS)[number];
export const THEME_UI_BINDINGS = ["label", "icon", "statusDot", "active"] as const;
export type ThemeUiBinding = (typeof THEME_UI_BINDINGS)[number];

/** One host-rendered node in a theme UI tree. */
export interface ThemeUiNode {
  kind: ThemeUiNodeKind;
  children?: readonly ThemeUiNode[];
  template?: ThemeUiNode;
  /** Literal text, or a language map; bound `label` wins when declared. */
  text?: PackageName;
  /** A design-system icon name. Bound `icon` wins when declared. */
  icon?: string;
  bind?: ThemeUiBinding;
  direction?: ThemeUiDirection;
  gap?: ThemeUiGap;
  align?: ThemeUiAlign;
  justify?: ThemeUiJustify;
  columns?: 1 | 2 | 3 | 4;
  span?: 1 | 2 | 3 | 4;
  wrap?: boolean;
  padding?: ThemeUiPadding;
  size?: ThemeUiTextSize;
  iconSize?: ThemeUiIconSize;
  tone?: ThemeUiTone;
  weight?: ThemeUiWeight;
  variant?: ThemeUiVariant;
  shape?: ThemeUiShape;
  when?: ThemeUiCondition;
  items?: "sidebarItems";
}

/** The declarative UI a package contributes. */
export interface ThemeUi {
  slots: Readonly<Partial<Record<ThemeUiSlotId, ThemeUiNode>>>;
  components: Readonly<Partial<Record<ThemeUiComponentId, ThemeUiNode>>>;
}

/** The empty contribution used by packages without a UI tree. */
export const EMPTY_THEME_UI: ThemeUi = Object.freeze({
  slots: Object.freeze({}),
  components: Object.freeze({}),
});

const MAX_UI_NODES = 128;
const MAX_UI_DEPTH = 8;
const MAX_UI_CHILDREN = 16;
const MAX_TEXT_LANGUAGES = 32;
const NODE_KEYS: ReadonlySet<string> = new Set([
  "kind",
  "children",
  "template",
  "text",
  "icon",
  "bind",
  "direction",
  "gap",
  "align",
  "justify",
  "columns",
  "span",
  "wrap",
  "padding",
  "size",
  "iconSize",
  "tone",
  "weight",
  "variant",
  "shape",
  "when",
  "items",
]);
const CONTAINER_KINDS: ReadonlySet<ThemeUiNodeKind> = new Set(["stack", "surface"]);

/** Read an unknown value as a plain object, or null for arrays and primitives. */
function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/** Read one member of a closed enum, applying the default when absent. */
function uiEnum<T extends string>(
  input: Record<string, unknown>,
  key: string,
  allowed: readonly T[],
  fallback: T | undefined,
): T | undefined | null {
  const value = input[key];
  if (value === undefined) {
    return fallback;
  }
  return typeof value === "string" && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : null;
}

/** Accept a bounded integer in a closed range. */
function uiInteger(
  input: Record<string, unknown>,
  key: string,
  min: number,
  max: number,
): number | undefined | null {
  const value = input[key];
  if (value === undefined) {
    return undefined;
  }
  return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max
    ? value
    : null;
}

/** True when a language map is bounded and contains only valid text. */
function isThemedText(value: unknown): value is PackageName {
  if (!isPackageName(value)) {
    return false;
  }
  return typeof value === "string" || Object.keys(value).length <= MAX_TEXT_LANGUAGES;
}

/** Parse one node against the depth, child, and total-node budgets. */
function parseNode(
  value: unknown,
  context: "slot" | "component",
  depth: number,
  budget: { count: number },
  inRepeat = false,
): ThemeUiNode | null {
  if (depth > MAX_UI_DEPTH || budget.count >= MAX_UI_NODES) {
    return null;
  }
  const input = record(value);
  if (!input || Object.keys(input).some((key) => !NODE_KEYS.has(key))) {
    return null;
  }
  const kind = uiEnum(input, "kind", THEME_UI_NODE_KINDS, undefined);
  if (!kind) {
    return null;
  }
  if (context === "component" && (kind === "action" || kind === "repeat")) {
    return null;
  }
  // A component anatomy must keep representing the registered item: text and
  // icons are bound to its real label and glyph, never theme-authored copies.
  if (context === "component" && kind === "text" && input.bind !== "label") {
    return null;
  }
  if (context === "component" && kind === "icon" && input.bind !== "icon") {
    return null;
  }
  // A slot may re-present registered sidebar items, never invent a button.
  // Actions are only valid inside a repeat template and read the bound item.
  if (kind === "action" && (!inRepeat || input.text !== undefined || input.icon !== undefined)) {
    return null;
  }
  if (kind === "repeat" && inRepeat) {
    return null;
  }
  budget.count += 1;

  const text = input.text === undefined ? undefined : isThemedText(input.text) ? input.text : null;
  if (text === null) {
    return null;
  }
  const icon =
    input.icon === undefined ? undefined : isSafeIdentifier(input.icon) ? input.icon : null;
  if (icon === null) {
    return null;
  }
  const bind = uiEnum(input, "bind", THEME_UI_BINDINGS, undefined);
  if (bind === null) {
    return null;
  }
  if (kind === "text" && !bind && !text) {
    return null;
  }
  if (kind === "icon" && !bind && !icon) {
    return null;
  }

  const direction = uiEnum(input, "direction", THEME_UI_DIRECTIONS, undefined);
  const gap = uiEnum(input, "gap", THEME_UI_GAPS, undefined);
  const align = uiEnum(input, "align", THEME_UI_ALIGNS, undefined);
  const justify = uiEnum(input, "justify", THEME_UI_JUSTIFIES, undefined);
  const padding = uiEnum(input, "padding", THEME_UI_PADDINGS, undefined);
  const size = uiEnum(input, "size", THEME_UI_TEXT_SIZES, undefined);
  const iconSize = uiEnum(input, "iconSize", THEME_UI_ICON_SIZES, undefined);
  const tone = uiEnum(input, "tone", THEME_UI_TONES, undefined);
  const weight = uiEnum(input, "weight", THEME_UI_WEIGHTS, undefined);
  const variant = uiEnum(input, "variant", THEME_UI_VARIANTS, undefined);
  const shape = uiEnum(input, "shape", THEME_UI_SHAPES, undefined);
  const when = uiEnum(input, "when", THEME_UI_CONDITIONS, undefined);
  const items =
    input.items === undefined ? undefined : input.items === "sidebarItems" ? "sidebarItems" : null;
  if (
    [
      direction,
      gap,
      align,
      justify,
      padding,
      size,
      iconSize,
      tone,
      weight,
      variant,
      shape,
      when,
      items,
    ].includes(null)
  ) {
    return null;
  }
  const columns = uiInteger(input, "columns", 1, 4);
  const span = uiInteger(input, "span", 1, 4);
  if (columns === null || span === null) {
    return null;
  }
  const wrap = input.wrap === undefined ? undefined : input.wrap;
  if (wrap !== undefined && typeof wrap !== "boolean") {
    return null;
  }

  const rawChildren = input.children;
  if (rawChildren !== undefined && !Array.isArray(rawChildren)) {
    return null;
  }
  if (rawChildren !== undefined && !CONTAINER_KINDS.has(kind)) {
    return null;
  }
  if (Array.isArray(rawChildren) && rawChildren.length > MAX_UI_CHILDREN) {
    return null;
  }
  const children: ThemeUiNode[] = [];
  for (const child of Array.isArray(rawChildren) ? rawChildren : []) {
    const parsed = parseNode(child, context, depth + 1, budget, inRepeat);
    if (!parsed) {
      return null;
    }
    children.push(parsed);
  }

  if (kind === "repeat") {
    if (items !== "sidebarItems" || input.template === undefined) {
      return null;
    }
    const template = parseNode(input.template, context, depth + 1, budget, true);
    if (!template) {
      return null;
    }
    return {
      kind,
      template,
      ...(direction ? { direction } : {}),
      ...(gap ? { gap } : {}),
      ...(align ? { align } : {}),
      ...(justify ? { justify } : {}),
      ...(columns !== undefined ? { columns: columns as 1 | 2 | 3 | 4 } : {}),
      ...(span !== undefined ? { span: span as 1 | 2 | 3 | 4 } : {}),
      ...(wrap !== undefined ? { wrap } : {}),
      ...(padding ? { padding } : {}),
      ...(when ? { when } : {}),
    };
  }
  if (input.template !== undefined || input.items !== undefined) {
    return null;
  }

  return {
    kind,
    ...(children.length ? { children } : {}),
    ...(text !== undefined ? { text } : {}),
    ...(icon !== undefined ? { icon } : {}),
    ...(bind ? { bind } : {}),
    ...(direction ? { direction } : {}),
    ...(gap ? { gap } : {}),
    ...(align ? { align } : {}),
    ...(justify ? { justify } : {}),
    ...(columns !== undefined ? { columns: columns as 1 | 2 | 3 | 4 } : {}),
    ...(span !== undefined ? { span: span as 1 | 2 | 3 | 4 } : {}),
    ...(wrap !== undefined ? { wrap } : {}),
    ...(padding ? { padding } : {}),
    ...(size ? { size } : {}),
    ...(iconSize ? { iconSize } : {}),
    ...(tone ? { tone } : {}),
    ...(weight ? { weight } : {}),
    ...(variant ? { variant } : {}),
    ...(shape ? { shape } : {}),
    ...(when ? { when } : {}),
  };
}

/**
 * True when an anatomy always renders the host-bound label or icon.
 *
 * `menuTrigger` and `windowControl` are the two critical-chrome anatomies. A
 * tree made only of dots or spacers would leave the host button unreadable, so
 * those templates need an unconditional bound primitive.
 */
function hasPermanentAnchor(node: ThemeUiNode): boolean {
  if (node.when !== undefined && node.when !== "always") {
    return false;
  }
  if (
    (node.kind === "text" && node.bind === "label") ||
    (node.kind === "icon" && node.bind === "icon")
  ) {
    return true;
  }
  return node.children?.some(hasPermanentAnchor) ?? false;
}

/**
 * Parse the optional theme UI contribution.
 *
 * Unknown slot/component ids reject the package so a typo cannot silently leave
 * the original surface in place. An absent `ui` object means "no overrides".
 */
export function parseThemeUi(value: unknown): ThemeUi | null {
  if (value === undefined) {
    return EMPTY_THEME_UI;
  }
  const input = record(value);
  if (!input || Object.keys(input).some((key) => key !== "slots" && key !== "components")) {
    return null;
  }
  const slotsInput = input.slots === undefined ? {} : record(input.slots);
  const componentsInput = input.components === undefined ? {} : record(input.components);
  if (slotsInput === null || componentsInput === null) {
    return null;
  }
  if (Object.keys(slotsInput).some((key) => !THEME_UI_SLOTS.includes(key as ThemeUiSlotId))) {
    return null;
  }
  if (
    Object.keys(componentsInput).some(
      (key) => !THEME_UI_COMPONENTS.includes(key as ThemeUiComponentId),
    )
  ) {
    return null;
  }
  const budget = { count: 0 };
  const slots: Partial<Record<ThemeUiSlotId, ThemeUiNode>> = {};
  for (const [id, node] of Object.entries(slotsInput)) {
    const parsed = parseNode(node, "slot", 0, budget);
    if (!parsed) {
      return null;
    }
    slots[id as ThemeUiSlotId] = parsed;
  }
  const components: Partial<Record<ThemeUiComponentId, ThemeUiNode>> = {};
  for (const [id, node] of Object.entries(componentsInput)) {
    const parsed = parseNode(node, "component", 0, budget);
    if (!parsed) {
      return null;
    }
    if ((id === "menuTrigger" || id === "windowControl") && !hasPermanentAnchor(parsed)) {
      return null;
    }
    components[id as ThemeUiComponentId] = parsed;
  }
  return { slots, components };
}
