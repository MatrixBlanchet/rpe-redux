/**
 * Where a glyph's artwork comes from.
 *
 * Two layers, both written by the theme registry: the bundled glyph set, which is
 * always complete, and the active package's overrides. The design system only
 * asks for a name; it never learns that themes or packages exist.
 *
 * The artwork is a shape, not a finished colour: the icon renderer applies a
 * filter that keeps the source alpha and inks it with the active surface token.
 */

import { isSafeIdentifier } from "../../utils/safeIdentifier.ts";

let overrides: Readonly<Record<string, string>> = Object.freeze({});
let builtin: Readonly<Record<string, string>> = Object.freeze({});
let revision = 0;
const listeners = new Set<() => void>();

/** Compatibility names mapped to the canonical playback glyphs. */
export const LEGACY_ICON_ALIASES = {
  play: "playbackPlay",
  pause: "previewPause",
  toolbarPause: "playbackPause",
} as const;

/** Resolve a compatibility alias to the glyph the theme registry publishes. */
export function canonicalIconName(name: string): string {
  return LEGACY_ICON_ALIASES[name as keyof typeof LEGACY_ICON_ALIASES] ?? name;
}

/** Canonicalizes package and host-provided maps while preserving unknown extensions. */
export function normalizeIconMap(next: Readonly<Record<string, string>> | undefined) {
  const normalized = Object.create(null) as Record<string, string>;
  for (const [name, source] of Object.entries(next ?? {})) {
    if (!isSafeIdentifier(name)) {
      continue;
    }
    if (!(name in LEGACY_ICON_ALIASES)) {
      normalized[name] = source;
    }
  }
  for (const [name, source] of Object.entries(next ?? {})) {
    if (!isSafeIdentifier(name)) {
      continue;
    }
    const canonical = canonicalIconName(name);
    if (canonical !== name && normalized[canonical] === undefined) {
      normalized[canonical] = source;
    }
  }
  return normalized;
}

/** Bump the revision and notify icon consumers. */
function notify(): void {
  revision += 1;
  for (const listener of [...listeners]) {
    listener();
  }
}

/** Subscribe to icon override or built-in set changes. */
export function subscribeIconOverrides(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Current change counter, for consumers that cache resolved glyphs. */
export function iconOverridesRevision(): number {
  return revision;
}

/** Replace the active package's glyph overrides and notify consumers. */
export function setIconOverrides(next: Readonly<Record<string, string>> | undefined): void {
  overrides = Object.freeze(normalizeIconMap(next));
  notify();
}

/** The complete set a package falls back to when it does not cover a name. */
export function setBuiltinIcons(next: Readonly<Record<string, string>> | undefined): void {
  builtin = Object.freeze(normalizeIconMap(next));
  notify();
}

/** Resolve the active package's glyph, then the built-in fallback, for a name. */
export function iconSourceFor(name: string): string | undefined {
  const canonical = canonicalIconName(name);
  return overrides[canonical] ?? builtin[canonical];
}
