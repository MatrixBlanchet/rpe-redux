/**
 * The light/dark surface currently painted on the document.
 *
 * Startup sits outside the settings provider, and a discovered theme package can
 * repaint the document before the editor is ready. Reading the document's own
 * mode and listening for the theme event keeps two-ink artwork on the
 * higher-contrast variant without threading the stored theme id through the
 * boundary.
 */
import { useSyncExternalStore } from "react";
import type { ThemeMode } from "../../../core/platform/browser/themeSurface.ts";

/** Reads the document's current light or dark family. */
function readSurface(): ThemeMode {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

/** Re-reads the surface whenever the theme changes. */
function subscribe(listener: () => void): () => void {
  window.addEventListener("redux-theme", listener);
  return () => window.removeEventListener("redux-theme", listener);
}

/** Re-renders the caller when the document's light/dark family changes. */
export function useDocumentSurface(): ThemeMode {
  return useSyncExternalStore(subscribe, readSurface, () => "dark");
}
