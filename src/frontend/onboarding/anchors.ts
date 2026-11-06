/**
 * Anchor registry for the first-run walkthrough.
 *
 * The component that owns a control registers its node here, so the guide never
 * searches the document for shell markup. A callback ref keeps registration and
 * unmount in the same place as the element's lifetime.
 */
import { useSyncExternalStore, type RefCallback } from "react";

const anchors = new Map<string, HTMLElement>();
const refs = new Map<string, RefCallback<HTMLElement>>();
const listeners = new Set<() => void>();
let version = 0;

function changed(): void {
  version += 1;
  for (const listener of [...listeners]) {
    listener();
  }
}

/** Callback ref that registers one guide anchor by stable key. */
export function onboardingAnchorRef(key: string): RefCallback<HTMLElement> {
  let ref = refs.get(key);
  if (!ref) {
    ref = (node) => {
      if (node) {
        anchors.set(key, node);
      } else if (anchors.get(key)) {
        anchors.delete(key);
      }
      changed();
    };
    refs.set(key, ref);
  }
  return ref;
}

/** The live node for one anchor key, or null after unmount. */
export function getOnboardingAnchor(key: string): HTMLElement | null {
  const node = anchors.get(key);
  return node?.isConnected ? node : null;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Re-renders a coach card when a target mounts or unmounts. */
export function useOnboardingAnchorVersion(): number {
  return useSyncExternalStore(
    subscribe,
    () => version,
    () => version,
  );
}
