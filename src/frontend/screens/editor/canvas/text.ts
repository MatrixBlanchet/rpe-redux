/**
 * Canvas text roles.
 *
 * A 2D context cannot inherit CSS, so canvas surfaces resolve the same
 * `--type-*` roles declared in `src/design/styles/tokens.less` once and reuse
 * the result. The fallbacks repeat the documented token values and cover
 * workers and tests where no document exists.
 */
export type CanvasTypeRole = "micro" | "caption" | "label" | "body" | "heading" | "title";

/** Fallback sizes matching the design token defaults. */
const FALLBACK_PX: Record<CanvasTypeRole, number> = {
  micro: 11,
  caption: 13,
  label: 13,
  body: 14,
  heading: 16,
  title: 20,
};

/** Font stack shared by every canvas surface. */
export const CANVAS_FONT_FAMILY = "Saira, 'Source Han Sans CN', sans-serif";

let resolved: Record<CanvasTypeRole, number> | null = null;

/** Resolve each type role from the document once, falling back outside a DOM. */
function resolveSizes(): Record<CanvasTypeRole, number> {
  if (resolved) {
    return resolved;
  }
  if (typeof document === "undefined") {
    resolved = FALLBACK_PX;
    return resolved;
  }
  const style = getComputedStyle(document.documentElement);
  const read = (role: CanvasTypeRole): number => {
    const value = Number.parseFloat(style.getPropertyValue(`--type-${role}`));
    return Number.isFinite(value) ? value : FALLBACK_PX[role];
  };
  resolved = {
    micro: read("micro"),
    caption: read("caption"),
    label: read("label"),
    body: read("body"),
    heading: read("heading"),
    title: read("title"),
  };
  return resolved;
}

/** Pixel size for a typography role, in CSS pixels. */
export function canvasTypePx(role: CanvasTypeRole): number {
  return resolveSizes()[role];
}

/** `context.font` value for a typography role. */
export function canvasFont(role: CanvasTypeRole): string {
  return `${canvasTypePx(role)}px ${CANVAS_FONT_FAMILY}`;
}
