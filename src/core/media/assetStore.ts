/**
 * The document's asset bytes and the object URLs handed out for them.
 *
 * One entry per asset name, and the URL is reused until the bytes behind it
 * change — the point of the cache is that a redraw asks for the same picture
 * twice and gets the same URL, so the renderer does not reload the image. The
 * bytes stay owned by the document; `release` is what drops both. Blob URLs come
 * from `core/platform/browser/mediaHost.ts`, so this file names no browser API.
 */
import { mediaType } from "./mime.ts";
import { toBlobPart } from "../utils/bytes.ts";
import type { AssetMap } from "../global/document/types.ts";
import { objectUrlFor, releaseObjectUrl } from "../platform/browser/mediaHost.ts";
/**
 * Asset bytes for one document and the object URLs derived from them.
 *
 * URLs are reused while the bytes behind a name are unchanged, so repeated
 * redraws keep the same image URL. `release` drops bytes, names, and URLs.
 */
export class AssetStore {
  /** Asset bytes by name, including additions the caller has not saved. */
  assets: AssetMap;
  /** Bytes each asset had when the document was opened, for change detection. */
  original: Map<string, Uint8Array>;
  /** Names the document exposes, including names whose bytes are not loaded. */
  names: Set<string>;
  /** Cached object URL per asset, keyed by the bytes it represents. */
  urls: Map<string, { bytes: Uint8Array; url: string }>;

  /** Create an empty store, optionally over an existing asset map. */
  constructor(assets: AssetMap = new Map()) {
    this.assets = assets;
    this.original = new Map();
    this.names = new Set();
    this.urls = new Map();
  }
  /** Resolve a name to the value the document uses for it. */
  resolve(name: string): string {
    return name;
  }
  /** Object URL for one asset, reused until its bytes change. */
  url(name: string): string {
    const bytes = this.assets.get(name);
    if (!bytes) {
      return "";
    }
    const previous = this.urls.get(name);
    if (previous?.bytes === bytes) {
      return previous.url;
    }
    if (previous) {
      releaseObjectUrl(previous.url);
    }
    const url = objectUrlFor(new Blob([toBlobPart(bytes)], { type: mediaType(name) }));
    this.urls.set(name, { bytes, url });
    return url;
  }
  /** Read one asset's bytes when they are loaded. */
  async read(name: string): Promise<Uint8Array | undefined> {
    return this.assets.get(name);
  }
  /** Release every object URL and clear the asset, name, and original maps. */
  release(): void {
    for (const { url } of this.urls.values()) {
      releaseObjectUrl(url);
    }
    this.urls.clear();
    this.assets.clear();
    this.original.clear();
    this.names.clear();
  }
}
