/**
 * Draws the preview background image, caching a static fitted-frame surface so
 * camera pans and zooms reuse one bitmap. Animated backgrounds bypass the cache.
 */
import { canvasPixelRatio } from "../../../canvas/canvas2d.ts";
import { backgroundImageBounds } from "../drawing/textureVisibility.ts";
import type { PreviewViewportBounds } from "../scene/viewport.ts";

/** The image fields the background drawing needs. */
export interface TextureImage {
  naturalWidth: number;
  naturalHeight: number;
  source?: CanvasImageSource;
}

/**
 * Identity of the static background surface.
 *
 * Camera translation and zoom are deliberately absent: the cached surface is
 * painted for the fitted frame and then drawn through the camera transform.
 */
export function backgroundCacheKey(
  image: Pick<TextureImage, "naturalWidth" | "naturalHeight">,
  width: number,
  height: number,
  ratio: number,
  blur: number,
  brightness: number,
): string {
  return `${image.naturalWidth}:${image.naturalHeight}:${width}:${height}:${ratio}:${blur}:${brightness}`;
}

/** Owns the cached background surface and its draw-time invalidation key. */
export class PreviewBackground {
  // No initializer: fields stay undefined until cached; `clear()` sets them to null.
  canvas?: HTMLCanvasElement | null;
  image?: TextureImage | null;
  key?: string | null;

  /**
   * Draw a background image that covers the chart frame `width`×`height` at
   * (`left`, `top`).
   *
   * `clip` is the visible preview rectangle. The static cache represents that
   * fitted rectangle at the capped device ratio; the free camera then scales and
   * translates the finished bitmap instead of rebuilding the blur every frame.
   */
  draw(
    context: CanvasRenderingContext2D,
    image: TextureImage,
    width: number,
    height: number,
    blur: number,
    brightness: number,
    ratio: number,
    animated = false,
    left = 0,
    top = 0,
    clip?: PreviewViewportBounds,
  ): void {
    const visible = clip ?? { left, top, width, height };
    /** Paints the image into a target context for a `frameWidth`×`frameHeight` frame. */
    const paint = (
      target: CanvasRenderingContext2D,
      frameWidth: number,
      frameHeight: number,
      offsetX: number,
      offsetY: number,
    ): void => {
      const bounds = backgroundImageBounds(image, frameWidth, frameHeight);
      const filters = [
        brightness === 1 ? "" : `brightness(${brightness})`,
        blur > 0 ? `blur(${blur}px)` : "",
      ].filter(Boolean);
      target.filter = filters.join(" ") || "none";
      target.drawImage(
        // Without a `source` bitmap, the texture object itself is drawable.
        image.source ?? (image as CanvasImageSource),
        bounds.x + offsetX,
        bounds.y + offsetY,
        bounds.width,
        bounds.height,
      );
      target.filter = "none";
    };
    if (animated || typeof document === "undefined") {
      paint(context, width, height, left, top);
      return;
    }
    if (visible.width <= 0 || visible.height <= 0) {
      return;
    }
    const cacheRatio = canvasPixelRatio(ratio);
    const key = backgroundCacheKey(
      image,
      visible.width,
      visible.height,
      cacheRatio,
      blur,
      brightness,
    );
    let canvas = this.canvas ?? null;
    if (this.image !== image || this.key !== key) {
      canvas ??= document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(visible.width * cacheRatio));
      canvas.height = Math.max(1, Math.round(visible.height * cacheRatio));
      const target = canvas.getContext("2d");
      if (!target) {
        return;
      }
      target.setTransform(cacheRatio, 0, 0, cacheRatio, 0, 0);
      paint(target, visible.width, visible.height, 0, 0);
      this.canvas = canvas;
      this.image = image;
      this.key = key;
    }
    if (!canvas) {
      return;
    }
    // The chart frame scales uniformly with the camera, so one bitmap serves
    // every pan and zoom; the browser only samples it into the new rectangle.
    context.drawImage(canvas, 0, 0, canvas.width, canvas.height, left, top, width, height);
  }

  /** Drops the cached surface; the next draw rebuilds it. */
  clear(): void {
    this.image = null;
    this.canvas = null;
    this.key = null;
  }
}
