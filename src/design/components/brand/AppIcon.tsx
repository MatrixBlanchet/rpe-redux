/**
 * The product brand mark as a design primitive: resolves the bundled app icon and
 * paints it at a requested size. Startup and native window chrome share this one
 * asset; callers own placement and alt text.
 */
import { assetUrl } from "../../../core/platform/assetUrl.ts";

/** The single product app mark shared by startup and native window chrome. */
export const APP_ICON_ASSET = "redux/brand/redux-app-icon.png";
/** Resolved URL of the shared product app mark. */
export const APP_ICON_URL = assetUrl(APP_ICON_ASSET);

export interface AppIconProps {
  size?: number;
  alt?: string;
  className?: string;
}

/** Paints the product app mark at `size` pixels; `alt` names it for assistive technology. */
export function AppIcon({ size = 48, alt = "", className = "" }: AppIconProps) {
  return (
    <img
      className={`redux-app-icon ${className}`.trim()}
      src={APP_ICON_URL}
      width={size}
      height={size}
      alt={alt}
      draggable={false}
    />
  );
}
