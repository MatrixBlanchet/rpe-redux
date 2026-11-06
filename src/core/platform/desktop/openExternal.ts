/**
 * Opens a trusted web link in the user's browser.
 *
 * Release notes and repository links are ordinary HTTPS URLs; the Tauri opener
 * plugin hands them to the host so the webview never navigates away from the
 * editor. The plugin covers Windows, macOS, Linux, Android, and iOS, and the
 * plain-browser branch keeps the web build usable. Every failure is raised to
 * the caller: a button that silently returns reads as an unresponsive button
 * when the browser never appears.
 */
import { openUrl } from "@tauri-apps/plugin-opener";
import { isDesktop } from "../environment.ts";

/** Whether the URL parses and uses HTTPS. */
function isWebUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    // The updater and changelog only publish HTTPS links. Refuse file:, custom
    // protocol handlers, and plain HTTP before handing the URL to the opener.
    return parsed.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Open a validated HTTPS URL in the system browser.
 *
 * Throws for non-HTTPS input, a blocked popup, or a failed opener so the caller
 * can show the failure.
 */
export async function openExternalUrl(url: string): Promise<void> {
  if (!url || !isWebUrl(url)) {
    throw new Error(`Refusing to open a URL that is not HTTPS: ${url || "(empty)"}`);
  }
  if (!isDesktop()) {
    // A blocked popup returns null. Without this check the click would appear
    // to have opened the survey while the webview discarded the new window.
    const opened = window.open(url, "_blank");
    if (!opened) {
      throw new Error("The browser blocked the new window.");
    }
    try {
      opened.opener = null;
    } catch {
      // The opened document is already cross-origin; it cannot reach back here.
    }
    return;
  }
  // Tauri mobile hosts also expose __TAURI_INTERNALS__; the opener plugin routes
  // to the system browser on Android and iOS, so this is not desktop-only.
  try {
    await openUrl(url);
  } catch (reason) {
    const detail = reason instanceof Error ? reason.message : String(reason);
    throw new Error(`The system opener failed: ${detail}`, { cause: reason });
  }
}
