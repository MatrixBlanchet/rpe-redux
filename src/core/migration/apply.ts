/**
 * Applies an RPE migration plan to the mounted editor.
 *
 * This is the only step that writes: settings values are written only when the
 * catalog has declared the key, and shortcuts only when this build registered
 * the command. Anything missing becomes a warning instead of an exception, so a
 * partial migration still reports what it could not carry over.
 */
import { setLanguage } from "../../i18n/index.ts";
import { shortcutRegistry } from "../shortcuts/registry.ts";
import { canonicalText } from "../shortcuts/keys.ts";
import { PREFERENCE_SECTIONS, writePreference } from "../state/preferences.ts";
import { values } from "../state/values.ts";
import type { RpeMigrationPlan } from "./rpe.ts";

/** Wheel and pointer gestures are Redux defaults; RPE's Hotkey.txt only lists keys. */
const POINTER_BINDING = /^(?:WHEEL|MOUSE)/u;

/** Counts and non-fatal problems from applying a plan. */
export interface RpeApplyResult {
  readonly settings: number;
  readonly shortcuts: number;
  readonly warnings: readonly string[];
}

/** Apply settings and shortcut bindings from one parsed RPE installation. */
export function applyRpeMigrationPlan(plan: RpeMigrationPlan): RpeApplyResult {
  const warnings: string[] = [];
  let settings = 0;
  let shortcuts = 0;
  for (const setting of plan.settings) {
    if (!values.byId.has(setting.key)) {
      warnings.push(`Setting is not available in this build: ${setting.key}`);
      continue;
    }
    try {
      values.byId.set(setting.key, setting.value);
      settings += 1;
    } catch (error) {
      warnings.push(
        `Setting could not be applied: ${setting.key} (${
          error instanceof Error ? error.message : String(error)
        })`,
      );
    }
  }
  for (const shortcut of plan.shortcuts) {
    if (!shortcutRegistry.has(shortcut.id)) {
      warnings.push(`Shortcut is not registered in this build: ${shortcut.id}`);
      continue;
    }
    // RPE describes keyboard bindings only. Redux actions such as "next judge
    // line" also carry wheel gestures, so an import must not drop them: replace
    // the key bindings and keep the pointer gestures the action already has.
    const pointerBindings = shortcutRegistry
      .bindingsOf(shortcut.id)
      .filter((binding) => POINTER_BINDING.test(binding.key))
      .map(canonicalText);
    const result = shortcutRegistry.replaceAllBindings(shortcut.id, [
      ...shortcut.bindings,
      ...pointerBindings,
    ]);
    if (result.ok) {
      shortcuts += 1;
    } else {
      warnings.push(`Shortcut could not be applied: ${shortcut.id} (${result.error ?? "unknown"})`);
    }
  }
  if (plan.language) {
    writePreference(PREFERENCE_SECTIONS.language, setLanguage(plan.language));
  }
  return Object.freeze({
    settings,
    shortcuts,
    warnings: Object.freeze([...warnings, ...plan.warnings]),
  });
}
