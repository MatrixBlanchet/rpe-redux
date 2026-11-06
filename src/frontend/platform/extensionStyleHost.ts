/**
 * Installs the style sink sandboxed Extensions write their CSS into.
 *
 * A package styles its own panel and overlay surfaces, never the host chrome.
 * The sheet is wrapped in `@scope` against the owner attribute the host puts on
 * those mounts, so a selector such as `.titlebar` cannot reach the application
 * frame. Constructable style sheets keep the rule out of the document's inline
 * style path; a style element is the fallback for older hosts.
 */
import { extensionRuntime } from "../../core/extensions/extensionRuntime.ts";
import { scopedExtensionCss } from "./extensionStyleScope.ts";

/** True when the host can install a constructable, removable style sheet. */
function canAdoptStyles(): boolean {
  return (
    typeof CSSStyleSheet === "function" &&
    "replaceSync" in CSSStyleSheet.prototype &&
    "adoptedStyleSheets" in Document.prototype
  );
}

/**
 * Installs one validated, owner-scoped sheet.
 *
 * Nothing is attached until the transform and the chosen host sink both accept
 * the sheet, so a rejected sheet leaves no partial style behind.
 */
function installSheet(cssText: string, owner: string): () => void {
  const scoped = scopedExtensionCss(owner, cssText);
  if (canAdoptStyles()) {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(scoped);
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
    return () => {
      document.adoptedStyleSheets = document.adoptedStyleSheets.filter(
        (candidate) => candidate !== sheet,
      );
    };
  }
  const style = document.createElement("style");
  style.dataset.reduxExtension = owner;
  style.dataset.reduxExtensionScope = owner;
  style.textContent = scoped;
  document.head.append(style);
  return () => style.remove();
}

/** Installs the DOM-owned, owner-scoped style sink used by sandboxed Extensions. */
export function installExtensionStyleHost(): () => void {
  extensionRuntime.setStyleHost({
    add(cssText, owner) {
      try {
        return installSheet(cssText, owner);
      } catch (error) {
        // Drop the whole sheet and report through the bridge/runtime failure path.
        console.error("[redux.extensions] style sheet rejected", { owner, error });
        throw error;
      }
    },
  });
  return () => extensionRuntime.setStyleHost(null);
}
