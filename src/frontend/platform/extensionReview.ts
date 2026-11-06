/**
 * Reviewable package contents kept outside the runtime snapshot.
 *
 * The settings surface needs file names, sizes, hashes, and source text before
 * the user acknowledges a package. This map is populated by the desktop loader
 * and cleared on unload; the runtime snapshot stays bounded and serializable.
 */
import type { ExtensionSource } from "../../core/extensions/extensionRuntime.ts";

/** One reviewed file of a package. */
export interface ExtensionReviewFile {
  readonly path: string;
  readonly bytes: number;
  readonly hash: string;
  readonly text: string;
}

/** Everything the settings surface needs to describe a package before consent. */
export interface ExtensionReview {
  readonly id: string;
  readonly source: ExtensionSource;
  readonly sourceLabel: string | null;
  readonly fingerprint: string | null;
  readonly files: readonly ExtensionReviewFile[];
}

const reviews = new Map<string, ExtensionReview>();

/** Store the bytes the user is being asked to trust. */
export function setExtensionReview(review: ExtensionReview): void {
  reviews.set(
    review.id,
    Object.freeze({
      ...review,
      files: Object.freeze([...review.files]),
    }),
  );
}

/** Returns the stored review for a package id, if one was recorded. */
export function getExtensionReview(id: string): ExtensionReview | undefined {
  return reviews.get(id);
}

/** Drops the stored review once its package is unloaded. */
export function clearExtensionReview(id: string): void {
  reviews.delete(id);
}

/** SHA-256 over UTF-8 text, in the same spelling the fingerprint display uses. */
export async function extensionFileHash(text: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
