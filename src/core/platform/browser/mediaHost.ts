/**
 * The browser's media primitives, so `core/media` can decode without naming them.
 *
 * A decoder is a mechanism and belongs in core: what a texture is, which images
 * are cached, how a sound is scheduled. *How bytes become a bitmap or a sound* is
 * the host's business, and this is the one place in `core/` allowed to say
 * `new Image()`, `new Audio()`, `createImageBitmap` or `URL.createObjectURL`. The
 * guard in `eslint.config.js` enforces exactly that: those names are banned
 * everywhere under `src/core/**` except `core/platform/**`.
 *
 * Nothing here holds state, reads a preference, or decides anything — every
 * function is the host call plus the type it returns. That is what makes the
 * consumer's own logic (which image to decode, whether to cache) stay testable:
 * nothing needs a DOM to import this module, because the host is only touched
 * inside a function body.
 *
 * ```ts
 * const url = objectUrlFor(new Blob([bytes], { type: "image/png" }));
 * try {
 *   const image = createImageElement();
 *   image.src = url;
 *   await image.decode();
 * } finally {
 *   releaseObjectUrl(url);
 * }
 * ```
 */

/** A blob URL that stays valid until `releaseObjectUrl` is called with it. */
export function objectUrlFor(blob: Blob): string {
  return URL.createObjectURL(blob);
}

/** Releases a URL from `objectUrlFor`. Releasing an unknown URL is harmless. */
export function releaseObjectUrl(url: string): void {
  URL.revokeObjectURL(url);
}

/**
 * Whether this host can play a sound through a media element at all.
 *
 * A host without `Audio` still gets a Web Audio context, so a caller uses this to
 * choose the fallback path rather than to refuse the work.
 */
export function hasAudioElement(): boolean {
  return typeof Audio !== "undefined";
}

/** An audio element with no source. The caller owns it and sets `src`. */
export function createAudioElement(): HTMLAudioElement {
  return new Audio();
}

/** An image element with no source. Set `src`, then `await image.decode()`. */
export function createImageElement(): HTMLImageElement {
  return new Image();
}

/**
 * Whether the host can decode off the main thread with `createImageBitmap`.
 *
 * False means the caller must fall back to an `<img>` element, which decodes on
 * the main thread — slower, and the reason animated images take that path.
 */
export function hasImageBitmap(): boolean {
  return typeof createImageBitmap === "function";
}

/**
 * Decodes a blob into a bitmap.
 *
 * Pass `{}` for an image whose natural size is not known yet, or the resize
 * options once it is. Rejects when the blob is not a decodable image; the caller
 * decides whether that is fatal.
 */
export function decodeImageBitmap(blob: Blob, options: ImageBitmapOptions): Promise<ImageBitmap> {
  return createImageBitmap(blob, options);
}

/** Window metrics for sizing decoded media, with unavailable values reported as 0. */
export interface ViewportMetrics {
  /** Window inner width in CSS pixels, or 0 when the host reports none. */
  width: number;
  /** Window inner height in CSS pixels, or 0 when the host reports none. */
  height: number;
  /** Device pixel ratio, or 0 when the host reports none. */
  devicePixelRatio: number;
}

/**
 * What the host says about the window, for sizing decoded media to the screen.
 *
 * Unavailable values come back as `0` rather than as a default, so the default
 * stays with the caller that needs one (a 1920x1080 fallback is a media decision,
 * not a host fact).
 */
export function viewportMetrics(): ViewportMetrics {
  return {
    width: globalThis.innerWidth || 0,
    height: globalThis.innerHeight || 0,
    devicePixelRatio: globalThis.devicePixelRatio || 0,
  };
}
