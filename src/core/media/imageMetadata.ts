/**
 * Reads image facts from bytes alone.
 *
 * Detects animated GIF, WebP, AVIF and APNG content and probes PNG dimensions
 * without decoding pixels, so callers can size textures before load.
 */
/** Whether the named image may animate or carry multiple frames. */
export function animatedImage(name: string, bytes: Uint8Array): boolean {
  if (/\.(gif|webp|avif|apng)$/i.test(name)) {
    return true;
  }
  if (!/\.png$/i.test(name) || bytes.length < 8) {
    return false;
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (let offset = 8; offset + 12 <= bytes.length;) {
    const type = view.getUint32(offset + 4);
    if (type === 0x6163544c) {
      return true;
    }
    if (type === 0x49444154 || type === 0x49454e44) {
      return false;
    }
    offset += view.getUint32(offset) + 12;
  }
  return false;
}

/** Read PNG dimensions from the IHDR chunk, or an empty object for other bytes. */
export function probePngDimensions(bytes: Uint8Array): {
  naturalWidth?: number;
  naturalHeight?: number;
} {
  if (bytes.length < 24) {
    return {};
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(0) !== 0x89504e47 || view.getUint32(4) !== 0x0d0a1a0a) {
    return {};
  }
  return { naturalWidth: view.getUint32(16), naturalHeight: view.getUint32(20) };
}
