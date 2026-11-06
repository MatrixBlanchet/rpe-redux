/**
 * Read-only GitHub Releases client for the in-app changelog.
 *
 * The desktop webview is allowed to reach `https://` by CSP, and GitHub's API
 * sends permissive CORS headers, so the changelog does not need a Rust HTTP
 * command. Release bodies are treated as plain text; no HTML is injected.
 */
import { normalizeVersion } from "../../utils/version.ts";

/** Failure category reported by the changelog client. */
export type GithubReleaseErrorCode =
  "invalid-repo" | "not-found" | "rate-limit" | "network" | "timeout" | "invalid-response";

/** A changelog request failure with a stable category for the UI. */
export class GithubReleaseError extends Error {
  readonly code: GithubReleaseErrorCode;

  /** Build an error carrying one public failure category. */
  constructor(code: GithubReleaseErrorCode, message: string) {
    super(message);
    this.name = "GithubReleaseError";
    this.code = code;
  }
}

/** One non-draft release, normalized for the changelog. */
export interface GithubRelease {
  tag: string;
  version: string;
  name: string;
  notes: string;
  publishedAt: string;
  prerelease: boolean;
  url: string;
}

interface ApiRelease {
  tag_name?: unknown;
  name?: unknown;
  body?: unknown;
  published_at?: unknown;
  prerelease?: unknown;
  draft?: unknown;
  html_url?: unknown;
}

/** Accept a string field, returning an empty string for any other value. */
const text = (value: unknown): string => (typeof value === "string" ? value : "");

/** Upper bound on one update request so the check cannot spin indefinitely. */
const REQUEST_TIMEOUT_MS = 15_000;

/** Normalize a GitHub URL or owner/repository pair and reject malformed names. */
function normalizeRepo(repo: string): string {
  const trimmed = repo
    .trim()
    .replace(/^https?:\/\/github\.com\//iu, "")
    .replace(/\/+$/u, "");
  const parts = trimmed.split("/").filter(Boolean);
  if (parts.length !== 2 || parts.some((part) => !/^[a-z0-9._-]+$/iu.test(part))) {
    throw new GithubReleaseError(
      "invalid-repo",
      "Repository must be a GitHub owner/repository pair.",
    );
  }
  return `${parts[0]}/${parts[1]}`;
}

/** Map one API payload to the changelog shape, skipping drafts and untagged entries. */
function mapRelease(value: unknown): GithubRelease | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const release = value as ApiRelease;
  if (release.draft === true) {
    return null;
  }
  const tag = text(release.tag_name);
  const version = normalizeVersion(tag);
  if (!tag || !version) {
    return null;
  }
  return {
    tag,
    version,
    name: text(release.name) || tag,
    notes: text(release.body),
    publishedAt: text(release.published_at),
    prerelease: release.prerelease === true,
    url: text(release.html_url),
  };
}

/**
 * Fetch the newest releases, newest first.
 *
 * The caller decides whether prereleases participate; this function keeps them
 * in the result so the changelog can label them.
 */
export async function fetchGithubReleases(
  repo: string,
  signal?: AbortSignal,
): Promise<GithubRelease[]> {
  const normalized = normalizeRepo(repo);
  const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  const requestSignal = signal ? AbortSignal.any([signal, timeout]) : timeout;
  let response: Response;
  try {
    response = await fetch(`https://api.github.com/repos/${normalized}/releases?per_page=30`, {
      headers: {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      signal: requestSignal,
    });
  } catch (error) {
    // A caller-owned abort stays an abort. The request timeout, and a connection
    // that collapses while waiting, become the explicit timeout code so the UI
    // can offer a retry.
    if (signal?.aborted) {
      throw error;
    }
    if (timeout.aborted || (error instanceof DOMException && error.name === "TimeoutError")) {
      throw new GithubReleaseError("timeout", "The update check timed out.");
    }
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }
    throw new GithubReleaseError("network", "Could not reach GitHub.");
  }
  if (response.status === 404) {
    throw new GithubReleaseError("not-found", "The repository has no releases.");
  }
  if (response.status === 403 || response.status === 429) {
    throw new GithubReleaseError("rate-limit", "GitHub rate limit reached. Try again later.");
  }
  if (!response.ok) {
    throw new GithubReleaseError("invalid-response", `GitHub returned ${response.status}.`);
  }
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new GithubReleaseError("invalid-response", "GitHub returned an invalid response.");
  }
  if (!Array.isArray(payload)) {
    throw new GithubReleaseError("invalid-response", "GitHub returned an invalid release list.");
  }
  return payload
    .map(mapRelease)
    .filter((release): release is GithubRelease => Boolean(release))
    .sort((left, right) => right.publishedAt.localeCompare(left.publishedAt));
}
