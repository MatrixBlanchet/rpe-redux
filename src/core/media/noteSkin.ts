/**
 * The note-skin manifest format and its validation.
 *
 * Defines texture slots, useful rectangles and aligned-texture maths, parses
 * `skin.json`, and rejects malformed or oversized packages before bytes load.
 */
import { t } from "../../i18n/index.ts";
import { isPackageName, type PackageName } from "../utils/packageName.ts";
import { isRecord } from "../utils/guards.ts";

/** Logical bounds exclude transparent padding/glow, as in PCE AlignedNoteTexture. */
export interface UsefulRect {
  x: number;
  y: number;
  width: number;
  height: number;
}
/** One texture slot and its optional logical bounds. */
export interface NoteTexture {
  file: string;
  useful?: UsefulRect;
}
/** The validated shape of a note skin's manifest. */
export interface NoteSkinManifest {
  name: PackageName;
  notes: Record<string, NoteTexture>;
  events: Record<string, NoteTexture>;
  /** Optional judge-line texture; the bundled default applies when absent. */
  judgeline?: { line: NoteTexture };
  /** Named effect sprite resources, resolved relative to skin.json. */
  particles?: Record<string, string>;
  /** Named audio resources, resolved relative to skin.json. */
  audio?: Record<string, string>;
}
/** Every semantic texture slot the parser recognizes. */
export const NOTE_TEXTURES = [
  "tap",
  "tap_highlight",
  "drag",
  "drag_highlight",
  "flick",
  "flick_highlight",
  "hold_head",
  "hold_head_highlight",
  "hold_body",
  "event_bar",
  "hold_body_highlight",
  "hold_end",
] as const;
/** Slots a package must provide for a complete skin. */
export const REQUIRED_TEXTURES = ["tap", "drag", "flick", "hold_head", "hold_body", "hold_end"];
const SEMANTIC_TEXTURE_NAMES = {
  notes: {
    tap: "tap",
    tap_highlight: "tap_highlight",
    drag: "drag",
    drag_highlight: "drag_highlight",
    flick: "flick",
    flick_highlight: "flick_highlight",
    hold_head: "hold_head",
    hold_head_highlight: "hold_head_highlight",
    hold_body: "hold_body",
    hold_body_highlight: "hold_body_highlight",
    hold_end: "hold_end",
  },
  events: { event_bar: "event_bar" },
} as const;
/** Upper bound on a whole skin package. */
export const SKIN_MAX_BYTES = 64 * 1024 * 1024;
/** Upper bound on one skin image. */
export const SKIN_IMAGE_MAX_BYTES = 8 * 1024 * 1024;
/** Upper bound on files in one skin package. */
export const SKIN_MAX_FILES = 256;
const SKIN_MAX_PIXELS = 64 * 1024 * 1024;

/** Validate the PNG signature and IHDR dimensions, rejecting oversized images. */
export function validatePngDimensions(bytes: Uint8Array): { width: number; height: number } {
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  if (
    bytes.length < 33 ||
    signature.some((value, index) => bytes[index] !== value) ||
    String.fromCharCode(...bytes.subarray(12, 16)) !== "IHDR"
  ) {
    throw new Error(t("model.noteSkin.invalidPng"));
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const width = view.getUint32(16),
    height = view.getUint32(20);
  if (!width || !height || width > 4096 || height > 4096 || width * height > 16 * 1024 * 1024) {
    throw new Error(t("model.noteSkin.invalidSize"));
  }
  return { width, height };
}

/** Validate a useful rectangle against its image bounds. */
export function validateUseful(rect: unknown, width: number, height: number): UsefulRect {
  if (
    !isRecord(rect) ||
    ![rect.x, rect.y, rect.width, rect.height].every(
      (value) => typeof value === "number" && Number.isFinite(value),
    )
  ) {
    throw new Error(t("model.noteSkin.invalidUseful"));
  }
  const result: UsefulRect = {
    x: rect.x as number,
    y: rect.y as number,
    width: rect.width as number,
    height: rect.height as number,
  };
  if (
    result.x < 0 ||
    result.y < 0 ||
    result.width <= 0 ||
    result.height <= 0 ||
    result.x + result.width > width ||
    result.y + result.height > height
  ) {
    throw new Error(t("model.noteSkin.usefulOutOfBounds"));
  }
  return { ...result };
}

/** Only apply PCE's reference rectangles when the actual PNG dimensions match. */
export function referenceUseful(name: string, width: number, height: number): UsefulRect {
  const full = { x: 0, y: 0, width, height };
  const heights: Record<string, number> = {
    tap: 100,
    drag: 60,
    flick: 200,
    hold_head: 50,
    hold_end: 50,
  };
  if (width === 1089 && heights[name] === height) {
    return { x: 50, y: 0, width: 989, height };
  }
  const normal: Record<string, string> = {
    tap_highlight: "tap",
    drag_highlight: "drag",
    flick_highlight: "flick",
  };
  if (width === 1089 && normal[name] && heights[normal[name]] + 100 === height) {
    return { x: 50, y: 50, width: 989, height: height - 100 };
  }
  if (name === "hold_head_highlight" && width === 1086 && height === 99) {
    return { x: 49, y: 0, width: 988, height: 50 };
  }
  if (name === "hold_body_highlight" && width === 1086 && height === 1900) {
    return { x: 49, y: 0, width: 988, height };
  }
  return full;
}

/** Draw the full PNG around its logical centre without stretching aspect ratio. */
export function alignedTexture(
  rect: UsefulRect,
  textureWidth: number,
  textureHeight: number,
  x: number,
  y: number,
  width: number,
) {
  const scale = width / rect.width;
  return {
    x: x - width / 2 - rect.x * scale,
    y: y - (rect.height * scale) / 2 - rect.y * scale,
    width: textureWidth * scale,
    height: textureHeight * scale,
  };
}

/** Draws the full image so its declared useful rectangle aligns to a logical box. */
export function alignedTextureBox(
  rect: UsefulRect,
  textureWidth: number,
  textureHeight: number,
  centerX: number,
  centerY: number,
  logicalWidth: number,
  logicalHeight: number,
) {
  const scaleX = logicalWidth / rect.width;
  const scaleY = logicalHeight / rect.height;
  return {
    x: centerX - logicalWidth / 2 - rect.x * scaleX,
    y: centerY - logicalHeight / 2 - rect.y * scaleY,
    width: textureWidth * scaleX,
    height: textureHeight * scaleY,
  };
}

/**
 * Parse and validate a skin package's files.
 *
 * Throws a localized error for a missing or duplicate manifest, unknown slots,
 * unsafe paths, missing required textures, or exceeded size budgets.
 */
export function parseNoteSkin(
  files: ReadonlyMap<string, Uint8Array>,
  fallbackName = t("model.noteSkin.defaultName"),
): NoteSkinManifest {
  let total = 0;
  for (const bytes of files.values()) {
    total += bytes.byteLength;
  }
  // Keep imported sprite sequences usable while bounding decoded image memory.
  if (total > SKIN_MAX_BYTES || files.size > SKIN_MAX_FILES + 1) {
    throw new Error(t("model.noteSkin.tooLarge"));
  }
  const manifestEntries = [...files.keys()].filter((name) =>
    ["skin.json", "manifest.json"].includes(name.split("/").at(-1) ?? ""),
  );
  if (!manifestEntries.length) {
    throw new Error(t("model.noteSkin.invalidManifest"));
  }
  if (manifestEntries.length > 1) {
    throw new Error(t("model.noteSkin.multipleManifests"));
  }
  let raw: unknown;
  let base = "";
  if (manifestEntries[0]) {
    const path = manifestEntries[0];
    const bytes = files.get(path);
    if (!bytes) {
      throw new Error(t("model.noteSkin.invalidManifest"));
    }
    if (bytes.length > 65536) {
      throw new Error(t("model.noteSkin.manifestTooLarge"));
    }
    raw = JSON.parse(new TextDecoder().decode(bytes));
    const manifestName = path.slice(path.lastIndexOf("/") + 1);
    base = path.slice(0, path.length - manifestName.length);
    if (
      !isRecord(raw) ||
      !isPackageName(raw.name) ||
      !isRecord(raw.notes) ||
      !isRecord(raw.events)
    ) {
      throw new Error(t("model.noteSkin.invalidManifest"));
    }
  }
  let manifestTextures: Record<string, unknown> | undefined;
  if (isRecord(raw) && isRecord(raw.notes) && isRecord(raw.events)) {
    // The manifest is the authored source of truth: `notes` and `events` name
    // the semantic texture slots directly. Unknown section names are rejected
    // rather than silently dropped.
    const noteNames = new Set(Object.keys(SEMANTIC_TEXTURE_NAMES.notes));
    const eventNames = new Set(Object.keys(SEMANTIC_TEXTURE_NAMES.events));
    manifestTextures = {};
    for (const [section, allowed] of [
      [raw.notes, noteNames],
      [raw.events, eventNames],
    ] as const) {
      for (const [name, entry] of Object.entries(section)) {
        if (!allowed.has(name) || manifestTextures[name]) {
          throw new Error(t("model.noteSkin.invalidManifest"));
        }
        manifestTextures[name] = entry;
      }
    }
  } else {
    throw new Error(t("model.noteSkin.invalidManifest"));
  }
  const textures: Record<string, NoteTexture> = {};
  let judgeline: NoteSkinManifest["judgeline"];
  const linkedAssets: { particles?: Record<string, string>; audio?: Record<string, string> } = {};
  /** Resolve a `particles` or `audio` map, expanding an `img-*` sequence wildcard. */
  const readLinked = (key: "particles" | "audio") => {
    if (!isRecord(raw) || raw[key] === undefined) {
      return undefined;
    }
    if (!isRecord(raw[key])) {
      throw new Error(t("model.noteSkin.invalidManifest"));
    }
    const result: Record<string, string> = {};
    for (const [name, value] of Object.entries(raw[key])) {
      if (
        !name.trim() ||
        typeof value !== "string" ||
        !value ||
        value.startsWith("/") ||
        /[\\:\0]/.test(value) ||
        value.split("/").some((part) => part === ".." || part === ".")
      ) {
        throw new Error(t("model.noteSkin.invalidManifest"));
      }
      const keyWildcards = [...name].filter((character) => character === "*").length;
      const pathWildcards = [...value].filter((character) => character === "*").length;
      if (keyWildcards || pathWildcards) {
        if (key !== "particles" || keyWildcards !== 1 || pathWildcards !== 1) {
          throw new Error(t("model.noteSkin.invalidManifest"));
        }
        const [keyPrefix, keySuffix] = name.split("*");
        const [pathPrefix, pathSuffix] = value.split("*");
        if (
          !/^img-$/.test(keyPrefix) ||
          keySuffix ||
          !pathPrefix.includes("/") ||
          !pathPrefix.slice(pathPrefix.lastIndexOf("/") + 1).startsWith("img-") ||
          !pathSuffix.toLowerCase().endsWith(".png")
        ) {
          throw new Error(t("model.noteSkin.invalidManifest"));
        }
        const matches = [...files.keys()]
          .filter((candidate) => {
            const relative = candidate.startsWith(base) ? candidate.slice(base.length) : candidate;
            if (!relative.startsWith(pathPrefix) || !relative.endsWith(pathSuffix)) {
              return false;
            }
            const capture = relative.slice(pathPrefix.length, relative.length - pathSuffix.length);
            return /^\d+$/.test(capture) && !capture.includes("/");
          })
          .sort((left, right) => {
            const number = (path: string) =>
              Number(path.match(/img-(\d+)\.png$/)?.[1] ?? Number.MAX_SAFE_INTEGER);
            return number(left) - number(right);
          });
        if (!matches.length) {
          throw new Error(t("model.noteSkin.missingTexture", { file: base + value }));
        }
        for (const file of matches) {
          const relative = file.startsWith(base) ? file.slice(base.length) : file;
          const capture = relative.slice(pathPrefix.length, relative.length - pathSuffix.length);
          const expandedName = `${keyPrefix}${capture}${keySuffix}`;
          if (result[expandedName]) {
            throw new Error(t("model.noteSkin.duplicateTexture", { name: expandedName }));
          }
          result[expandedName] = file;
        }
        continue;
      }
      const file = base + value;
      if (!files.has(file)) {
        throw new Error(t("model.noteSkin.missingTexture", { file }));
      }
      result[name] = file;
    }
    if (key === "particles") {
      const frames = Object.keys(result)
        .map((name) => /^img-(\d+)$/.exec(name)?.[1])
        .filter((frame): frame is string => frame !== undefined)
        .map(Number)
        .sort((left, right) => left - right);
      if (frames.some((frame, index) => frame !== index + 1)) {
        throw new Error(t("model.noteSkin.invalidManifest"));
      }
    }
    return result;
  };
  linkedAssets.particles = readLinked("particles");
  linkedAssets.audio = readLinked("audio");
  let pixels = 0;
  const decodedFiles = new Set<string>();
  for (const name of NOTE_TEXTURES) {
    const entry = manifestTextures?.[name];
    if (entry === undefined) {
      continue;
    }
    if (
      !isRecord(entry) ||
      typeof entry.file !== "string" ||
      !entry.file ||
      entry.file.startsWith("/") ||
      /[\\:]/.test(entry.file) ||
      entry.file.includes("\0") ||
      entry.file.split("/").some((part) => part === ".." || part === ".")
    ) {
      throw new Error(t("model.noteSkin.invalidTexture", { name }));
    }
    const file = base + entry.file;
    const useful = entry.useful;
    const bytes = files.get(file);
    if (!bytes || bytes.length > SKIN_IMAGE_MAX_BYTES) {
      throw new Error(t("model.noteSkin.missingTexture", { file }));
    }
    const { width, height } = validatePngDimensions(bytes);
    if (!decodedFiles.has(file)) {
      decodedFiles.add(file);
      pixels += width * height;
      if (pixels > SKIN_MAX_PIXELS) {
        throw new Error(t("model.noteSkin.pixelBudget"));
      }
    }
    textures[name] = {
      file,
      useful:
        useful === undefined
          ? referenceUseful(name, width, height)
          : validateUseful(useful, width, height),
    };
  }
  for (const name of REQUIRED_TEXTURES) {
    if (!textures[name]) {
      throw new Error(t("model.noteSkin.missingRequired", { name }));
    }
  }
  if (isRecord(raw) && raw.judgeline !== undefined) {
    const section = raw.judgeline;
    const entry = isRecord(section) ? section.line : undefined;
    if (
      !isRecord(entry) ||
      typeof entry.file !== "string" ||
      !entry.file ||
      entry.file.startsWith("/") ||
      /[\\:]/.test(entry.file) ||
      entry.file.includes("\0") ||
      entry.file.split("/").some((part) => part === ".." || part === ".")
    ) {
      throw new Error(t("model.noteSkin.invalidTexture", { name: "judgeline.line" }));
    }
    const file = base + entry.file;
    const bytes = files.get(file);
    if (!bytes || bytes.length > SKIN_IMAGE_MAX_BYTES) {
      throw new Error(t("model.noteSkin.missingTexture", { file }));
    }
    const { width, height } = validatePngDimensions(bytes);
    if (!decodedFiles.has(file)) {
      pixels += width * height;
      if (pixels > SKIN_MAX_PIXELS) {
        throw new Error(t("model.noteSkin.pixelBudget"));
      }
    }
    judgeline = {
      line: {
        file,
        useful:
          entry.useful === undefined
            ? { x: 0, y: 0, width, height }
            : validateUseful(entry.useful, width, height),
      },
    };
  }
  for (const [name, file] of Object.entries(linkedAssets.particles ?? {})) {
    if (!/^img-\d+$/.test(name)) {
      continue;
    }
    const bytes = files.get(file);
    if (!bytes || bytes.length > SKIN_IMAGE_MAX_BYTES) {
      throw new Error(t("model.noteSkin.missingTexture", { file }));
    }
    if (!decodedFiles.has(file)) {
      const { width, height } = validatePngDimensions(bytes);
      pixels += width * height;
      if (pixels > SKIN_MAX_PIXELS) {
        throw new Error(t("model.noteSkin.pixelBudget"));
      }
      decodedFiles.add(file);
    }
  }
  const notes: Record<string, NoteTexture> = {};
  const events: Record<string, NoteTexture> = {};
  for (const [name, texture] of Object.entries(textures)) {
    if (name in SEMANTIC_TEXTURE_NAMES.events) {
      events[name] = texture;
    } else {
      notes[name] = texture;
    }
  }
  return {
    name: isRecord(raw) && isPackageName(raw.name) ? raw.name : fallbackName,
    notes,
    events,
    ...(judgeline ? { judgeline } : {}),
    ...(linkedAssets.particles ? { particles: linkedAssets.particles } : {}),
    ...(linkedAssets.audio ? { audio: linkedAssets.audio } : {}),
  };
}
