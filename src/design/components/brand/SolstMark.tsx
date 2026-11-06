/**
 * The SOLST-II publisher mark as a design primitive.
 *
 * The artwork ships in two inks so the mark can always sit on the higher
 * contrast surface: white on dark surfaces and black on light surfaces. The
 * caller reports which surface the mark is being painted on.
 */
import { assetUrl } from "../../../core/platform/assetUrl.ts";

/** White artwork for the dark settings surface. */
export const SOLST_MARK_ON_DARK_ASSET = "redux/brand/solst-ii-on-dark.png";
/** Black artwork for the light settings surface. */
export const SOLST_MARK_ON_LIGHT_ASSET = "redux/brand/solst-ii-on-light.png";

const SOLST_MARK_ON_DARK_URL = assetUrl(SOLST_MARK_ON_DARK_ASSET);
const SOLST_MARK_ON_LIGHT_URL = assetUrl(SOLST_MARK_ON_LIGHT_ASSET);

export interface SolstMarkProps {
  /** Tone of the surface behind the mark; the contrasting ink is chosen. */
  surface: "dark" | "light";
  size?: number;
  alt?: string;
  className?: string;
}

/** Draws the publisher mark in the ink that contrasts with the caller's surface. */
export function SolstMark({ surface, size = 160, alt = "", className = "" }: SolstMarkProps) {
  return (
    <img
      className={`redux-solst-mark ${className}`.trim()}
      src={surface === "light" ? SOLST_MARK_ON_LIGHT_URL : SOLST_MARK_ON_DARK_URL}
      width={size}
      height={size}
      alt={alt}
      draggable={false}
    />
  );
}
