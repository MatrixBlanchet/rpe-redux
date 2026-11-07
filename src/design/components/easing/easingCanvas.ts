/**
 * Shared responsive canvas sizing for the easing previews.
 *
 * Both previews draw in the same 260x100 logical space. Keeping the backing
 * store and transform in one place prevents a wide inspector from stretching
 * one curve differently from the other and keeps high-DPI output crisp.
 */
export const EASING_CANVAS_WIDTH = 260;
export const EASING_CANVAS_HEIGHT = 100;

export interface EasingCanvasMetrics {
  pixelWidth: number;
  pixelHeight: number;
  scaleX: number;
  scaleY: number;
}

/** Calculate backing-store dimensions and logical drawing scales. */
export function easingCanvasMetrics(
  cssWidth: number,
  cssHeight: number,
  devicePixelRatio = globalThis.devicePixelRatio || 1,
): EasingCanvasMetrics {
  const width = Math.max(1, cssWidth || EASING_CANVAS_WIDTH);
  const height = Math.max(1, cssHeight || EASING_CANVAS_HEIGHT);
  const pixelScale = Math.min(2, Math.max(1, devicePixelRatio));
  const pixelWidth = Math.max(2, Math.round(width * pixelScale));
  const pixelHeight = Math.max(2, Math.round(height * pixelScale));
  return {
    pixelWidth,
    pixelHeight,
    scaleX: pixelWidth / EASING_CANVAS_WIDTH,
    scaleY: pixelHeight / EASING_CANVAS_HEIGHT,
  };
}

/** Resize one preview canvas to its CSS box and return its logical scales. */
export function resizeEasingCanvas(
  canvas: HTMLCanvasElement,
  cssWidth: number,
  cssHeight: number,
): EasingCanvasMetrics {
  const metrics = easingCanvasMetrics(cssWidth, cssHeight);
  if (canvas.width !== metrics.pixelWidth || canvas.height !== metrics.pixelHeight) {
    canvas.width = metrics.pixelWidth;
    canvas.height = metrics.pixelHeight;
  }
  return metrics;
}
