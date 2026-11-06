/** SHA-256 helpers shared by room clients and tests. */
const digestCache = new WeakMap<object, string>();

/** SHA-256 as lowercase hex, cached per input byte array identity. */
export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const cached = digestCache.get(bytes);
  if (cached) {
    return cached;
  }
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", copy.buffer);
  const hash = [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  digestCache.set(bytes, hash);
  return hash;
}

/** Encode bytes without spreading a huge array into `String.fromCharCode`. */
export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const step = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += step) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + step));
  }
  return btoa(binary);
}

/** Decode base64 into a fresh byte array. */
export function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

/** Uniform random request ids for asset transfers and room messages. */
export function randomToken(length = 16): string {
  const bytes = new Uint8Array(length);
  globalThis.crypto.getRandomValues(bytes);
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
