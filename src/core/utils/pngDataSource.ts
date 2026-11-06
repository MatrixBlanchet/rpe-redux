/**
 * PNG data-URL guards shared by theme packages and the icon primitive.
 *
 * An icon source is interpolated into `mask-image: url("…")`. Accepting any
 * string after the PNG prefix would let a crafted payload close that string and
 * inject CSS declarations. The payload must therefore be base64 and start with
 * the PNG file signature; remote URLs and SVG data are handled by the callers.
 */
const PNG_DATA_PREFIX = "data:image/png;base64,";
const PNG_SIGNATURE_BASE64 = "iVBORw0KGgo";
const BASE64_PAYLOAD = /^[A-Za-z0-9+/]+={0,2}$/;

/** True when the value is a base64 PNG data URL with a real PNG signature. */
export function isSafePngDataUrl(value: string): boolean {
  if (!value.startsWith(PNG_DATA_PREFIX)) {
    return false;
  }
  const payload = value.slice(PNG_DATA_PREFIX.length);
  return payload.startsWith(PNG_SIGNATURE_BASE64) && BASE64_PAYLOAD.test(payload);
}
