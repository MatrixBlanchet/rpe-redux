/**
 * The RPE Redux lockup (mark and wordmark) as a design primitive.
 *
 * The artwork ships in two inks so the lockup can always sit on the higher
 * contrast surface: near-white on dark surfaces and near-black on light
 * surfaces. The caller reports which surface the lockup is being painted on.
 */
import { assetUrl } from "../../../core/platform/assetUrl.ts";

/** Near-white artwork for the dark About surface. */
export const APP_LOCKUP_ON_DARK_ASSET = "redux/brand/redux-lockup-on-dark.png";
/** Near-black artwork for the light About surface. */
export const APP_LOCKUP_ON_LIGHT_ASSET = "redux/brand/redux-lockup-on-light.png";

const APP_LOCKUP_ON_DARK_URL = assetUrl(APP_LOCKUP_ON_DARK_ASSET);
const APP_LOCKUP_ON_LIGHT_URL = assetUrl(APP_LOCKUP_ON_LIGHT_ASSET);

export interface AppLockupProps {
  /** Tone of the surface behind the lockup; the contrasting ink is chosen. */
  surface: "dark" | "light";
  size?: number;
  alt?: string;
  className?: string;
}

/** Draws the mark and wordmark in the ink that contrasts with the caller's surface. */
export function AppLockup({ surface, size = 260, alt = "", className = "" }: AppLockupProps) {
  return (
    <img
      className={`redux-app-lockup ${className}`.trim()}
      src={surface === "light" ? APP_LOCKUP_ON_LIGHT_URL : APP_LOCKUP_ON_DARK_URL}
      width={size}
      height={size}
      alt={alt}
      draggable={false}
    />
  );
}
