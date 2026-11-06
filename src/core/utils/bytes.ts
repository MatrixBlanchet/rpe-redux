/**
 * Bridges between the platform layer's byte arrays and the DOM APIs that only
 * accept `ArrayBuffer`-backed data.
 *
 * `lib.dom` types `BlobPart` and `decodeAudioData` against `ArrayBuffer`, while
 * a `Uint8Array` may be backed by a `SharedArrayBuffer` or by Node's `Buffer`
 * pool. Both helpers reuse the bytes in place when the backing store already is
 * an `ArrayBuffer` and copy only when it genuinely is not.
 */

/** A view `Blob` accepts (`BlobPart` requires an `ArrayBuffer`-backed view). */
export function toBlobPart(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  return bytes.buffer instanceof ArrayBuffer
    ? new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    : new Uint8Array(bytes);
}

/** A standalone `ArrayBuffer` holding exactly `bytes`, as `decodeAudioData` wants. */
export function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer instanceof ArrayBuffer
    ? bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
    : new Uint8Array(bytes).buffer;
}
