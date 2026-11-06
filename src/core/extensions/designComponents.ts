/**
 * Public, versioned design-component contract for Extension-owned panels.
 *
 * This module is data-only: it validates the component tree and exposes the
 * catalog that both the sandbox bridge and the frontend renderer consume.
 * React and product-domain values stay behind the host adapter.
 */

/** The first published design-component SDK version. */
export const EXTENSION_DESIGN_SDK_VERSION = "1.0.0" as const;

/** Slots where the host can mount an Extension design panel. */
export const EXTENSION_DESIGN_SLOTS = ["inspector.panel", "editor.drawer"] as const;
export type ExtensionDesignSlotId = (typeof EXTENSION_DESIGN_SLOTS)[number];

/** Component identifiers supported by the first design-component export. */
export const EXTENSION_DESIGN_COMPONENTS = ["text", "button", "stack"] as const;
export type ExtensionDesignComponentId = (typeof EXTENSION_DESIGN_COMPONENTS)[number];

/** Versions currently supported for every published design component. */
export const EXTENSION_DESIGN_COMPONENT_VERSION = 1 as const;

/** A catalog entry that can be shown to an Extension author. */
export interface ExtensionDesignComponentCatalogEntry {
  readonly id: ExtensionDesignComponentId;
  readonly version: typeof EXTENSION_DESIGN_COMPONENT_VERSION;
  readonly capability: "ui.panel";
  readonly slots: readonly ExtensionDesignSlotId[];
  readonly props: readonly string[];
}

/** A catalog entry that describes one available mount slot. */
export interface ExtensionDesignSlotCatalogEntry {
  readonly id: ExtensionDesignSlotId;
  readonly sdkVersion: typeof EXTENSION_DESIGN_SDK_VERSION;
  readonly capability: "ui.panel";
}

/** The complete public design-component catalog. */
export interface ExtensionDesignCatalog {
  readonly sdkVersion: typeof EXTENSION_DESIGN_SDK_VERSION;
  readonly slots: readonly ExtensionDesignSlotCatalogEntry[];
  readonly components: readonly ExtensionDesignComponentCatalogEntry[];
}

/** A serializable component node submitted by an Extension. */
export interface ExtensionDesignNode {
  readonly type: ExtensionDesignComponentId;
  readonly version: typeof EXTENSION_DESIGN_COMPONENT_VERSION;
  readonly props: Readonly<Record<string, unknown>>;
  readonly children?: readonly ExtensionDesignNode[];
}

/** A click or input notification from a rendered design component. */
export interface ExtensionDesignEvent {
  readonly nodeId: string;
  readonly kind: "click" | "input";
  readonly value?: string;
}

/** A panel registration using the versioned design-component contract. */
export interface ExtensionDesignPanelDefinition {
  readonly id: string;
  readonly slot: ExtensionDesignSlotId;
  readonly component: ExtensionDesignNode;
  onEvent?(event: ExtensionDesignEvent): void;
}

/** Stable validation codes returned for malformed design contributions. */
export type ExtensionDesignValidationCode =
  | "invalidDefinition"
  | "invalidId"
  | "unknownSlot"
  | "unknownComponent"
  | "unsupportedVersion"
  | "invalidProps"
  | "invalidChildren";

/** A structured design-component contract error. */
export class ExtensionDesignValidationError extends Error {
  readonly code: ExtensionDesignValidationCode;

  /** Build an error that callers can branch on without parsing text. */
  constructor(code: ExtensionDesignValidationCode, message: string) {
    super(message);
    this.name = "ExtensionDesignValidationError";
    this.code = code;
  }
}

const SLOT_CATALOG: readonly ExtensionDesignSlotCatalogEntry[] = Object.freeze([
  { id: "inspector.panel", sdkVersion: EXTENSION_DESIGN_SDK_VERSION, capability: "ui.panel" },
  { id: "editor.drawer", sdkVersion: EXTENSION_DESIGN_SDK_VERSION, capability: "ui.panel" },
]);

const COMPONENT_CATALOG: readonly ExtensionDesignComponentCatalogEntry[] = Object.freeze([
  {
    id: "text",
    version: EXTENSION_DESIGN_COMPONENT_VERSION,
    capability: "ui.panel",
    slots: ["inspector.panel", "editor.drawer"],
    props: ["id", "text", "tone", "size"],
  },
  {
    id: "button",
    version: EXTENSION_DESIGN_COMPONENT_VERSION,
    capability: "ui.panel",
    slots: ["inspector.panel", "editor.drawer"],
    props: ["id", "label", "variant", "size", "disabled"],
  },
  {
    id: "stack",
    version: EXTENSION_DESIGN_COMPONENT_VERSION,
    capability: "ui.panel",
    slots: ["inspector.panel", "editor.drawer"],
    props: ["id", "direction", "gap", "align"],
  },
]);

const COMPONENTS = new Set<string>(EXTENSION_DESIGN_COMPONENTS);
const SLOTS = new Set<string>(EXTENSION_DESIGN_SLOTS);
const NODE_KEYS = new Set(["type", "version", "props", "children"]);
const MAX_DEPTH = 8;
const MAX_NODES = 128;
const MAX_CHILDREN = 16;
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/u;
const TONES = new Set(["default", "muted", "accent", "danger"]);
const TEXT_SIZES = new Set(["caption", "label", "body", "heading"]);
const BUTTON_VARIANTS = new Set(["ghost", "outlined", "solid", "plain", "danger", "link"]);
const BUTTON_SIZES = new Set(["sm", "md", "lg"]);
const DIRECTIONS = new Set(["row", "column"]);
const GAPS = new Set(["none", "xs", "sm", "md", "lg"]);
const ALIGNS = new Set(["start", "center", "end", "stretch"]);

/** Return the immutable catalog published to sandbox callers. */
export function extensionDesignCatalog(): ExtensionDesignCatalog {
  return Object.freeze({
    sdkVersion: EXTENSION_DESIGN_SDK_VERSION,
    slots: SLOT_CATALOG,
    components: COMPONENT_CATALOG,
  });
}

/** Read a plain record while rejecting arrays and null. */
function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/** Validate a bounded local id used for event routing and ownership. */
function validateId(value: unknown, required: boolean): string | undefined {
  if (value === undefined && !required) {
    return undefined;
  }
  if (typeof value !== "string" || !value || value.length > 128 || !ID_PATTERN.test(value)) {
    throw new ExtensionDesignValidationError(
      "invalidProps",
      "Design component ids must be bounded identifier strings",
    );
  }
  return value;
}

/** Validate one component node against the published runtime props schema. */
function normalizeNode(
  value: unknown,
  depth: number,
  budget: { count: number },
): ExtensionDesignNode {
  if (depth > MAX_DEPTH || budget.count >= MAX_NODES) {
    throw new ExtensionDesignValidationError(
      "invalidChildren",
      "Design component tree is too large",
    );
  }
  const input = record(value);
  if (!input || Object.keys(input).some((key) => !NODE_KEYS.has(key))) {
    throw new ExtensionDesignValidationError(
      "invalidDefinition",
      "Design component node is invalid",
    );
  }
  if (typeof input.type !== "string" || !COMPONENTS.has(input.type)) {
    throw new ExtensionDesignValidationError(
      "unknownComponent",
      "Design component type is unknown",
    );
  }
  if (input.version !== EXTENSION_DESIGN_COMPONENT_VERSION) {
    throw new ExtensionDesignValidationError(
      "unsupportedVersion",
      `Design component version must be ${EXTENSION_DESIGN_COMPONENT_VERSION}`,
    );
  }
  const props = record(input.props);
  if (!props) {
    throw new ExtensionDesignValidationError("invalidProps", "Design component props are invalid");
  }
  const normalized: Record<string, unknown> = {};
  const type = input.type as ExtensionDesignComponentId;
  const allowed = new Set(COMPONENT_CATALOG.find((entry) => entry.id === type)?.props ?? []);
  if (Object.keys(props).some((key) => !allowed.has(key))) {
    throw new ExtensionDesignValidationError(
      "invalidProps",
      `Unknown props for design component: ${type}`,
    );
  }
  normalized.id = validateId(props.id, false);
  if (type === "text") {
    if (typeof props.text !== "string" || props.text.length > 4_096) {
      throw new ExtensionDesignValidationError(
        "invalidProps",
        "Text components require bounded text",
      );
    }
    normalized.text = props.text;
    if (props.tone !== undefined && (typeof props.tone !== "string" || !TONES.has(props.tone))) {
      throw new ExtensionDesignValidationError("invalidProps", "Text tone is invalid");
    }
    if (
      props.size !== undefined &&
      (typeof props.size !== "string" || !TEXT_SIZES.has(props.size))
    ) {
      throw new ExtensionDesignValidationError("invalidProps", "Text size is invalid");
    }
    if (props.tone !== undefined) {
      normalized.tone = props.tone;
    }
    if (props.size !== undefined) {
      normalized.size = props.size;
    }
  }
  if (type === "button") {
    if (typeof props.label !== "string" || !props.label.length || props.label.length > 512) {
      throw new ExtensionDesignValidationError("invalidProps", "Button components require a label");
    }
    normalized.label = props.label;
    if (
      props.variant !== undefined &&
      (typeof props.variant !== "string" || !BUTTON_VARIANTS.has(props.variant))
    ) {
      throw new ExtensionDesignValidationError("invalidProps", "Button variant is invalid");
    }
    if (
      props.size !== undefined &&
      (typeof props.size !== "string" || !BUTTON_SIZES.has(props.size))
    ) {
      throw new ExtensionDesignValidationError("invalidProps", "Button size is invalid");
    }
    if (props.disabled !== undefined && typeof props.disabled !== "boolean") {
      throw new ExtensionDesignValidationError("invalidProps", "Button disabled must be boolean");
    }
    if (props.variant !== undefined) {
      normalized.variant = props.variant;
    }
    if (props.size !== undefined) {
      normalized.size = props.size;
    }
    if (props.disabled !== undefined) {
      normalized.disabled = props.disabled;
    }
  }
  if (type === "stack") {
    if (
      props.direction !== undefined &&
      (typeof props.direction !== "string" || !DIRECTIONS.has(props.direction))
    ) {
      throw new ExtensionDesignValidationError("invalidProps", "Stack direction is invalid");
    }
    if (props.gap !== undefined && (typeof props.gap !== "string" || !GAPS.has(props.gap))) {
      throw new ExtensionDesignValidationError("invalidProps", "Stack gap is invalid");
    }
    if (
      props.align !== undefined &&
      (typeof props.align !== "string" || !ALIGNS.has(props.align))
    ) {
      throw new ExtensionDesignValidationError("invalidProps", "Stack alignment is invalid");
    }
    if (props.direction !== undefined) {
      normalized.direction = props.direction;
    }
    if (props.gap !== undefined) {
      normalized.gap = props.gap;
    }
    if (props.align !== undefined) {
      normalized.align = props.align;
    }
  }
  budget.count += 1;
  const childrenInput = input.children;
  if (type !== "stack" && childrenInput !== undefined) {
    throw new ExtensionDesignValidationError(
      "invalidChildren",
      "Only stack components accept children",
    );
  }
  if (
    childrenInput !== undefined &&
    (!Array.isArray(childrenInput) || childrenInput.length > MAX_CHILDREN)
  ) {
    throw new ExtensionDesignValidationError(
      "invalidChildren",
      "Design component children are invalid",
    );
  }
  const children = Array.isArray(childrenInput)
    ? childrenInput.map((child) => normalizeNode(child, depth + 1, budget))
    : undefined;
  return Object.freeze({
    type,
    version: EXTENSION_DESIGN_COMPONENT_VERSION,
    props: Object.freeze(
      Object.fromEntries(Object.entries(normalized).filter(([, entry]) => entry !== undefined)),
    ),
    ...(children === undefined ? {} : { children: Object.freeze(children) }),
  });
}

/** Validate and freeze one panel registration before it reaches a host renderer. */
export function normalizeExtensionDesignPanel(value: unknown): ExtensionDesignPanelDefinition {
  const input = record(value);
  if (
    !input ||
    Object.keys(input).some((key) => !["id", "slot", "component", "onEvent"].includes(key))
  ) {
    throw new ExtensionDesignValidationError(
      "invalidDefinition",
      "Design panel definition is invalid",
    );
  }
  if (
    typeof input.id !== "string" ||
    !input.id ||
    input.id.length > 128 ||
    !ID_PATTERN.test(input.id)
  ) {
    throw new ExtensionDesignValidationError("invalidId", "Design panel id is invalid");
  }
  if (typeof input.slot !== "string" || !SLOTS.has(input.slot)) {
    throw new ExtensionDesignValidationError("unknownSlot", "Design panel slot is unknown");
  }
  if (input.onEvent !== undefined && typeof input.onEvent !== "function") {
    throw new ExtensionDesignValidationError(
      "invalidDefinition",
      "Design panel event handler is invalid",
    );
  }
  const component = normalizeNode(input.component, 0, { count: 0 });
  const entry = COMPONENT_CATALOG.find((candidate) => candidate.id === component.type);
  if (!entry || !entry.slots.includes(input.slot as ExtensionDesignSlotId)) {
    throw new ExtensionDesignValidationError(
      "unknownComponent",
      "Design component cannot render in this slot",
    );
  }
  return Object.freeze({
    id: input.id,
    slot: input.slot as ExtensionDesignSlotId,
    component,
    ...(input.onEvent === undefined
      ? {}
      : { onEvent: input.onEvent as ExtensionDesignPanelDefinition["onEvent"] }),
  });
}
