/**
 * AudioWorklet entry for the WSOLA time-stretcher.
 *
 * The main thread transfers one decoded song once, then sends start and stop
 * messages as the transport seeks or changes rate. Vite bundles this entry and
 * its core import into the worklet module URL used by `timeStretch.ts`.
 */
import { TimeStretch } from "./timeStretchCore.ts";

declare const sampleRate: number;
declare const currentTime: number;

declare abstract class AudioWorkletProcessor {
  readonly port: MessagePort;
  constructor(options?: unknown);
}

declare function registerProcessor(name: string, processor: new () => AudioWorkletProcessor): void;

const STOP_FADE_SECONDS = 0.008;
const DEFAULT_CROSSFADE_SECONDS = 0.008;

interface LoadMessage {
  type: "load";
  channels: Float32Array[];
  /** Input frame indices of strong onsets. */
  transients?: Int32Array;
  length: number;
}

interface StartMessage {
  type: "start";
  position: number;
  rate: number;
  startAt: number;
  /** Fade between the previous stream and the replacement; zero starts cold. */
  fadeSeconds?: number;
}

interface StopMessage {
  type: "stop";
  fadeSeconds: number;
}

type ProcessorMessage = LoadMessage | StartMessage | StopMessage;

/** Worklet processor that owns one TimeStretch and its fade/start state. */
class RpeTimeStretchProcessor extends AudioWorkletProcessor {
  private channels: Float32Array[] | null = null;
  private transients: Int32Array | null = null;
  private stretcher: TimeStretch | null = null;
  private previous: TimeStretch | null = null;
  private previousChannels: Float32Array[] = [];
  private previousFadeRemaining = 0;
  private previousFadeTotal = 1;
  private startAt = Infinity;
  private stopping = false;
  private fadeRemaining = 0;
  private fadeTotal = 1;

  /** Wire the port so the main thread can load, start, and stop the stretcher. */
  constructor() {
    super();
    this.port.onmessage = (event: MessageEvent<ProcessorMessage>) => this.receive(event.data);
  }

  /** Apply one load, start, or stop message from the main thread. */
  private receive(message: ProcessorMessage): void {
    switch (message.type) {
      case "load":
        this.channels = message.channels;
        this.transients = message.transients ?? null;
        this.previousChannels = message.channels.map(() => new Float32Array(256));
        break;
      case "start":
        if (!this.channels) {
          return;
        }
        this.beginStart(message);
        break;
      case "stop":
        this.previous = null;
        if (!this.stretcher) {
          return;
        }
        this.stopping = true;
        this.fadeRemaining = Math.max(1, Math.round(STOP_FADE_SECONDS * sampleRate));
        this.fadeTotal = this.fadeRemaining;
        break;
      default:
        break;
    }
  }

  /** Replace the stretcher with one starting at the requested position and rate. */
  private beginStart(message: StartMessage): void {
    if (!this.channels) {
      return;
    }
    const crossfade = Boolean(this.stretcher) && message.startAt <= currentTime + 0.002;
    const previous = crossfade ? this.stretcher : null;
    const fadeSeconds = Math.max(0, message.fadeSeconds ?? DEFAULT_CROSSFADE_SECONDS);
    const next = new TimeStretch({
      channels: this.channels,
      sampleRate,
      rate: message.rate,
      positionSeconds: message.position,
      transients: this.transients ?? undefined,
    });
    next.prime();
    this.previous = previous;
    this.previousFadeRemaining = previous ? Math.max(1, Math.round(fadeSeconds * sampleRate)) : 0;
    this.previousFadeTotal = this.previousFadeRemaining || 1;
    this.stretcher = next;
    this.startAt = Math.max(message.startAt, currentTime);
    this.stopping = false;
    this.fadeRemaining = 0;
  }

  /** Render one quantum, honoring the start delay, crossfade, and stop fade. */
  process(_inputs: Float32Array[][], outputs: Float32Array[][]): boolean {
    const output = outputs[0];
    if (!output || output.length === 0) {
      return true;
    }
    const frames = output[0].length;
    for (const channel of output) {
      channel.fill(0);
    }
    const stretcher = this.stretcher;
    if (!stretcher) {
      return true;
    }

    let offset = 0;
    if (currentTime < this.startAt) {
      const wait = Math.ceil((this.startAt - currentTime) * sampleRate);
      if (wait >= frames) {
        // Build the first batch while the transport is still waiting, so the
        // first audible block does not carry the priming cost.
        stretcher.prime();
        return true;
      }
      offset = Math.max(0, wait);
    }

    stretcher.render(output, frames - offset, offset);

    const previous = this.previous;
    if (previous) {
      if (this.previousChannels.length !== output.length) {
        this.previousChannels = output.map(() => new Float32Array(frames));
      }
      for (let channel = 0; channel < output.length; channel += 1) {
        if (!this.previousChannels[channel] || this.previousChannels[channel].length < frames) {
          this.previousChannels[channel] = new Float32Array(frames);
        }
        this.previousChannels[channel].fill(0);
      }
      previous.render(this.previousChannels, frames, 0);
      let remaining = this.previousFadeRemaining;
      const total = this.previousFadeTotal;
      for (let index = 0; index < frames; index += 1) {
        const previousGain = remaining > 0 ? remaining / total : 0;
        const currentGain = 1 - previousGain;
        for (let channel = 0; channel < output.length; channel += 1) {
          output[channel][index] =
            output[channel][index] * currentGain +
            (this.previousChannels[channel]?.[index] ?? 0) * previousGain;
        }
        remaining = Math.max(0, remaining - 1);
      }
      this.previousFadeRemaining = remaining;
      if (remaining === 0) {
        this.previous = null;
      }
    }

    if (this.stopping) {
      for (let index = 0; index < frames; index += 1) {
        const gain = this.fadeRemaining > 0 ? this.fadeRemaining / this.fadeTotal : 0;
        for (const channel of output) {
          channel[index] *= gain;
        }
        this.fadeRemaining -= 1;
      }
      if (this.fadeRemaining <= 0) {
        this.stretcher = null;
        this.stopping = false;
      }
    }
    return true;
  }
}

registerProcessor("rpe-time-stretch", RpeTimeStretchProcessor);
