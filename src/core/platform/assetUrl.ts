/**
 * Resolves a bundled asset path for browser and non-DOM runs.
 *
 * Browser calls resolve against the served base URI; hosts without `document`
 * resolve the same file relative to this module.
 */
/** Resolve a bundled asset against the served root, or this module for non-DOM runs. */
export function assetUrl(path: string, moduleUrl: string = import.meta.url): string {
  if (typeof document !== "undefined" && moduleUrl === import.meta.url) {
    return new URL(`assets/${path}`, document.baseURI).href;
  }
  // Non-browser fallback (no `document`): resolve against this module's own URL. The
  // browser branch above resolves against the served base URI, which is the path that
  // actually ships; this branch mirrors the same directory on disk (`src/public/`).
  return new URL(`../../public/assets/${path}`, moduleUrl).href;
}
