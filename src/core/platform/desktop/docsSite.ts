/**
 * Opens the loopback documentation site in the user's browser.
 *
 * The docs site is served by the local Go service, so its URL is plain HTTP on
 * 127.0.0.1 while every external link stays HTTPS-only. This seam therefore
 * validates the exact loopback origin and `/docs` path prefix before handing the
 * URL to the Tauri opener; it never reuses or relaxes `openExternalUrl`.
 */
import { openUrl } from "@tauri-apps/plugin-opener";
import { DEFAULT_SERVER_ORIGIN } from "../../global/library/client.ts";
import { isDesktop } from "../environment.ts";

/** Path prefix the local service reserves for the documentation site. */
const DOCS_PATH = "/docs";

/** Parsed default origin whose port the docs URL must match. */
const SERVER_ORIGIN = new URL(DEFAULT_SERVER_ORIGIN);

/** Opens one already-validated URL in the host browser. */
export type DocsOpener = (url: string) => Promise<void>;

/** The real opener; tests replace it through `setDocsOpenerForTests`. */
const pluginOpener: DocsOpener = async (url) => {
  await openUrl(url);
};

let docsOpener: DocsOpener = pluginOpener;

/**
 * Replace the opener used by `openDocsSite`; pass `null` to restore the plugin.
 *
 * The seam keeps Node tests away from Tauri while production always uses the
 * system opener.
 */
export function setDocsOpenerForTests(opener: DocsOpener | null): void {
  docsOpener = opener ?? pluginOpener;
}

/** The local documentation URL derived from the service's default origin. */
export function docsSiteUrl(): string {
  return `${DEFAULT_SERVER_ORIGIN}${DOCS_PATH}/`;
}

/**
 * Whether `value` is exactly the loopback docs origin under the `/docs` prefix.
 *
 * Accepts only HTTP on `127.0.0.1`, the configured service port, and a pathname
 * of `/docs` or below. Credentials, other hosts (`localhost` included), other
 * ports, and non-document paths are rejected.
 */
export function isAllowedDocsUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return (
      parsed.protocol === "http:" &&
      parsed.hostname === "127.0.0.1" &&
      parsed.port === SERVER_ORIGIN.port &&
      parsed.username === "" &&
      parsed.password === "" &&
      (parsed.pathname === DOCS_PATH || parsed.pathname.startsWith(`${DOCS_PATH}/`))
    );
  } catch {
    return false;
  }
}

/**
 * Open the local documentation site in the system browser.
 *
 * Throws for a URL outside the allowlist, a blocked popup, or a failed opener so
 * the settings row can surface the failure instead of appearing unresponsive.
 */
export async function openDocsSite(): Promise<void> {
  const url = docsSiteUrl();
  if (!isAllowedDocsUrl(url)) {
    throw new Error(`Refusing to open a URL outside the local docs site: ${url}`);
  }
  if (!isDesktop()) {
    // A blocked popup returns null; without this check the click would appear to
    // have opened the docs while the webview discarded the new window.
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
  try {
    await docsOpener(url);
  } catch (reason) {
    const detail = reason instanceof Error ? reason.message : String(reason);
    throw new Error(`The system opener failed: ${detail}`, { cause: reason });
  }
}
