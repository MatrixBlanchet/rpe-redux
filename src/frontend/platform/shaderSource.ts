/**
 * Reads a shader's GLSL from the packaged assets.
 *
 * The preview runtime and the inspector receive shader text through this loader,
 * which keeps network access out of `core/global/chart`.
 */
import { assetUrl } from "../../core/platform/assetUrl.ts";

/**
 * Reads one shader's GLSL out of the packaged assets.
 *
 * `path` is relative to `assets/`, for example `redux/shaders/<name>.glsl`.
 * Returns null when the file is absent, which selects the unprocessed preview.
 */
export async function readShaderSource(path: string): Promise<string | null> {
  const response = await fetch(assetUrl(path));
  return response.ok ? await response.text() : null;
}
