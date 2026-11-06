/**
 * Converts decoded audio into compact spectrum data for the timeline.
 *
 * The `AudioBufferLike` input keeps this core mechanism usable with browser
 * audio and test doubles. It owns channel mixing, decimation, gamma, and floor
 * handling; it does not create canvases, schedule playback, or retain the buffer.
 */
import { clamp01 } from "../utils/numbers.ts";

/** The slice of an `AudioBuffer` the analyser reads. */
export interface AudioBufferLike {
  length: number;
  numberOfChannels: number;
  duration: number;
  getChannelData(channel: number): Float32Array;
}

/** Decimated access to an audio buffer's mono mixdown. */
export interface ChannelSamples {
  length: number;
  at(index: number): number;
}

/** Build a decimated mono view over an audio buffer, or null for invalid input. */
function channelSamples(buffer: AudioBufferLike): ChannelSamples | null {
  if (!buffer || typeof buffer.getChannelData !== "function" || !buffer.length) {
    return null;
  }
  const channels = Math.max(1, Number(buffer.numberOfChannels) || 1);
  const length = Number(buffer.length) || 0;
  const data = Array.from({ length: channels }, (_, channel) => buffer.getChannelData(channel));
  return {
    length,
    at(index: number): number {
      let value = 0;
      for (const channel of data) {
        value += channel[index] ?? 0;
      }
      return value / channels;
    },
  };
}

/** Bounds for the waveform envelope and spectrum grid. */
export interface AudioAnalysisOptions {
  waveformSize?: number;
  bands?: number;
  spectrumFrames?: number;
}

/**
 * The display encoding of `AudioAnalysisData.spectrum`.
 *
 * Each band is normalized to its own peak (`domain`-level AGC: a band that only
 * sounds twice in a track still shows its own shape), then raised to this power.
 * Both are what the waveform / spectrum panel wants, and both are lossy — a reader that
 * wants the band magnitude back has to invert them, which is why the constant is
 * exported rather than inlined.
 */
export const SPECTRUM_GAMMA = 0.48;

/** Values below this fraction of a band's peak are treated as silence. */
export const SPECTRUM_FLOOR = 0.025;

/** Signed min/max envelope for one audio channel. */
export interface WaveformChannel {
  readonly min: Float32Array;
  readonly max: Float32Array;
}

/** Waveform envelopes and normalized spectrum grid for one audio buffer. */
export interface AudioAnalysisData {
  duration: number;
  /** Number of source channels; mono data duplicates `left` into `right`. */
  channels: number;
  left: WaveformChannel;
  right: WaveformChannel;
  spectrum: Float32Array;
  bands: number;
  frameCount: number;
}

/**
 * Apply the perceptual emphasis curve used by both waveform renderers.
 * `p > 1` lifts quiet detail while preserving the sign and the monotonic order.
 */
export function shapeWaveform(value: number, curve = 1): number {
  const magnitude = Math.min(1, Math.abs(value));
  const power = Number.isFinite(curve) ? Math.max(0.25, curve) : 1;
  if (!(magnitude > 0) || power === 1) {
    return value;
  }
  const shaped = 1 - Math.pow(1 - magnitude, power);
  return value < 0 ? -shaped : shaped;
}

/**
 * Analyze a decoded buffer into waveform envelopes and a spectrum grid.
 *
 * Returns null when the buffer exposes no channel data. The result is normalized
 * per channel and per band and does not retain the source buffer.
 */
export function analyzeAudioBuffer(
  buffer: AudioBufferLike,
  options: AudioAnalysisOptions = {},
): AudioAnalysisData | null {
  const samples = channelSamples(buffer);
  if (!samples) {
    return null;
  }
  const channelCount = Math.max(1, Number(buffer.numberOfChannels) || 1);
  const leftData = buffer.getChannelData(0);
  const rightData = channelCount > 1 ? buffer.getChannelData(1) : leftData;
  const waveformSize = Math.max(256, Math.min(262144, Number(options.waveformSize) || 131072));
  const left: WaveformChannel = {
    min: new Float32Array(waveformSize),
    max: new Float32Array(waveformSize),
  };
  const right: WaveformChannel = {
    min: new Float32Array(waveformSize),
    max: new Float32Array(waveformSize),
  };
  let peakMaximum = 0;
  for (let index = 0; index < waveformSize; index++) {
    const start = Math.floor((index * samples.length) / waveformSize);
    const end = Math.max(start + 1, Math.floor(((index + 1) * samples.length) / waveformSize));
    let leftMin = Number.POSITIVE_INFINITY;
    let leftMax = Number.NEGATIVE_INFINITY;
    let rightMin = Number.POSITIVE_INFINITY;
    let rightMax = Number.NEGATIVE_INFINITY;
    for (let cursor = start; cursor < end && cursor < samples.length; cursor++) {
      const leftSample = leftData[cursor] ?? 0;
      const rightSample = rightData[cursor] ?? 0;
      leftMin = Math.min(leftMin, leftSample);
      leftMax = Math.max(leftMax, leftSample);
      rightMin = Math.min(rightMin, rightSample);
      rightMax = Math.max(rightMax, rightSample);
    }
    if (!Number.isFinite(leftMin)) {
      leftMin = 0;
      leftMax = 0;
      rightMin = 0;
      rightMax = 0;
    }
    left.min[index] = leftMin;
    left.max[index] = leftMax;
    right.min[index] = rightMin;
    right.max[index] = rightMax;
    peakMaximum = Math.max(
      peakMaximum,
      Math.abs(leftMin),
      Math.abs(leftMax),
      Math.abs(rightMin),
      Math.abs(rightMax),
    );
  }
  if (peakMaximum > 0) {
    const scale = 1 / peakMaximum;
    for (let index = 0; index < waveformSize; index++) {
      left.min[index] *= scale;
      left.max[index] *= scale;
      right.min[index] *= scale;
      right.max[index] *= scale;
    }
  }
  const bands = Math.max(16, Math.min(128, Number(options.bands) || 64));
  const frameCount = Math.max(256, Math.min(8192, Number(options.spectrumFrames) || 2048));
  const spectrum = new Float32Array(frameCount * bands);
  const frameSize = 1024;
  const real = new Float64Array(frameSize);
  const imaginary = new Float64Array(frameSize);
  const reverse = new Uint16Array(frameSize);
  const rawSpectrum = new Float32Array(frameCount * bands);
  const bandPeaks = new Float32Array(bands);
  for (let index = 1, reversed = 0; index < frameSize; index++) {
    let bit = frameSize >> 1;
    for (; reversed & bit; bit >>= 1) {
      reversed ^= bit;
    }
    reversed ^= bit;
    reverse[index] = reversed;
  }
  for (let frame = 0; frame < frameCount; frame++) {
    const center = Math.floor(((frame + 0.5) * samples.length) / frameCount);
    const start = center - frameSize / 2;
    for (let index = 0; index < frameSize; index++) {
      const value = samples.at(Math.max(0, Math.min(samples.length - 1, start + index))) ?? 0;
      const window = 0.5 - 0.5 * Math.cos((Math.PI * 2 * index) / (frameSize - 1));
      real[index] = value * window;
      imaginary[index] = 0;
    }
    for (let index = 1; index < frameSize; index++) {
      if (index < reverse[index]) {
        [real[index], real[reverse[index]]] = [real[reverse[index]], real[index]];
        [imaginary[index], imaginary[reverse[index]]] = [
          imaginary[reverse[index]],
          imaginary[index],
        ];
      }
    }
    for (let size = 2; size <= frameSize; size <<= 1) {
      const half = size >> 1;
      const angle = (-Math.PI * 2) / size;
      for (let startIndex = 0; startIndex < frameSize; startIndex += size) {
        for (let offset = 0; offset < half; offset++) {
          const cosine = Math.cos(angle * offset);
          const sine = Math.sin(angle * offset);
          const target = startIndex + offset;
          const paired = target + half;
          const pairedReal = real[paired] * cosine - imaginary[paired] * sine;
          const pairedImaginary = real[paired] * sine + imaginary[paired] * cosine;
          real[paired] = real[target] - pairedReal;
          imaginary[paired] = imaginary[target] - pairedImaginary;
          real[target] += pairedReal;
          imaginary[target] += pairedImaginary;
        }
      }
    }
    for (let band = 0; band < bands; band++) {
      const low = Math.max(1, Math.floor(Math.pow(band / bands, 2.2) * (frameSize / 2 - 1)));
      const high = Math.max(
        low + 1,
        Math.min(
          frameSize / 2,
          Math.ceil(Math.pow((band + 1) / bands, 2.2) * (frameSize / 2 - 1) + 1),
        ),
      );
      let energy = 0;
      let count = 0;
      for (let bin = low; bin < high; bin++) {
        const magnitude = Math.hypot(real[bin], imaginary[bin]) / (frameSize * 0.5);
        energy += magnitude * magnitude;
        count++;
      }
      const value = count ? Math.sqrt(energy / count) : 0;
      rawSpectrum[frame * bands + band] = value;
      bandPeaks[band] = Math.max(bandPeaks[band], value);
    }
  }
  for (let frame = 0; frame < frameCount; frame++) {
    for (let band = 0; band < bands; band++) {
      const value = rawSpectrum[frame * bands + band];
      const peak = bandPeaks[band];
      if (peak <= 0) {
        continue;
      }
      const floor = peak * SPECTRUM_FLOOR;
      const normalized = clamp01((value - floor) / Math.max(peak - floor, Number.EPSILON));
      rawSpectrum[frame * bands + band] = Math.pow(normalized, SPECTRUM_GAMMA);
    }
  }
  spectrum.set(rawSpectrum);
  return {
    duration: Number(buffer.duration) || 0,
    channels: channelCount,
    left,
    right,
    spectrum,
    bands,
    frameCount,
  };
}
