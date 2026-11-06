/**
 * Texture scale policy for decoded chart images.
 *
 * Scales round down to power-of-two steps, and line textures are capped to the
 * preview viewport's logical bound so large artwork cannot exhaust the GPU.
 */
/** Round a texture scale down to a power-of-two step, never above 1. */
export function textureScale(scale: number): number {
  if (!Number.isFinite(scale) || scale >= 1) {
    return 1;
  }
  return 2 ** Math.ceil(Math.log2(Math.max(1 / 64, scale)));
}

/** Cap decoded line textures to the preview's logical viewport bound. */
export function viewportTextureScale(scale: number, width: number, height: number): number {
  const maximumScale =
    width > 0 && height > 0 ? Math.min(2700 / width, 1800 / height) : Number.POSITIVE_INFINITY;
  const cap =
    Number.isFinite(maximumScale) && maximumScale < 1
      ? 2 ** Math.floor(Math.log2(Math.max(1 / 64, maximumScale)))
      : 1;
  return Math.min(scale, cap);
}
