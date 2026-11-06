/**
 * Pure rules for installing an Extension from a GitHub repository or a
 * marketplace catalog.
 *
 * URL parsing, catalog validation, and the structured failure vocabulary live
 * here so the installer, the settings surface, and the tests share one contract.
 * Nothing in this module reads the network, the DOM, or persistent storage.
 */
import { isRecord } from "../utils/guards.ts";
import type { TrustedExtensionManifest } from "./extensionContract.ts";

/** Where an install request failed before it could reach the runtime. */
export type ExtensionInstallPhase =
  "input" | "marketplace" | "resolve" | "download" | "validate" | "persist" | "load" | "enable";

/** Stable failure codes; the UI localizes each one and shows the raw detail. */
export type ExtensionInstallErrorCode =
  | "desktopOnly"
  | "invalidUrl"
  | "unsupportedSource"
  | "network"
  | "timeout"
  | "httpError"
  | "rateLimited"
  | "manifestMissing"
  | "manifestMultiple"
  | "manifestParse"
  | "manifestInvalid"
  | "packageFileMissing"
  | "packageFileTooLarge"
  | "packageFileInvalid"
  | "repoTooLarge"
  | "packageLimit"
  | "writeFailed"
  | "loadFailed"
  | "shadowed"
  | "enableFailed"
  | "removeFailed"
  | "safeMode"
  | "notInstalled"
  | "marketplaceInvalid"
  | "catalogTooLarge"
  | "marketplaceSchema"
  | "marketplaceEntry"
  | "unknown";

/** The facts shown in the install error panel and written to diagnostics. */
export interface ExtensionInstallErrorInfo {
  code: ExtensionInstallErrorCode;
  phase: ExtensionInstallPhase;
  message: string;
  detail?: string;
  hint?: string;
  source?: string;
  status?: number;
  cause?: string;
}

/** A failure that keeps its phase and stable code while crossing async boundaries. */
export class ExtensionInstallFailure extends Error {
  readonly code: ExtensionInstallErrorCode;
  readonly phase: ExtensionInstallPhase;
  readonly detail?: string;
  readonly hint?: string;
  readonly source?: string;
  readonly status?: number;
  readonly causeMessage?: string;

  constructor(info: ExtensionInstallErrorInfo) {
    super(info.message, info.cause === undefined ? undefined : { cause: info.cause });
    this.name = "ExtensionInstallFailure";
    this.code = info.code;
    this.phase = info.phase;
    this.detail = info.detail;
    this.hint = info.hint;
    this.source = info.source;
    this.status = info.status;
    this.causeMessage = info.cause;
  }
}

/** Whether a thrown value already carries an install failure contract. */
export function isExtensionInstallFailure(error: unknown): error is ExtensionInstallFailure {
  return error instanceof ExtensionInstallFailure;
}

/** Normalize any thrown value into the install failure vocabulary. */
export function asExtensionInstallFailure(
  error: unknown,
  fallback: Omit<ExtensionInstallErrorInfo, "message"> & { message?: string },
): ExtensionInstallFailure {
  if (isExtensionInstallFailure(error)) {
    return error;
  }
  return new ExtensionInstallFailure({
    ...fallback,
    message: fallback.message ?? errorMessage(error),
    cause: errorMessage(error),
  });
}

/** Readable text from any thrown value. */
function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** A GitHub repository, optionally pinned to a ref and a package subdirectory. */
export interface GitHubPackageSource {
  owner: string;
  repo: string;
  /** Branch, tag, or commit; null means the repository's default branch. */
  ref: string | null;
  /** Package directory inside the repository; null means the repository root. */
  path: string | null;
  /** Stable URL shown in the review and stored in diagnostics. */
  canonicalUrl: string;
  /** Short human-readable label. */
  label: string;
}

const OWNER_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/u;
const REPO_PATTERN = /^[A-Za-z0-9._-]{1,100}$/u;
const REF_PATTERN = /^[A-Za-z0-9._/-]{1,200}$/u;

/** Reject empty, absolute, traversal, and Windows-specific path segments. */
function safeRelativePath(value: string): boolean {
  if (!value || value.length > 512 || value.includes("\\") || value.includes("\0")) {
    return false;
  }
  if (value.startsWith("/") || /^[A-Za-z]:/u.test(value)) {
    return false;
  }
  return value.split("/").every((segment) => segment !== "" && segment !== "." && segment !== "..");
}

/** Whether a package-relative path stays inside its package and uses `/`. */
export function isSafePackageRelativePath(value: string): boolean {
  return safeRelativePath(value);
}

/** Strip a trailing `manifest.json` so the value names the package directory. */
function packageDirectory(path: string | null): string | null {
  if (!path) {
    return null;
  }
  const trimmed = path.replace(/\/+$/u, "");
  if (trimmed === "manifest.json") {
    return null;
  }
  const withoutManifest = trimmed.replace(/\/manifest\.json$/u, "");
  return withoutManifest || null;
}

/** A link to a package file names the directory that contains that file. */
function filePackageDirectory(path: string | null): string | null {
  if (!path) {
    return null;
  }
  const declaredManifest = packageDirectory(path);
  if (declaredManifest !== path) {
    return declaredManifest;
  }
  const slash = path.lastIndexOf("/");
  return slash > 0 ? path.slice(0, slash) : null;
}

function decodeSegments(pathname: string): string[] | null {
  try {
    return pathname
      .split("/")
      .filter(Boolean)
      .map((segment) => decodeURIComponent(segment));
  } catch {
    return null;
  }
}

function canonicalGitHubUrl(source: Omit<GitHubPackageSource, "canonicalUrl" | "label">): string {
  const base = `https://github.com/${source.owner}/${source.repo}`;
  if (source.ref === null && source.path === null) {
    return base;
  }
  const path = source.path
    ?.split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `${base}/tree/${encodeURIComponent(source.ref ?? "HEAD")}${path ? `/${path}` : ""}`;
}

function buildGitHubSource(
  owner: string,
  repo: string,
  ref: string | null,
  path: string | null,
): GitHubPackageSource {
  const normalizedRepo = repo.replace(/\.git$/iu, "");
  if (!OWNER_PATTERN.test(owner) || !REPO_PATTERN.test(normalizedRepo)) {
    throw new ExtensionInstallFailure({
      code: "invalidUrl",
      phase: "input",
      message: `GitHub owner or repository is invalid: ${owner}/${repo}`,
      detail: "Owner and repository names may use letters, digits, dots, underscores, and hyphens.",
    });
  }
  if (ref !== null && (!REF_PATTERN.test(ref) || ref.includes(".."))) {
    throw new ExtensionInstallFailure({
      code: "invalidUrl",
      phase: "input",
      message: `GitHub ref is invalid: ${ref}`,
      detail: "Use a branch, tag, or commit without empty or parent-directory segments.",
    });
  }
  if (path !== null && !safeRelativePath(path)) {
    throw new ExtensionInstallFailure({
      code: "invalidUrl",
      phase: "input",
      message: `GitHub package path is invalid: ${path}`,
      detail: "The path must stay inside the repository.",
    });
  }
  const source = {
    owner,
    repo: normalizedRepo,
    ref,
    path: packageDirectory(path),
  };
  return {
    ...source,
    canonicalUrl: canonicalGitHubUrl(source),
    label: `${owner}/${normalizedRepo}${source.path ? `/${source.path}` : ""}`,
  };
}

/**
 * Parse a GitHub link, raw link, or `owner/repo` shorthand.
 *
 * A `/tree/<ref>/<path>` link selects one package inside a repository. A bare
 * repository link lets the resolver find the one manifest, or report the
 * candidates when the repository carries several packages.
 */
export function parseGitHubSource(input: string): GitHubPackageSource {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new ExtensionInstallFailure({
      code: "invalidUrl",
      phase: "input",
      message: "Extension source is empty",
      hint: "Paste a GitHub repository URL or owner/repo.",
    });
  }
  const withScheme = /^[a-z][a-z0-9+.-]*:/iu.test(trimmed)
    ? trimmed
    : /^(?:www\.)?github\.com\//iu.test(trimmed) || /^raw\.githubusercontent\.com\//iu.test(trimmed)
      ? `https://${trimmed}`
      : `https://github.com/${trimmed.replace(/^\/+/u, "")}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch (cause) {
    throw new ExtensionInstallFailure({
      code: "invalidUrl",
      phase: "input",
      message: `Extension source is not a URL: ${trimmed}`,
      cause: errorMessage(cause),
    });
  }
  const host = url.hostname.toLowerCase();
  if (host !== "github.com" && host !== "www.github.com" && host !== "raw.githubusercontent.com") {
    throw new ExtensionInstallFailure({
      code: "unsupportedSource",
      phase: "input",
      message: `Unsupported Extension source host: ${url.hostname}`,
      hint: "Only GitHub repository and raw links are supported.",
      source: url.href,
    });
  }
  const segments = decodeSegments(url.pathname);
  if (!segments || segments.length < 2) {
    throw new ExtensionInstallFailure({
      code: "invalidUrl",
      phase: "input",
      message: `GitHub URL is missing an owner or repository: ${url.href}`,
      source: url.href,
    });
  }
  const owner = segments[0];
  const repo = segments[1];
  if (host === "raw.githubusercontent.com") {
    if (segments.length < 3) {
      throw new ExtensionInstallFailure({
        code: "invalidUrl",
        phase: "input",
        message: `Raw GitHub URL is missing a ref: ${url.href}`,
        source: url.href,
      });
    }
    const ref = segments[2];
    const path = segments.length > 3 ? segments.slice(3).join("/") : null;
    return buildGitHubSource(owner, repo, ref, filePackageDirectory(path));
  }
  if (segments.length === 2) {
    return buildGitHubSource(owner, repo, null, null);
  }
  const mode = segments[2];
  if (mode === "tree" || mode === "blob") {
    if (segments.length < 4) {
      throw new ExtensionInstallFailure({
        code: "invalidUrl",
        phase: "input",
        message: `GitHub ${mode} URL is missing a ref: ${url.href}`,
        source: url.href,
      });
    }
    // A generated canonical URL uses HEAD when the source has a path but no
    // explicit ref; parsing it back means the repository default branch.
    const ref = segments[3] === "HEAD" ? null : segments[3];
    const path = segments.length > 4 ? segments.slice(4).join("/") : null;
    return buildGitHubSource(owner, repo, ref, mode === "blob" ? filePackageDirectory(path) : path);
  }
  throw new ExtensionInstallFailure({
    code: "unsupportedSource",
    phase: "input",
    message: `Unsupported GitHub URL form: ${url.href}`,
    hint: "Use the repository root or a /tree/<ref>/<path> link.",
    source: url.href,
  });
}

/** One marketplace entry; the installer resolves its source like a pasted link. */
export interface MarketplaceEntry {
  id: string;
  name: string;
  author?: string;
  description: string;
  source: string;
  ref?: string;
  path?: string;
  homepage?: string;
  license?: string;
  version?: string;
  tags?: readonly string[];
}

/** The catalog document served by a marketplace URL. */
export interface MarketplaceCatalog {
  schemaVersion: 1;
  name: string;
  updatedAt?: string;
  extensions: readonly MarketplaceEntry[];
}

const MARKETPLACE_MAX_ENTRIES = 500;
const ENTRY_ID_PATTERN = /^[a-z][a-z0-9._-]{1,63}$/u;
const ENTRY_TAG_LIMIT = 12;
const ENTRY_TAG_LENGTH = 32;

function marketplaceFailure(detail: string, message: string): ExtensionInstallFailure {
  return new ExtensionInstallFailure({
    code: "marketplaceSchema",
    phase: "marketplace",
    message,
    detail,
  });
}

function readHttpUrl(value: unknown, field: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "string" || value.length > 400 || !/^https?:\/\/\S+$/iu.test(value)) {
    throw marketplaceFailure(field, `Marketplace ${field} must be an http(s) URL.`);
  }
  return value;
}

function readOptionalText(value: unknown, field: string, limit: number): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "string" || !value.trim() || value.length > limit) {
    throw marketplaceFailure(field, `Marketplace ${field} must be a non-empty string.`);
  }
  return value.trim();
}

function readMarketplaceEntry(value: unknown, index: number): MarketplaceEntry {
  const at = `extensions[${index}]`;
  if (!isRecord(value)) {
    throw marketplaceFailure(at, "Marketplace extension entry must be an object.");
  }
  const id = value.id;
  if (typeof id !== "string" || !ENTRY_ID_PATTERN.test(id)) {
    throw marketplaceFailure(`${at}.id`, "Marketplace extension id is invalid.");
  }
  const name = readOptionalText(value.name, `${at}.name`, 120);
  const description = readOptionalText(value.description, `${at}.description`, 2000);
  if (name === undefined || description === undefined) {
    throw marketplaceFailure(at, "Marketplace extension name and description are required.");
  }
  const rawSource = value.source ?? value.repository ?? value.repo;
  if (typeof rawSource !== "string" || !rawSource.trim()) {
    throw marketplaceFailure(`${at}.source`, "Marketplace extension source is required.");
  }
  let source: GitHubPackageSource;
  try {
    source = parseGitHubSource(rawSource);
  } catch (error) {
    const failure = asExtensionInstallFailure(error, {
      code: "marketplaceEntry",
      phase: "marketplace",
      source: rawSource,
    });
    throw new ExtensionInstallFailure({
      code: "marketplaceEntry",
      phase: "marketplace",
      message: `Marketplace entry ${id} has an invalid source: ${rawSource}`,
      detail: failure.message,
      source: rawSource,
      cause: failure.causeMessage,
    });
  }
  const ref = readOptionalText(value.ref, `${at}.ref`, 200) ?? source.ref ?? undefined;
  const path = readOptionalText(value.path, `${at}.path`, 512) ?? source.path ?? undefined;
  if (path !== undefined && !safeRelativePath(path)) {
    throw marketplaceFailure(`${at}.path`, "Marketplace extension path is invalid.");
  }
  if (ref !== undefined && (!REF_PATTERN.test(ref) || ref.includes(".."))) {
    throw marketplaceFailure(`${at}.ref`, "Marketplace extension ref is invalid.");
  }
  let tags: string[] | undefined;
  if (value.tags !== undefined) {
    if (
      !Array.isArray(value.tags) ||
      value.tags.length > ENTRY_TAG_LIMIT ||
      value.tags.some(
        (tag) => typeof tag !== "string" || !tag.trim() || tag.length > ENTRY_TAG_LENGTH,
      )
    ) {
      throw marketplaceFailure(`${at}.tags`, "Marketplace extension tags are invalid.");
    }
    tags = [...new Set(value.tags.map((tag) => tag.trim()))];
  }
  return {
    id,
    name,
    description,
    source: rawSource.trim(),
    ref,
    path,
    author: readOptionalText(value.author, `${at}.author`, 120),
    homepage: readHttpUrl(value.homepage, `${at}.homepage`),
    license: readOptionalText(value.license, `${at}.license`, 300),
    version: readOptionalText(value.version, `${at}.version`, 64),
    tags,
  };
}

/** Validate a parsed marketplace document and return the normalized catalog. */
export function validateMarketplaceCatalog(value: unknown): MarketplaceCatalog {
  if (!isRecord(value)) {
    throw marketplaceFailure("catalog", "Marketplace catalog must be a JSON object.");
  }
  if (value.schemaVersion !== 1) {
    throw marketplaceFailure("schemaVersion", "Marketplace schemaVersion must be 1.");
  }
  if (typeof value.name !== "string" || !value.name.trim() || value.name.length > 120) {
    throw marketplaceFailure("name", "Marketplace name must be a non-empty string.");
  }
  if (!Array.isArray(value.extensions)) {
    throw marketplaceFailure("extensions", "Marketplace extensions must be an array.");
  }
  if (value.extensions.length > MARKETPLACE_MAX_ENTRIES) {
    throw new ExtensionInstallFailure({
      code: "packageLimit",
      phase: "marketplace",
      message: `Marketplace has too many entries: ${value.extensions.length}`,
      detail: `At most ${MARKETPLACE_MAX_ENTRIES} entries are accepted.`,
    });
  }
  const seen = new Set<string>();
  const extensions = value.extensions.map((entry, index) => {
    const normalized = readMarketplaceEntry(entry, index);
    if (seen.has(normalized.id)) {
      throw marketplaceFailure(
        `extensions[${index}].id`,
        `Marketplace repeats extension id: ${normalized.id}`,
      );
    }
    seen.add(normalized.id);
    return normalized;
  });
  return {
    schemaVersion: 1,
    name: value.name.trim(),
    updatedAt: readOptionalText(value.updatedAt, "updatedAt", 64),
    extensions,
  };
}

/** Parse and validate marketplace JSON text. */
export function parseMarketplaceCatalog(text: string): MarketplaceCatalog {
  let value: unknown;
  try {
    value = JSON.parse(text) as unknown;
  } catch (cause) {
    throw new ExtensionInstallFailure({
      code: "marketplaceInvalid",
      phase: "marketplace",
      message: "Marketplace document is not valid JSON.",
      cause: errorMessage(cause),
      hint: "Check the URL and the catalog's JSON syntax.",
    });
  }
  return validateMarketplaceCatalog(value);
}

/** The GitHub request encoded by one marketplace entry. */
export function marketplaceSource(entry: MarketplaceEntry): GitHubPackageSource {
  const parsed = parseGitHubSource(entry.source);
  return buildGitHubSource(
    parsed.owner,
    parsed.repo,
    entry.ref ?? parsed.ref,
    entry.path === undefined ? parsed.path : entry.path,
  );
}

/** The `engines` declaration of a manifest, for the review surface. */
export function manifestEngineRequirement(manifest: TrustedExtensionManifest): string {
  const declared = isRecord(manifest.engines) ? manifest.engines["rpe-redux"] : undefined;
  return typeof declared === "number"
    ? String(declared)
    : typeof declared === "string"
      ? declared
      : "";
}
