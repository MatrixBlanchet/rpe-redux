/**
 * Texture culling math for the preview. Bounds are computed without browser or
 * canvas objects so the rules can be checked in isolation.
 */

import type { PreviewViewportBounds } from "../scene/viewport.ts";

/** Intrinsic image dimensions, present on decoded records and some bitmaps. */
export interface MeasuredImage {
  naturalWidth?: number;
  naturalHeight?: number;
}

/** The screen-space placement of a judge line's texture. */
export interface LineViewState {
  x: number;
  y: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
}

/** The anchor point a judge line uses for its texture. */
export interface AnchoredLine {
  anchor?: number[];
}

/** Cover-fits `image` into a `width`×`height` frame and returns its centered bounds. */
export function backgroundImageBounds(
  image: { naturalWidth: number; naturalHeight: number },
  width: number,
  height: number,
) {
  // The frame is the displayed rectangle after the authoring box has been
  // mapped onto it. Cover that rectangle so no margin shows inside the frame.
  const size = Math.max(width / image.naturalWidth, height / image.naturalHeight);
  const paintedWidth = image.naturalWidth * size;
  const paintedHeight = image.naturalHeight * size;
  return {
    x: (width - paintedWidth) / 2,
    y: (height - paintedHeight) / 2,
    width: paintedWidth,
    height: paintedHeight,
  };
}

/**
 * Whether a line texture's rotated bounds intersect the viewport.
 *
 * Missing intrinsic dimensions read as zero; callers only use the result when a
 * size is known.
 */
export function textureInViewport(
  texture: MeasuredImage,
  line: AnchoredLine,
  state: LineViewState,
  centerX: number,
  centerY: number,
  scale: number,
  scaleX: number,
  scaleY: number,
  viewport: PreviewViewportBounds,
): boolean {
  const anchor = line.anchor ?? [0.5, 0.5];
  // Callers only use the result when intrinsic dimensions exist; zero avoids
  // propagating NaN when the dimensions are missing.
  const textureWidth = texture.naturalWidth ?? 0;
  const textureHeight = texture.naturalHeight ?? 0;
  const left = -textureWidth * anchor[0] * scale * state.scaleX;
  const right = textureWidth * (1 - anchor[0]) * scale * state.scaleX;
  const top = -textureHeight * (1 - anchor[1]) * scale * state.scaleY;
  const bottom = textureHeight * anchor[1] * scale * state.scaleY;
  const angle = (state.rotation * Math.PI) / 180;
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  const horizontal = centerX + state.x * scaleX;
  const vertical = centerY - state.y * scaleY;
  const minimumX =
    horizontal + Math.min(left * cosine, right * cosine) + Math.min(-top * sine, -bottom * sine);
  const maximumX =
    horizontal + Math.max(left * cosine, right * cosine) + Math.max(-top * sine, -bottom * sine);
  const minimumY =
    vertical + Math.min(left * sine, right * sine) + Math.min(top * cosine, bottom * cosine);
  const maximumY =
    vertical + Math.max(left * sine, right * sine) + Math.max(top * cosine, bottom * cosine);
  return (
    maximumX >= viewport.left - 1 &&
    minimumX <= viewport.left + viewport.width + 1 &&
    maximumY >= viewport.top - 1 &&
    minimumY <= viewport.top + viewport.height + 1
  );
}
