/**
 * The chart-content camera used by the free-camera stage mode. It maps the
 * background, notes, holds, judge lines, guides, hit effects, and the chart
 * frame through a pan/zoom view while the painted preview clip stays fixed.
 */
import type { PreviewViewport, PreviewViewportBounds } from "./viewport.ts";

/** Chart-content camera: pan in screen pixels and a positive zoom factor. */
export interface PreviewCamera {
  active: boolean;
  zoom: number;
  panX: number;
  panY: number;
}

/** A camera that leaves the fitted view untouched. */
export const DEFAULT_PREVIEW_CAMERA: PreviewCamera = {
  active: false,
  zoom: 1,
  panX: 0,
  panY: 0,
};

/** The chart-content mapping of one painted viewport. */
export interface PreviewCameraFrame {
  scale: number;
  scaleX: number;
  scaleY: number;
  centerX: number;
  centerY: number;
}

/**
 * Map the fitted viewport's chart content through the camera.
 *
 * `panX`/`panY` are screen pixels from the frame centre, so the wheel anchor
 * formula in the free-camera overlay stays independent of the host size.
 */
export function previewCameraFrame(
  viewport: PreviewViewport,
  camera: PreviewCamera | null | undefined,
  viewDivisor = 1,
): PreviewCameraFrame {
  const divisor = Number.isFinite(viewDivisor) && viewDivisor > 0 ? viewDivisor : 1;
  /** Returns `value` when finite, otherwise `fallback`. */
  const finite = (value: number | undefined, fallback: number): number =>
    typeof value === "number" && Number.isFinite(value) ? value : fallback;
  // The mode flag controls interaction and surface ownership. The stored pose
  // remains the last visible camera view so closing and reopening does not
  // snap the chart back to its fitted position.
  const candidateZoom = finite(camera?.zoom, 1);
  const zoom = candidateZoom > 0 ? candidateZoom : 1;
  const panX = finite(camera?.panX, 0);
  const panY = finite(camera?.panY, 0);
  return {
    scale: (viewport.scale * zoom) / divisor,
    scaleX: (viewport.scaleX * zoom) / divisor,
    scaleY: (viewport.scaleY * zoom) / divisor,
    centerX: viewport.left + viewport.width / 2 + panX,
    centerY: viewport.top + viewport.height / 2 + panY,
  };
}

/** The camera mapping and the chart frame it projects to, in screen pixels. */
export interface PreviewCameraView extends PreviewCameraFrame, PreviewViewportBounds {}

/**
 * The chart frame projected through the camera.
 *
 * The background and the white frame outline use this rectangle so they zoom
 * and pan with the chart content. The default camera returns the fitted
 * viewport (scaled by the view divisor), while a retained camera pose remains
 * available after its interaction mode is closed.
 */
export function previewCameraView(
  viewport: PreviewViewport,
  camera: PreviewCamera | null | undefined,
  viewDivisor = 1,
): PreviewCameraView {
  const frame = previewCameraFrame(viewport, camera, viewDivisor);
  const width = viewport.scaleX > 0 ? (viewport.width * frame.scaleX) / viewport.scaleX : 0;
  const height = viewport.scaleY > 0 ? (viewport.height * frame.scaleY) / viewport.scaleY : 0;
  return {
    ...frame,
    left: frame.centerX - width / 2,
    top: frame.centerY - height / 2,
    width,
    height,
  };
}

/** Just the projected chart-frame rectangle; see `previewCameraView`. */
export function previewCameraBounds(
  viewport: PreviewViewport,
  camera: PreviewCamera | null | undefined,
  viewDivisor = 1,
): PreviewViewportBounds {
  const { left, top, width, height } = previewCameraView(viewport, camera, viewDivisor);
  return { left, top, width, height };
}

/** Whether the camera differs from the one that produced the last painted frame. */
export class PreviewCameraTracker {
  private last: PreviewCamera | null = null;

  /** Whether the last painted frame used this exact camera view. */
  matches(camera: PreviewCamera): boolean {
    const previous = this.last;
    return (
      previous !== null &&
      previous.active === camera.active &&
      previous.zoom === camera.zoom &&
      previous.panX === camera.panX &&
      previous.panY === camera.panY
    );
  }

  /** Record the camera that produced the frame just painted. */
  remember(camera: PreviewCamera): void {
    this.last = { ...camera };
  }

  /** Forget the painted view so the next frame cannot reuse it. */
  reset(): void {
    this.last = null;
  }
}
