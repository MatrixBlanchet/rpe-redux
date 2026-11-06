/**
 * Settings-section keys that belong to a core runtime owner, with no control of
 * their own.
 *
 * Their consumers are core modules (`core/edit/bindings/runtimeSettings.ts`
 * reads these values), so the declaration lives here beside the rest of the catalog;
 * a key whose only readers are in the frontend is declared in
 * `frontend/screens/settings/editorDisplaySettings.ts` instead. Both go through
 * `declarePersistedValue`, so there is one path that puts a value in the settings
 * section, not one per layer.
 *
 * The default written here is the only one: a read is a read of the value, not a
 * key paired with a fallback at the point of use.
 */
import { declarePersistedValue } from "./settings.ts";

const EDITOR_RUNTIME_DEFAULTS = {
  /** Whether the hit-sound limit is enforced at all. */
  "hitsound-limit-enabled": true,
  /** How many simultaneous hit sounds play before the oldest is dropped. */
  "hitsound-limit": "5",
  /** Per-kind timing offsets in seconds, as a comma-separated list. */
  "hitsound-offsets": "",
  /** Event-wheel increment overrides, stored as a readable JSON array. */
  "event-wheel-increments": "",
} as const;

for (const [key, initial] of Object.entries(EDITOR_RUNTIME_DEFAULTS)) {
  declarePersistedValue(key, initial);
}
