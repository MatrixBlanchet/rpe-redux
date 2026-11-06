/**
 * Resolves the product version the about surface shows.
 *
 * The packaged host is authoritative because the installer was built with its
 * version; browser and development builds fall back to the build-time constant.
 */
import { getVersion } from "@tauri-apps/api/app";
import { isDesktop } from "./environment.ts";

/**
 * The product version the about page shows.
 *
 * The packaged desktop host is authoritative, because `tauri.conf.json` carries
 * the version the installer was built with. The browser/dev build has no host to
 * ask, so it falls back to the version baked in from `package.json`.
 */
export async function appVersion(): Promise<string> {
  if (!isDesktop()) {
    return __REDUX_VERSION__;
  }
  try {
    const hostVersion = await getVersion();
    // A host that answers with nothing useful should not blank the version row.
    return typeof hostVersion === "string" && hostVersion.trim() ? hostVersion : __REDUX_VERSION__;
  } catch {
    return __REDUX_VERSION__;
  }
}
