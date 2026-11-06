/**
 * Persisted update-check keys shared by the settings schema and the update store.
 *
 * Source and signing key are build configuration, not preferences; only the
 * channel switch and the last manual check timestamp live in the settings
 * section.
 */
export const UPDATE_SETTING_KEYS = Object.freeze({
  autoCheck: "update-auto-check",
  prereleases: "update-include-prereleases",
} as const);
