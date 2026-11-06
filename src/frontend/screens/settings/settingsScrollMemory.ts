/**
 * The settings window's last reading position.
 *
 * Categories share one continuous scroller, so a plain scroll offset would
 * drift whenever a page above the viewport changes height. The saved position
 * anchors at the category under the top edge plus that section's offset, which
 * restores the same reading spot after a relaunch or a window resize.
 */
import { PREFERENCE_SECTIONS, preferences } from "../../../core/state/preferences.ts";

/** A category key plus the reading offset inside that section. */
export interface SettingsScrollMemory {
  category: string;
  offset: number;
}

/** Accept a stored category with a finite non-negative offset; ignore anything else. */
function normalize(value: unknown): SettingsScrollMemory | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const source = value as { category?: unknown; offset?: unknown };
  if (typeof source.category !== "string" || source.category.length === 0) {
    return null;
  }
  if (typeof source.offset !== "number" || !Number.isFinite(source.offset)) {
    return null;
  }
  return { category: source.category, offset: Math.max(0, source.offset) };
}

/** Read the position from the durable settings section; malformed data is ignored. */
export function readSettingsScrollMemory(): SettingsScrollMemory | null {
  return normalize(preferences.read(PREFERENCE_SECTIONS.settingsWindow, null));
}

/** Replace the remembered position. */
export function writeSettingsScrollMemory(memory: SettingsScrollMemory | null): void {
  preferences.write(PREFERENCE_SECTIONS.settingsWindow, memory);
}
