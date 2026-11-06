/** Reads and validates a selection without changing an editor document. */
import { t } from "../../../../i18n/index.ts";
import { mediaType } from "../../../../core/media/mime.ts";
import { toBlobPart } from "../../../../core/utils/bytes.ts";
import type { MediaKind } from "./MediaFields.tsx";

/** A validated media file ready to store in the asset library. */
export interface PreparedMedia {
  name: string;
  bytes: Uint8Array;
  type: string;
}

/**
 * Validate a picked file's extension, size, and decodability, then return its
 * bytes and MIME type. Throws a localized error when the file is unusable.
 */
export async function prepareMediaFile(file: File, kind: MediaKind): Promise<PreparedMedia> {
  const pattern =
    kind === "song"
      ? /\.(mp3|ogg|wav|flac|m4a|aac|opus|webm)$/i
      : /\.(png|jpe?g|webp|gif|bmp|avif)$/i;
  if (!pattern.test(file.name) || !file.size) {
    throw new Error(
      t(
        kind === "song"
          ? "editorPanels.metadata.invalidAudio"
          : "editorPanels.metadata.invalidCover",
      ),
    );
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = mediaType(file.name);
  const url = URL.createObjectURL(new Blob([toBlobPart(bytes)], { type }));
  try {
    if (kind === "background") {
      const image = new Image();
      image.src = url;
      await image.decode();
      if (!image.naturalWidth || !image.naturalHeight) {
        throw new Error(t("editorPanels.metadata.invalidCover"));
      }
    } else {
      const audio = new Audio();
      audio.preload = "metadata";
      try {
        await new Promise<void>((resolve, reject) => {
          /** Settle the metadata probe once, rejecting on timeout or decode error. */
          const finish = (failed = false) => {
            clearTimeout(timer);
            audio.onloadedmetadata = null;
            audio.onerror = null;
            if (failed || !Number.isFinite(audio.duration) || audio.duration <= 0) {
              reject(new Error(t("editorPanels.metadata.invalidAudio")));
            } else {
              resolve();
            }
          };
          const timer = setTimeout(() => finish(true), 15000);
          audio.onloadedmetadata = () => finish();
          audio.onerror = () => finish(true);
          audio.src = url;
        });
      } finally {
        audio.removeAttribute("src");
        audio.load();
      }
    }
  } catch {
    throw new Error(
      t(
        kind === "song"
          ? "editorPanels.metadata.invalidAudio"
          : "editorPanels.metadata.invalidCover",
      ),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
  return { name: file.name, bytes, type };
}

/**
 * The root-level resource name for a metadata media pick.
 *
 * Metadata media belongs to the asset library's Default group, never to a
 * synthetic folder. A name already in use gets a numeric suffix so the new
 * resource does not replace the bytes an older entry references.
 */
export function mediaResourceName(file: PreparedMedia, taken: Iterable<string> = []): string {
  const name = file.name.replaceAll("\\", "/").split("/").at(-1) || "media";
  const used = new Set(taken);
  if (!used.has(name)) {
    return name;
  }
  const dot = name.lastIndexOf(".");
  const stem = dot < 0 ? name : name.slice(0, dot);
  const extension = dot < 0 ? "" : name.slice(dot);
  let index = 2;
  while (used.has(`${stem}-${index}${extension}`)) {
    index += 1;
  }
  return `${stem}-${index}${extension}`;
}
