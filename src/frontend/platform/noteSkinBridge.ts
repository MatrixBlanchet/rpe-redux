/**
 * Installs note-skin loading and change notification for the webview build.
 *
 * Bundled asset URLs and the DOM event that announces a new skin are platform
 * facts, so they are supplied to `core/media` from here.
 */
import {
  DEFAULT_NOTE_SKIN,
  EXTERNAL_NOTE_SKIN_PREFIX,
  setBundledNoteSkinLoader,
  setExternalNoteSkinLoader,
  setNoteSkinChangeNotifier,
  type LoadedNoteSkin,
} from "../../core/media/noteSkins.ts";
import { parseNoteSkin } from "../../core/media/noteSkin.ts";
import { readExternalNoteSkin } from "../../core/platform/desktop/noteSkinPackages.ts";
import { isPackageName, type PackageName } from "../../core/utils/packageName.ts";
import { isRecord } from "../../core/utils/guards.ts";
import { t } from "../../i18n/index.ts";

/**
 * The browser half of the note-skin story.
 *
 * Three things about skins are not domain and so cannot live in `core/media/`:
 * the assets compiled into the build (a bundler glob), the URL they resolve to
 * (a `document` concern), and telling the rest of the interface that the active
 * skin changed (a DOM event). They are here, behind one installer that hands the
 * media layer the two capabilities it needs.
 */

const bundledParticleAssets = import.meta.glob<string>(
  "../../assets/skins/default/particle/img-*.png",
  {
    eager: true,
    query: "?url",
    import: "default",
  },
);
const bundledLineAssets =
  import.meta.env?.DEV || import.meta.env?.PROD
    ? import.meta.glob<string>("../../assets/skins/default/judgeline/*.png", {
        eager: true,
        query: "?url",
        import: "default",
      })
    : {};

/** The built-in judgement line texture the bundled skin ships. */
export const DEFAULT_BUNDLED_LINE_TEXTURE_URL =
  Object.entries(bundledLineAssets ?? {}).find(([path]) => path.endsWith("/line.png"))?.[1] ?? "";

/** The interface's note-skin-changed event; the shell and the preview both listen. */
export const NOTE_SKIN_EVENT = "redux:note-skin-changed";

/** Resolve a built-in skin file in Vite dev or from the packaged site root. */
export function bundledNoteSkinUrl(path: string): string {
  const url = import.meta.env?.DEV ? `/src/assets/skins/default/${path}` : `skins/default/${path}`;
  return new URL(url, document.baseURI).href;
}

/**
 * The layouts a built-in skin can be served from.
 *
 * The dev server exposes the source folder while the packaged site serves the
 * copied one; a portable archive or a hosted build can end up on either. Both
 * bases are tried so the skin stays available when only one is reachable.
 */
function bundledSkinBases(): URL[] {
  const paths = import.meta.env?.DEV
    ? ["/src/assets/skins/default/", "skins/default/"]
    : ["skins/default/", "/src/assets/skins/default/"];
  return [...new Set(paths)].map((path) => new URL(path, document.baseURI));
}

/**
 * Reads a build-time skin asset, including one the bundler inlined as a `data:`
 * URI. The packaged page's `connect-src` does not cover `data:`, so inlined
 * textures are decoded here rather than fetched.
 */
async function assetBytes(url: string, name: string): Promise<Uint8Array> {
  if (url.startsWith("data:")) {
    const comma = url.indexOf(",");
    const header = url.slice(5, comma);
    const payload = url.slice(comma + 1);
    if (!header.endsWith(";base64")) {
      return new TextEncoder().encode(decodeURIComponent(payload));
    }
    const binary = atob(payload);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
  }
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(t("settings.skin.error.bundledAssetUnavailable", { name }));
  }
  return new Uint8Array(await response.arrayBuffer());
}

/** Fetches and parses the default skin from one candidate base URL. */
async function loadBundledDefaultSkinAt(base: URL): Promise<LoadedNoteSkin> {
  const manifestResponse = await fetch(new URL("manifest.json", base));
  if (!manifestResponse.ok) {
    throw new Error(
      t("settings.skin.error.bundledUnavailable", { status: manifestResponse.status }),
    );
  }
  const manifestBytes = new Uint8Array(await manifestResponse.arrayBuffer());
  const rawManifest = JSON.parse(new TextDecoder().decode(manifestBytes)) as {
    notes?: Record<string, { file: string }>;
    events?: Record<string, { file: string }>;
    judgeline?: { line?: { file: string } };
    particles?: Record<string, string>;
    audio?: Record<string, string>;
  };
  const particlePatterns = Object.values(rawManifest.particles ?? {}).filter((name) =>
    name.includes("*"),
  );
  const names = new Set([
    ...Object.values(rawManifest.notes ?? {}).map((texture) => texture.file),
    ...Object.values(rawManifest.events ?? {}).map((texture) => texture.file),
    ...(rawManifest.judgeline?.line ? [rawManifest.judgeline.line.file] : []),
    ...Object.values(rawManifest.particles ?? {}).filter((name) => !name.includes("*")),
    ...Object.values(rawManifest.audio ?? {}),
  ]);
  const files = new Map<string, Uint8Array>([["manifest.json", manifestBytes]]);
  await Promise.all(
    [...names].map(async (name) => {
      const response = await fetch(new URL(name, base));
      if (!response.ok) {
        throw new Error(t("settings.skin.error.bundledAssetUnavailable", { name }));
      }
      files.set(name, new Uint8Array(await response.arrayBuffer()));
    }),
  );
  await Promise.all(
    Object.entries(bundledParticleAssets).map(async ([source, url]) => {
      const name = `particle/${source.split("/").at(-1)}`;
      if (
        !particlePatterns.some((pattern) => {
          const [prefix, suffix] = pattern.split("*");
          const capture =
            name.startsWith(prefix) && name.endsWith(suffix)
              ? name.slice(prefix.length, name.length - suffix.length)
              : "";
          return /^\d+$/.test(capture);
        })
      ) {
        return;
      }
      const response = await assetBytes(url, name);
      files.set(name, response);
    }),
  );
  return {
    id: DEFAULT_NOTE_SKIN,
    manifest: parseNoteSkin(files),
    files,
  };
}

// The bundled pack ships with the build, so it is fetched and validated once and
// shared by every consumer: hit sounds, the editor skin, and the settings preview.
let bundledCache: Promise<LoadedNoteSkin> | null = null;

/** Reads the bundled skin's manifest name from the first reachable base. */
async function readBundledSkinName(): Promise<PackageName> {
  for (const base of bundledSkinBases()) {
    try {
      const response = await fetch(new URL("manifest.json", base));
      if (!response.ok) {
        continue;
      }
      const raw: unknown = await response.json();
      if (isRecord(raw) && isPackageName(raw.name)) {
        return raw.name;
      }
    } catch {
      // Try the other layout.
    }
  }
  return "Redux Default";
}

let bundledNameCache: Promise<PackageName> | null = null;

/** The built-in skin's self-provided name, without loading its assets. */
export function bundledNoteSkinName(): Promise<PackageName> {
  bundledNameCache ??= readBundledSkinName();
  return bundledNameCache;
}

/** Loads and caches the default skin, trying each candidate base in turn. */
async function loadBundledDefaultSkin(): Promise<LoadedNoteSkin> {
  if (bundledCache) {
    return bundledCache;
  }
  let failure: unknown = null;
  for (const base of bundledSkinBases()) {
    try {
      const pack = await loadBundledDefaultSkinAt(base);
      bundledCache = Promise.resolve(pack);
      return pack;
    } catch (error) {
      // Keep the first failure, which names the layout this build targets; the
      // fallback usually reports the served index page instead.
      failure ??= error;
    }
  }
  throw failure ?? new Error(t("settings.skin.error.bundledUnavailable", { status: 0 }));
}

/**
 * Hand the browser capabilities to `core/media`. Call once, before the editor
 * mounts: loading a skin can happen as early as the hit sounds.
 */
export function installNoteSkinBridge(): void {
  setBundledNoteSkinLoader(loadBundledDefaultSkin);
  setExternalNoteSkinLoader(async (id) => {
    const files = await readExternalNoteSkin(id);
    return {
      id: `${EXTERNAL_NOTE_SKIN_PREFIX}${id}`,
      manifest: parseNoteSkin(files),
      files,
    };
  });
  setNoteSkinChangeNotifier(() => {
    window.dispatchEvent(new Event(NOTE_SKIN_EVENT));
  });
}
