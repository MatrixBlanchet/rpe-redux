/**
 * Rejected external-resource decisions for one native open.
 *
 * The native host reports references that stayed unloaded. This module groups
 * them into references the author may grant and paths that must stay rejected,
 * limits how many paths a prompt shows, and tracks the one automatic reopen per
 * document and editor session.
 */
import type { OpenResult } from "../../../../../../core/global/document/desktopTypes.ts";

/** Paths shown in one prompt before the remainder is summarised. */
export const MAX_VISIBLE_EXTERNAL_RESOURCES = 5;

/** Longest path rendered in a prompt; the middle is elided to keep file names visible. */
export const MAX_EXTERNAL_RESOURCE_PATH_LENGTH = 72;

/** One rejected-reference list split by what an author can do about it. */
export interface RejectedExternalResourceReview {
  /** Unique rejected names in host order. */
  readonly names: readonly string[];
  /** Absolute references the native host may grant for this document. */
  readonly authorizable: readonly string[];
  /** Relative escapes and malformed names that no grant can make readable. */
  readonly nonAuthorizable: readonly string[];
  /** Prefix of {@link names} that fits in the prompt. */
  readonly visible: readonly string[];
  /** Names omitted from {@link visible}. */
  readonly hiddenCount: number;
  /** Total number of unique rejected names. */
  readonly total: number;
}

/** Normalize separators so the same document path has one history key. */
function normalizedPath(path: string): string {
  return path.replace(/\\/g, "/").toLowerCase();
}

/** Whether a rejected name is an absolute path the native host can grant. */
export function isAuthorizableExternalResource(name: string): boolean {
  if (!name || name.includes("\0")) {
    return false;
  }
  const normalized = name.replace(/\\/g, "/");
  // The native resolver accepts absolute paths, slash-rooted paths, and UNC
  // paths, then grants the canonical target. Drive-relative and other
  // colon-bearing relative names are rejected before a target exists, and a
  // relative `..` segment is an escape that no grant may widen.
  return normalized.startsWith("/") || /^[a-zA-Z]:\//.test(normalized);
}

/**
 * Split rejected names into the two policies the prompt can explain.
 *
 * Duplicates are removed because the chart and its `extra.json` can name the
 * same reference; the visible prefix still follows the host's sorted order.
 */
export function reviewRejectedExternalResources(
  names: readonly string[],
  maxVisible = MAX_VISIBLE_EXTERNAL_RESOURCES,
): RejectedExternalResourceReview {
  const unique = [...new Set(names)];
  const authorizable: string[] = [];
  const nonAuthorizable: string[] = [];
  for (const name of unique) {
    if (isAuthorizableExternalResource(name)) {
      authorizable.push(name);
    } else {
      nonAuthorizable.push(name);
    }
  }
  const limit = Math.max(0, Math.floor(maxVisible));
  const visible = unique.slice(0, limit);
  return {
    names: unique,
    authorizable,
    nonAuthorizable,
    visible,
    hiddenCount: unique.length - visible.length,
    total: unique.length,
  };
}

/** Keep both the path prefix and the file name readable inside one prompt row. */
export function truncateExternalResourcePath(
  path: string,
  maxLength = MAX_EXTERNAL_RESOURCE_PATH_LENGTH,
): string {
  if (path.length <= maxLength) {
    return path;
  }
  if (maxLength <= 1) {
    return "…".slice(0, Math.max(0, maxLength));
  }
  const keep = maxLength - 1;
  const head = Math.ceil(keep / 2);
  const tail = Math.floor(keep / 2);
  return `${path.slice(0, head)}…${path.slice(path.length - tail)}`;
}

/** The documents that already received an automatic authorization reopen. */
export interface ExternalResourceAuthorizationHistory {
  /** Whether this document already offered and received an authorization. */
  hasAttempted(path: string): boolean;
  /** Remember that this document was authorized and reopened once. */
  markAttempted(path: string): void;
}

/** Create the per-editor-session authorization history. */
export function createExternalResourceAuthorizationHistory(): ExternalResourceAuthorizationHistory {
  const attempted = new Set<string>();
  return {
    hasAttempted: (path) => attempted.has(normalizedPath(path)),
    markAttempted: (path) => {
      attempted.add(normalizedPath(path));
    },
  };
}

/** User decisions and host work the settlement needs. */
export interface ExternalResourceSettlementPorts {
  /** Ask whether the document may load its absolute external references. */
  confirm(review: RejectedExternalResourceReview): Promise<boolean>;
  /** Explain references that stay unloaded and cannot be granted. */
  notifyUnavailable(review: RejectedExternalResourceReview): void;
  /** Reopen the same document with the grant recorded by the native host. */
  reopen(path: string): Promise<OpenResult>;
}

/**
 * Resolve one opened document's rejected references.
 *
 * A document with only escapable references is reported without offering a
 * grant. An authorizable list asks once per document and session; confirming
 * reopens the same path with the grant, and the reopened result is returned
 * even when relative escapes still remain. Cancelling keeps the first open and
 * performs no retry.
 */
export async function settleRejectedExternalResources(
  path: string,
  opened: OpenResult,
  history: ExternalResourceAuthorizationHistory,
  ports: ExternalResourceSettlementPorts,
): Promise<OpenResult> {
  const review = reviewRejectedExternalResources(
    opened.candidate.desktop?.rejected_external_resources ?? [],
  );
  if (review.total === 0) {
    return opened;
  }
  if (review.authorizable.length === 0) {
    ports.notifyUnavailable(review);
    return opened;
  }
  if (history.hasAttempted(path)) {
    return opened;
  }
  if (!(await ports.confirm(review))) {
    return opened;
  }
  history.markAttempted(path);
  const reopened = await ports.reopen(path);
  const remaining = reviewRejectedExternalResources(
    reopened.candidate.desktop?.rejected_external_resources ?? [],
  );
  if (remaining.total > 0 && remaining.authorizable.length === 0) {
    ports.notifyUnavailable(remaining);
  }
  return reopened;
}
