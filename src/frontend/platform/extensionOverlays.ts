/**
 * Registry for Extension-owned stage overlays.
 *
 * Extensions receive a host-owned element that fills the editor stage and may
 * mount any DOM they own. The registry only stores entries and their lifecycle;
 * the React surface in `ExtensionOverlays.tsx` performs the actual mounting.
 */
import type {
  ExtensionElementMount,
  ExtensionOverlayDefinition,
  ExtensionUiRequest,
} from "../../core/extensions/extensionUi.ts";
import { createValue } from "../../core/state/values.ts";

/** One registered overlay with its scope, mount callback, and owner signal. */
export interface ExtensionOverlayEntry {
  readonly id: string;
  /** Manifest id that owns this overlay; also the CSS scope key. */
  readonly owner: string;
  readonly order: number;
  readonly scope: "stage" | "window";
  readonly mount: ExtensionElementMount;
  readonly signal: AbortSignal;
}

const entries = createValue<readonly ExtensionOverlayEntry[]>({ initial: [] });

/** Prefixes a local overlay id with its owning Extension. */
function scopedId(owner: string, localId: string): string {
  if (!localId.trim()) {
    throw new Error("Extension overlay id must be nonempty");
  }
  return `extension:${owner}:${localId}`;
}

/** Adds one overlay entry; the returned disposer removes it idempotently. */
export function registerExtensionOverlay(
  request: ExtensionUiRequest,
  definition: ExtensionOverlayDefinition,
): () => void {
  if (request.signal.aborted) {
    throw new Error(`Extension is already disposed: ${request.source.id}`);
  }
  if (typeof definition.mount !== "function") {
    throw new Error(`Extension overlay must provide a mount function: ${definition.id}`);
  }
  const id = scopedId(request.source.id, definition.id);
  if (entries.get().some((entry) => entry.id === id)) {
    throw new Error(`Extension overlay id is already registered: ${id}`);
  }
  const entry: ExtensionOverlayEntry = Object.freeze({
    id,
    owner: request.source.id,
    order: definition.order ?? 1000,
    scope: definition.scope === "window" ? "window" : "stage",
    mount: definition.mount,
    signal: request.signal,
  });
  const next = [...entries.get(), entry].sort(
    (left, right) => left.order - right.order || left.id.localeCompare(right.id),
  );
  entries.set(next);
  return () => {
    if (!entries.get().includes(entry)) {
      return;
    }
    entries.set(entries.get().filter((candidate) => candidate !== entry));
  };
}

export const extensionOverlays = Object.freeze({
  subscribe: entries.subscribe,
  get: entries.get,
});
