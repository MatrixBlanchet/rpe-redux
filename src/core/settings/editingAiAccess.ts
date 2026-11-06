/**
 * AI-side permission for the optional editing features.
 *
 * Human permission stays in the existing `editing-*-enabled` values. These
 * values only gate AI writes, so a field can stay visible in the editor while a
 * code cell is refused it. The first time code cells are enabled, every AI value
 * is copied from its human switch; later changes stay independent.
 */
import {
  EDITING_FEATURE_AI_KEYS,
  EDITING_FEATURE_KEYS,
  EDITING_FEATURES,
  type EditingFeature,
} from "./editingFeatureKeys.ts";
import {
  PREFERENCE_SECTIONS,
  preferences,
  readPreference,
  writePreference,
} from "../state/preferences.ts";
import { isRecord } from "../utils/guards.ts";

const CODE_EXECUTION_KEY = "code-execution-enabled";
/** Marks that the first code-cell enable copied human values to AI values. */
export const AI_EDITING_INITIALIZED_KEY = "editing-ai-access-initialized";

/** The settings section, or an empty object when the stored section is malformed. */
function readSettings(): Record<string, unknown> {
  const value = readPreference<unknown>(PREFERENCE_SECTIONS.settings, {});
  return isRecord(value) ? { ...value } : {};
}

/**
 * Copy human permissions to the AI side when the first code cell is enabled.
 *
 * The copy is intentionally lazy: code cells can stay disabled for a whole
 * session without writing anything. Features added after initialization still
 * receive their human value, so an upgrade does not silently restrict them.
 *
 * @returns true when the settings section changed.
 */
export function seedAiEditingAccess(): boolean {
  const settings = readSettings();
  if (settings[CODE_EXECUTION_KEY] !== true) {
    return false;
  }
  let changed = false;
  for (const feature of EDITING_FEATURES) {
    const aiKey = EDITING_FEATURE_AI_KEYS[feature];
    if (typeof settings[aiKey] === "boolean") {
      continue;
    }
    const human = settings[EDITING_FEATURE_KEYS[feature]];
    settings[aiKey] = typeof human === "boolean" ? human : true;
    changed = true;
  }
  if (settings[AI_EDITING_INITIALIZED_KEY] !== true) {
    settings[AI_EDITING_INITIALIZED_KEY] = true;
    changed = true;
  }
  if (changed) {
    writePreference(PREFERENCE_SECTIONS.settings, settings);
  }
  return changed;
}

/** Resolve one feature against an already-read settings section. */
function effectiveAiFeature(settings: Record<string, unknown>, feature: EditingFeature): boolean {
  const ai = settings[EDITING_FEATURE_AI_KEYS[feature]];
  if (typeof ai === "boolean") {
    return ai;
  }
  const human = settings[EDITING_FEATURE_KEYS[feature]];
  return typeof human === "boolean" ? human : true;
}

/**
 * Whether an AI caller may write one optional editing feature.
 *
 * An explicit AI value wins. Before the first seed, the human value is the
 * fallback so the guide and the runtime agree with what the editor exposes.
 */
export function aiEditingFeatureEnabled(feature: EditingFeature): boolean {
  return effectiveAiFeature(readSettings(), feature);
}

/** Every AI feature permission from one settings read. */
export type AiEditingFeatureStates = Readonly<Record<EditingFeature, boolean>>;

/** Read the complete AI permission map once for a guide or transaction pass. */
export function aiEditingFeatureStates(): AiEditingFeatureStates {
  const settings = readSettings();
  const states = {} as Record<EditingFeature, boolean>;
  for (const feature of EDITING_FEATURES) {
    states[feature] = effectiveAiFeature(settings, feature);
  }
  return Object.freeze(states);
}

let installed = false;

/**
 * Watch the settings section and seed AI permissions when code cells turn on.
 *
 * The subscription lives beside the values it copies rather than in the
 * settings window, so a toggle changed through the API or a preference write
 * reaches the same initialization path.
 */
export function installEditingAiAccess(): () => void {
  if (installed) {
    return () => {};
  }
  installed = true;
  seedAiEditingAccess();
  const stop = preferences.subscribe(PREFERENCE_SECTIONS.settings, () => {
    seedAiEditingAccess();
  });
  return () => {
    stop();
    installed = false;
  };
}
