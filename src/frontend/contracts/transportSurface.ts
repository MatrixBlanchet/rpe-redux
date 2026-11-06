/**
 * Transport DOM surface shared by chrome and the editor runtime.
 *
 * Chrome renders the scrubber, marker layer, and spectrum canvas. The editor
 * assembly receives those nodes through this surface; the shape lives in the
 * contract so chrome does not import the editor composition's surface bundle.
 */

/** Transport controls hosted outside the editor stage. */
export interface TransportSurface {
  readonly timelineMarkers: HTMLDivElement;
  readonly scrubberWrap: HTMLDivElement;
  readonly scrubber: HTMLInputElement;
  readonly scrubberSpectrum: HTMLCanvasElement;
}
