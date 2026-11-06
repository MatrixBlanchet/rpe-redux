/**
 * The seam that hands the live desktop document store to whoever needs it.
 *
 * The editor binds it on mount; the export dialog and home library read the same
 * one, including while no editor runtime exists.
 */
import type { TauriDocumentStore } from "../../core/platform/desktop/documentStore.ts";

/**
 * The live desktop document store.
 *
 * The editor mounts it; the export dialog and the home library reach the same
 * one. It is its own module because those surfaces run outside the editor's
 * closure: the home screen is up before the editor mounts and stays up after it
 * is disposed.
 *
 * `null` is the answer before the editor has mounted; the web build never has a
 * store at all.
 */
let current: { store: TauriDocumentStore | null; token: object } | null = null;

/** Returns the mounted desktop document store, or null when none is bound. */
export function currentDocumentStore(): TauriDocumentStore | null {
  return current?.store ?? null;
}

/**
 * Binds the store for one editor runtime and returns an identity-safe disposer
 * that leaves a store installed by a newer runtime untouched.
 */
export function bindCurrentDocumentStore(next: TauriDocumentStore | null): () => void {
  const token = {};
  current = { store: next, token };
  let active = true;
  return () => {
    if (active && current?.token === token) {
      active = false;
      current = null;
    }
  };
}
