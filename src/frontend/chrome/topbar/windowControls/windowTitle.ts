/**
 * Keeps the window and document titles on the translated application name.
 *
 * Language changes update both, and the desktop frame receives the same string the
 * WebView title carries.
 */
import { onLanguageChange, t } from "../../../../i18n/index.ts";
import { isDesktop } from "../../../../core/platform/environment.ts";
import { getCurrentWindow } from "@tauri-apps/api/window";

const APP_TITLE_KEY = "common.appName" as const;
let lastTitle = "";

/** The translated application name used for window and document titles. */
export function appTitle(): string {
  return t(APP_TITLE_KEY);
}

/** Set both the document title and the native window title, skipping duplicates. */
export function setAppWindowTitle(title: string): void {
  if (title === lastTitle) {
    return;
  }
  lastTitle = title;
  document.title = title;
  if (!isDesktop()) {
    return;
  }
  void getCurrentWindow()
    .setTitle(title)
    .catch(() => {});
}

/** The editor's title: `RPE Redux - composer - song (charter) [level]`. */
export function editorWindowTitle(metadata: {
  composer?: unknown;
  name?: unknown;
  charter?: unknown;
  level?: unknown;
}): string {
  const text = (value: unknown): string => (typeof value === "string" ? value.trim() : "");
  return [
    appTitle(),
    text(metadata.composer),
    text(metadata.name),
    `(${text(metadata.charter)})`,
    `[${text(metadata.level)}]`,
  ]
    .filter((part) => Boolean(part) && part !== "()" && part !== "[]")
    .join(" - ");
}

/** Install the translated document title for browser and startup surfaces. */
export function installDocumentTitle(): () => void {
  return onLanguageChange(() => {
    document.title = appTitle();
  });
}

/** Keep the native frame and document title on the same translated source. */
export function bindWindowTitle(nativeWindow: {
  setTitle(title: string): Promise<void>;
}): () => void {
  return onLanguageChange(() => {
    const title = appTitle();
    document.title = title;
    void nativeWindow.setTitle(title).catch(() => {});
  });
}
