/**
 * Reads sanitized layout anchors for the public `redux.layout` facade.
 *
 * The adapter is intentionally the only place that touches host DOM. It exposes
 * named regions plus visible form controls as rectangles and labels; values,
 * text content of inputs, and element handles never leave the host.
 */
import type { LayoutAnchor, LayoutRect } from "../../../../../../core/edit/layout/api.ts";

const REGIONS: readonly { id: string; label: string; selector: string }[] = [
  { id: "workspace", label: "Workspace", selector: "#stage" },
  { id: "toolbar", label: "Toolbar", selector: ".redux-toolbar" },
  { id: "inspector", label: "Inspector", selector: ".inspector" },
  { id: "sidebar", label: "Sidebar", selector: ".sidebar" },
];

/** Returns the visible rectangle, or null when the element has no layout box. */
function readRect(element: Element): LayoutRect | null {
  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0 || element.getClientRects().length === 0) {
    return null;
  }
  return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
}

/** Best available label for a form control: ARIA, wrapping label, placeholder, then id. */
function controlLabel(element: Element, index: number): string {
  const aria = element.getAttribute("aria-label")?.trim();
  if (aria) {
    return aria;
  }
  const labelled = element.closest("label")?.textContent?.trim();
  if (labelled) {
    return labelled;
  }
  const placeholder = element.getAttribute("placeholder")?.trim();
  if (placeholder) {
    return placeholder;
  }
  return element.id || element.getAttribute("name") || `control ${index + 1}`;
}

/** Creates the host behind `redux.layout` for the mounted shell. */
export function createLayoutApiHost() {
  return {
    anchors(): readonly LayoutAnchor[] {
      const root = document.body.querySelector<HTMLElement>(":scope > .redux-app-root");
      if (!root) {
        return [];
      }
      const anchors: LayoutAnchor[] = [];
      for (const region of REGIONS) {
        const element = root.querySelector(region.selector);
        const client = element ? readRect(element) : null;
        if (client) {
          anchors.push({ id: region.id, kind: "region", label: region.label, client });
        }
      }
      const controls = root.querySelectorAll<HTMLElement>(
        "input:not([type='hidden']):not([type='file']), select, textarea",
      );
      controls.forEach((element, index) => {
        const client = readRect(element);
        if (!client) {
          return;
        }
        anchors.push({
          id: element.id || element.getAttribute("name") || `control:${index}`,
          kind: "control",
          label: controlLabel(element, index),
          client,
        });
      });
      return anchors;
    },
  };
}
