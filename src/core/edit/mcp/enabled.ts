/**
 * The one read of the MCP transport preference.
 *
 * The stored preference is the consent boundary: the bridge connects while it
 * is true, and the adapter re-reads the same value for every request. The AI
 * settings page exposes the code-cell toggle instead. Keeping the key here
 * gives the bridge, the adapter, and future transports one definition of
 * "enabled".
 */
import { PREFERENCE_SECTIONS, preferences } from "../../state/preferences.ts";

const MCP_ENABLED_KEY = "mcp-enabled";

/** True while the user has MCP enabled in Settings. */
export function mcpEnabled(): boolean {
  const settings = preferences.read<Record<string, unknown>>(PREFERENCE_SECTIONS.settings, {});
  return settings[MCP_ENABLED_KEY] === true;
}
