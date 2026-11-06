/**
 * Hosts registered Extension stage overlays above the authoring canvases.
 *
 * Each entry receives one stage-sized element through its imperative mount and
 * owns everything inside it. The host layer never intercepts pointer input by
 * itself; an overlay opts in on the children that need interaction.
 */
import { useEffect, useRef, useSyncExternalStore } from "react";
import { extensionOverlays, type ExtensionOverlayEntry } from "./extensionOverlays.ts";

/** Gives one overlay entry its stage-sized host element and disposes it on unmount. */
function ExtensionOverlayMount({ entry }: { entry: ExtensionOverlayEntry }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }
    const dispose = entry.mount(element, entry.signal);
    return () => dispose?.();
  }, [entry]);
  return (
    <div
      ref={ref}
      className="extension-overlay"
      data-extension-overlay={entry.id}
      data-redux-extension-scope={entry.owner}
    />
  );
}

/** Renders every enabled Extension overlay in registration order. */
export function ExtensionOverlays({ scope = "stage" }: { scope?: "stage" | "window" }) {
  const overlays = useSyncExternalStore(
    extensionOverlays.subscribe,
    extensionOverlays.get,
    extensionOverlays.get,
  );
  const visible = overlays.filter((entry) => entry.scope === scope);
  if (!visible.length) {
    return null;
  }
  return (
    <div className={scope === "window" ? "extension-window-overlays" : "extension-overlays"}>
      {visible.map((entry) => (
        <ExtensionOverlayMount key={entry.id} entry={entry} />
      ))}
    </div>
  );
}
