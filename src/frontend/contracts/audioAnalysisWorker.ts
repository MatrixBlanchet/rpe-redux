/**
 * Worker seam for the scrubber spectrum.
 *
 * Analyzing a whole track off the interaction path is editor media work, so the
 * worker URL belongs to the editor composition root. Chrome's spectrum loader
 * asks this contract for a worker factory and falls back to main-thread analysis
 * when none is bound.
 */
import { createLateBound } from "../../core/utils/lateBound.ts";

/** Creates the module worker that streams audio analysis chunks. */
export type AudioAnalysisWorkerFactory = () => Worker;

const factory = createLateBound<AudioAnalysisWorkerFactory>();

/** Binds the editor's worker factory; returns the matching disposer. */
export function bindAudioAnalysisWorker(next: AudioAnalysisWorkerFactory): () => void {
  return factory.bind(next);
}

/** The bound worker factory, or null before the editor composition root runs. */
export function getAudioAnalysisWorkerFactory(): AudioAnalysisWorkerFactory | null {
  return factory.value();
}
