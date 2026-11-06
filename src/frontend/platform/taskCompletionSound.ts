/**
 * Plays the title-bar completion chime for a finished background task.
 *
 * The sound is synthesized so the chrome needs no bundled audio asset and does
 * not enter the editor's media pipeline. The context is shared across chimes;
 * browsers that block audio before a gesture simply drop the sound.
 */

let sharedContext: AudioContext | null = null;

/** Returns the shared audio context, or null when Web Audio is unavailable. */
function chimeContext(): AudioContext | null {
  if (typeof AudioContext === "undefined") {
    return null;
  }
  try {
    sharedContext ??= new AudioContext();
    return sharedContext;
  } catch {
    return null;
  }
}

/** Schedules one soft sine tone with a short attack and a long decay. */
function scheduleTone(
  context: AudioContext,
  frequency: number,
  start: number,
  duration: number,
): void {
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(frequency, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.linearRampToValueAtTime(0.07, start + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(gain).connect(context.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.02);
}

/** Plays a short two-note chime when a background task completes. */
export function playTaskCompletionChime(): void {
  const context = chimeContext();
  if (!context) {
    return;
  }
  const play = () => {
    const start = context.currentTime + 0.01;
    scheduleTone(context, 880, start, 0.18);
    scheduleTone(context, 1318.51, start + 0.1, 0.3);
  };
  if (context.state === "suspended") {
    void context
      .resume()
      .then(play)
      .catch(() => {});
    return;
  }
  play();
}
