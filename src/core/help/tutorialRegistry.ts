/** Shared tutorial registration for the anchored tutorial host and Extensions API. */
import type { MessageParams } from "../../i18n/index.ts";
import { extensionTextKey, type ExtensionText } from "../extensions/i18n.ts";
import { assertSafeIdentifier } from "../utils/safeIdentifier.ts";

/** Text accepted by built-in and Extension-authored help entries. */
export type HelpText = string | { key: string; params?: MessageParams };

/** Placement hint for an anchored coach card. */
export type HelpTutorialPlacement = "auto" | "top" | "bottom" | "left" | "right";

/** Surface the tutorial needs open before its anchors are visible. */
export interface HelpTutorialActivation {
  kind: "inspector" | "drawer";
  id: string;
}

/** One step rendered by the shared coach-card host. */
export interface HelpTutorialStep {
  id: string;
  title: HelpText;
  body: HelpText;
  targets?: readonly string[];
  placement?: HelpTutorialPlacement;
  bullets?: readonly HelpText[];
  /** Overrides the tutorial-level activation for this step. */
  activate?: HelpTutorialActivation;
}

/** One searchable, categorized tutorial contributed by the host or an Extension. */
export interface HelpTutorialDefinition {
  id: string;
  category: HelpText;
  title: HelpText;
  summary: HelpText;
  keywords?: readonly HelpText[];
  icon?: string;
  /** Surface this tutorial teaches; every step defaults to it. */
  activate?: HelpTutorialActivation;
  steps: readonly HelpTutorialStep[];
}

const tutorials = new Map<string, HelpTutorialDefinition>();
const listeners = new Set<() => void>();
let snapshot: readonly HelpTutorialDefinition[] = [];

function publish(): void {
  snapshot = Object.freeze([...tutorials.values()]);
  for (const listener of [...listeners]) {
    listener();
  }
}

function scopeText(owner: string | undefined, text: HelpText): HelpText {
  return owner && (typeof text === "string" || typeof text === "object")
    ? extensionTextKey(owner, text as ExtensionText)
    : text;
}

function scopeDefinition(owner: string | undefined, definition: HelpTutorialDefinition) {
  if (!owner) {
    return definition;
  }
  const id = `extension.${owner}.${definition.id}`;
  return {
    ...definition,
    id,
    category: scopeText(owner, definition.category),
    title: scopeText(owner, definition.title),
    summary: scopeText(owner, definition.summary),
    keywords: definition.keywords?.map((value) => scopeText(owner, value)),
    steps: definition.steps.map((step) => ({
      ...step,
      title: scopeText(owner, step.title),
      body: scopeText(owner, step.body),
      bullets: step.bullets?.map((value) => scopeText(owner, value)),
    })),
  } satisfies HelpTutorialDefinition;
}

function validateDefinition(definition: HelpTutorialDefinition): void {
  assertSafeIdentifier(definition.id, "Tutorial id");
  if (!definition.steps.length) {
    throw new TypeError("Tutorial must contain at least one step");
  }
  const stepIds = new Set<string>();
  for (const step of definition.steps) {
    assertSafeIdentifier(step.id, "Tutorial step id");
    if (stepIds.has(step.id)) {
      throw new Error(`Tutorial step id is duplicated: ${step.id}`);
    }
    stepIds.add(step.id);
    if (step.targets?.some((target) => typeof target !== "string" || !target.trim())) {
      throw new TypeError(`Tutorial step targets must be non-empty strings: ${step.id}`);
    }
  }
}

/** Register a tutorial and return an idempotent disposer. */
export function registerHelpTutorial(
  definition: HelpTutorialDefinition,
  owner?: string,
): () => void {
  const scoped = scopeDefinition(owner, definition);
  validateDefinition(scoped);
  if (tutorials.has(scoped.id)) {
    throw new Error(`Tutorial id is already registered: ${scoped.id}`);
  }
  tutorials.set(scoped.id, Object.freeze(scoped));
  publish();
  let active = true;
  return () => {
    if (!active) {
      return;
    }
    active = false;
    if (tutorials.get(scoped.id) === scoped) {
      tutorials.delete(scoped.id);
      publish();
    }
  };
}

/** Read the current ordered tutorial catalog. */
export function getHelpTutorials(): readonly HelpTutorialDefinition[] {
  return snapshot;
}

/** Read one registered tutorial by its stable id. */
export function getHelpTutorial(id: string): HelpTutorialDefinition | undefined {
  return tutorials.get(id);
}

/** Subscribe to tutorial registration and removal. */
export function subscribeHelpTutorials(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
