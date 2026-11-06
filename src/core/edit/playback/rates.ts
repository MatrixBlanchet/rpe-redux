/**
 * Playback speeds offered by the editor's transport surfaces.
 *
 * Slower speeds are the authoring tool; faster-than-realtime playback is not
 * part of the product. Keeping the list here makes the toolbar and the view
 * actions offer exactly the same choices.
 */
/** Supported playback rates, from slowest to realtime. */
export const PLAYBACK_RATES = ["0.25", "0.5", "0.75", "1"] as const;
