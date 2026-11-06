/** Narrow DOM surfaces passed from feature-local React hosts to runtime owners. */
import type { TransportSurface } from "../../../../../contracts/transportSurface.ts";

export type { TransportSurface };

/** Canvas layers the preview renderer paints into. */
export interface PreviewSurface {
  readonly canvas: HTMLCanvasElement;
  readonly noteBatch: HTMLCanvasElement;
  readonly shader: HTMLCanvasElement;
  readonly overlay: HTMLCanvasElement;
}

/** Stage and canvas nodes the timeline paints into. */
export interface TimelineSurface {
  readonly stage: HTMLDivElement;
  readonly notesBackdrop: HTMLCanvasElement;
  readonly notesPlayhead: HTMLCanvasElement;
  readonly notes: HTMLCanvasElement;
  readonly noteBatch: HTMLCanvasElement;
  readonly eventsBackdrop: HTMLCanvasElement;
  readonly eventsPlayhead: HTMLCanvasElement;
  readonly events: HTMLCanvasElement;
  readonly eventBatch: HTMLCanvasElement;
  readonly selectionOverlay: HTMLCanvasElement;
  readonly audioAnalysisOverlay: HTMLCanvasElement;
  readonly noteDensity: HTMLCanvasElement;
  readonly history: HTMLCanvasElement;
}

/** Inspector root and the trajectory overlay it hosts. */
export interface InspectorSurface {
  readonly inspector: HTMLElement;
  readonly trajectoryOverlay: HTMLCanvasElement;
}

/** DOM surfaces one editor mount hands to its imperative runtime owners. */
export interface EditorSurfaces {
  readonly preview: PreviewSurface;
  readonly timeline: TimelineSurface;
  readonly inspector: InspectorSurface;
  readonly transport: TransportSurface;
}
