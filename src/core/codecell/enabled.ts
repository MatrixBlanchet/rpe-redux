/**
 * The code-execution consent read.
 *
 * The Settings toggle is the consent boundary for AI-authored JavaScript. The
 * runtime and the HTTP cell route both read this one value.
 */
import { PREFERENCE_SECTIONS, preferences } from "../state/preferences.ts";

const CODE_EXECUTION_KEY = "code-execution-enabled";

/** True while the user has allowed one-shot code cells in Settings. */
export function codeExecutionEnabled(): boolean {
  const settings = preferences.read<Record<string, unknown>>(PREFERENCE_SECTIONS.settings, {});
  return settings[CODE_EXECUTION_KEY] === true;
}
