/**
 * Opens the host file picker for imperative callers.
 *
 * The desktop host uses its native dialog so every picker can resume in the last
 * used directory; the browser keeps the hidden-input path because it cannot
 * choose an initial folder. A dismissal resolves `null` so a cancelled pick
 * stays distinct from an empty one.
 */
import { invoke } from "@tauri-apps/api/core";
import { mediaType } from "../../core/media/mime.ts";
import { isDesktop } from "../../core/platform/environment.ts";
import {
  dialogDefaultPath,
  rememberDialogFiles,
  type DialogKind,
} from "../../core/platform/desktop/dialogPath.ts";
import { toBlobPart } from "../../core/utils/bytes.ts";
import { t } from "../../i18n/index.ts";

/** Accept filter and multi-select flag for one picker call. */
interface PickFilesOptions {
  accept?: string;
  multiple?: boolean;
}

const MEDIA_EXTENSIONS: Record<string, readonly string[]> = {
  "image/*": ["png", "jpg", "jpeg", "webp", "gif", "bmp", "avif"],
  "audio/*": ["mp3", "ogg", "wav", "flac", "m4a", "aac", "opus", "webm"],
};

/** Maps a picker accept filter to the remembered dialog folder kind. */
function dialogKindForAccept(accept: string | undefined): DialogKind {
  const token = accept?.toLowerCase() ?? "";
  if (token.includes("image/*") && !token.includes("audio/*")) {
    return "image";
  }
  if (token.includes("audio/*") && !token.includes("image/*")) {
    return "audio";
  }
  if (token.includes(".json") || token.includes("application/json")) {
    return "theme";
  }
  return "media";
}

/** Expands an accept filter into the extension list the native dialog expects. */
function extensionsForAccept(accept: string | undefined): string[] {
  if (!accept) {
    return [];
  }
  const extensions = new Set<string>();
  for (const raw of accept.split(",")) {
    const token = raw.trim().toLowerCase();
    if (!token) {
      continue;
    }
    const media = MEDIA_EXTENSIONS[token];
    if (media) {
      for (const extension of media) {
        extensions.add(extension);
      }
      continue;
    }
    if (token.startsWith(".")) {
      extensions.add(token.slice(1));
      continue;
    }
    if (token === "application/json") {
      extensions.add("json");
    }
  }
  return [...extensions];
}

/** Reads one picked path as a typed File; null when the host cannot read it. */
async function fileFromPath(path: string): Promise<File | null> {
  try {
    const response = await invoke<ArrayBuffer | number[]>("read_picked_file", { path });
    const bytes =
      response instanceof ArrayBuffer ? new Uint8Array(response) : Uint8Array.from(response);
    const name = path.replaceAll("\\", "/").split("/").at(-1) || "file";
    return new File([toBlobPart(bytes)], name, { type: mediaType(name) });
  } catch {
    return null;
  }
}

/** Opens the native dialog, remembers the folder, and reads the selected files. */
async function pickWithNativeDialog(options: PickFilesOptions): Promise<File[] | null> {
  const { open } = await import("@tauri-apps/plugin-dialog");
  const kind = dialogKindForAccept(options.accept);
  const extensions = extensionsForAccept(options.accept);
  const selected = await open({
    multiple: Boolean(options.multiple),
    directory: false,
    defaultPath: dialogDefaultPath(kind),
    ...(extensions.length ? { filters: [{ name: t("system.files.fileFilter"), extensions }] } : {}),
  });
  const paths = Array.isArray(selected) ? selected : selected ? [selected] : [];
  if (!paths.length) {
    return null;
  }
  rememberDialogFiles(kind, paths);
  const files = (await Promise.all(paths.map(fileFromPath))).filter(
    (file): file is File => file !== null,
  );
  return files.length ? files : null;
}

/** Opens the hidden-input picker used when no native dialog is available. */
function pickWithInput(options: PickFilesOptions): Promise<File[] | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.hidden = true;
    if (options.accept) {
      input.accept = options.accept;
    }
    input.multiple = Boolean(options.multiple);

    let settled = false;
    /** Resolves once with the picked files or null, then removes the input. */
    const finish = (files: File[] | null) => {
      if (settled) {
        return;
      }
      settled = true;
      input.remove();
      resolve(files);
    };
    /** Reads the current input selection as a non-empty file list. */
    const selected = (): File[] | null => {
      const files = Array.from(input.files ?? []);
      return files.length ? files : null;
    };
    // Both outcomes arrive on the input; window focus is not a result and can
    // return while the native picker is still open.
    input.addEventListener("change", (event) => {
      event.stopPropagation();
      finish(selected());
    });
    input.addEventListener("cancel", (event) => {
      event.stopPropagation();
      finish(null);
    });
    document.body.append(input);
    input.click();
  });
}

/** Opens the platform file picker and resolves with the chosen files. */
export function pickFiles(options: PickFilesOptions = {}): Promise<File[] | null> {
  return isDesktop() ? pickWithNativeDialog(options) : pickWithInput(options);
}
