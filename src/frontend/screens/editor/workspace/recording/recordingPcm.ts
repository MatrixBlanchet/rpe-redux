/** Serializes a mixed stereo soundtrack as bounded, interleaved float PCM chunks. */

/** The decoded audio surface needed by the PCM writer. */
export interface RecordingAudioBuffer {
  readonly length: number;
  readonly numberOfChannels: number;
  getChannelData(channel: number): Float32Array;
}

/**
 * Yield little-endian f32 stereo frames without allocating another full song.
 * Mono is duplicated; buffers with more than two channels use their first pair.
 */
export function* recordingPcmChunks(
  buffer: RecordingAudioBuffer,
  framesPerChunk = 16_384,
): Generator<Uint8Array> {
  if (
    !Number.isSafeInteger(framesPerChunk) ||
    framesPerChunk < 1 ||
    !Number.isSafeInteger(buffer.length) ||
    buffer.length < 0 ||
    !Number.isInteger(buffer.numberOfChannels) ||
    buffer.numberOfChannels < 1
  ) {
    throw new RangeError("Invalid recording audio buffer");
  }
  const left = buffer.getChannelData(0);
  const right = buffer.getChannelData(buffer.numberOfChannels > 1 ? 1 : 0);
  if (left.length < buffer.length || right.length < buffer.length) {
    throw new RangeError("Incomplete recording audio buffer");
  }
  for (let offset = 0; offset < buffer.length; offset += framesPerChunk) {
    const count = Math.min(framesPerChunk, buffer.length - offset);
    const bytes = new Uint8Array(count * 8);
    const view = new DataView(bytes.buffer);
    for (let frame = 0; frame < count; frame++) {
      view.setFloat32(frame * 8, left[offset + frame], true);
      view.setFloat32(frame * 8 + 4, right[offset + frame], true);
    }
    yield bytes;
  }
}
