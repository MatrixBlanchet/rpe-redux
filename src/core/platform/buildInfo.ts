/**
 * The product version, baked in from `package.json` at build time.
 *
 * `vite.config.ts` defines `__REDUX_VERSION__` for the bundled build. A Node
 * smoke run has no bundle, so the identifier is absent there; `typeof` on an
 * undeclared global is safe and keeps the module importable outside Vite.
 */
export const BUILD_APP_VERSION: string =
  typeof __REDUX_VERSION__ === "string" ? __REDUX_VERSION__ : "0.0.0";

/**
 * Reads the major component of an application version.
 *
 * Extension manifests may declare a host major, and the one-shot cell host writes
 * that shape. Full version ranges use the semver helpers in
 * `core/utils/version.ts`. A version that is not a semantic version with an
 * optional prerelease/build suffix is a host configuration error and must fail
 * loudly rather than defaulting to a guess.
 */
export function appMajorVersion(version: string): number {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.exec(version);
  if (!match) {
    throw new Error(`Application version is not a semantic version: ${version}`);
  }
  return Number(match[1]);
}
