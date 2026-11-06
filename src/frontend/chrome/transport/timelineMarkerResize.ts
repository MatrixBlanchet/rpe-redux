/**
 * Keeps marker geometry and spectrum drawing in step with their hosts.
 *
 * A resize observer on the stage and scrubber redraws both, and disposing the
 * binding releases the markers.
 */
/** Hosts and callbacks a marker resize binding observes and redraws. */
export interface TimelineMarkerResizeBindings {
  stage: Element;
  scrubber: Element;
  renderMarkers(): void;
  drawScrubberSpectrum(): void;
  invalidate(): void;
  disposeMarkers(): void;
}

/** Keep marker geometry and the scrubber spectrum aligned with their hosts. */
export function bindTimelineMarkerResize(bindings: TimelineMarkerResizeBindings): () => void {
  const observer = new ResizeObserver(() => {
    bindings.renderMarkers();
    bindings.drawScrubberSpectrum();
    bindings.invalidate();
  });
  observer.observe(bindings.stage);
  observer.observe(bindings.scrubber);
  return () => {
    observer.disconnect();
    bindings.disposeMarkers();
  };
}
