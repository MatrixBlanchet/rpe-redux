/**
 * The RPE Redux wordmark as a design primitive.
 *
 * The artwork ships in two inks so the wordmark can always sit on the higher
 * contrast surface: near-white on dark surfaces and near-black on light
 * surfaces. The caller reports which surface the wordmark is being painted on.
 */
import { assetUrl } from "../../../core/platform/assetUrl.ts";

/** Near-white artwork for the dark startup surface. */
export const APP_WORDMARK_ON_DARK_ASSET = "redux/brand/redux-wordmark-on-dark.png";
/** Near-black artwork for the light startup surface. */
export const APP_WORDMARK_ON_LIGHT_ASSET = "redux/brand/redux-wordmark-on-light.png";

const APP_WORDMARK_ON_DARK_URL = assetUrl(APP_WORDMARK_ON_DARK_ASSET);
const APP_WORDMARK_ON_LIGHT_URL = assetUrl(APP_WORDMARK_ON_LIGHT_ASSET);

const WORDMARK_ASPECT = 330 / 1920;

export interface AppWordmarkProps {
  /** Tone of the surface behind the wordmark; the contrasting ink is chosen. */
  surface: "dark" | "light";
  width?: number;
  alt?: string;
  className?: string;
}

/** Draws the wordmark in the ink that contrasts with the caller's surface. */
export function AppWordmark({ surface, width = 320, alt = "", className = "" }: AppWordmarkProps) {
  return (
    <img
      className={`redux-app-wordmark ${className}`.trim()}
      src={surface === "light" ? APP_WORDMARK_ON_LIGHT_URL : APP_WORDMARK_ON_DARK_URL}
      width={width}
      height={Math.round(width * WORDMARK_ASPECT)}
      alt={alt}
      draggable={false}
    />
  );
}
