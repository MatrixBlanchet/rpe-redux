/**
 * Publishes a fully installed document to the timeline, progress, and home
 * surfaces. It owns only the first-render order; installation and teardown live
 * in the sibling lifecycle modules.
 */
/** Surface updates performed after a document is installed. */
export interface DocumentPresentationOptions {
  timeline: { resetDocument(): void };
  setProgressDuration(seconds: number): void;
  renderSession(): void;
  setHasDocument(hasDocument: boolean): void;
  setHome(home: boolean): void;
}

/** Publish a fully installed document, retaining the original first-render order. */
export function createDocumentPresentation(options: DocumentPresentationOptions) {
  return (_name: string): void => {
    options.timeline.resetDocument();
    options.setProgressDuration(600);
    options.renderSession();
    options.setHasDocument(true);
    options.setHome(false);
  };
}
