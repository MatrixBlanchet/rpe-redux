/**
 * Runs one session publication in the observable order: data, readouts, panel
 * contents, then selection routing. The document provider owns when a publish
 * happens; this module only sequences the feature-owned steps.
 */
import { createSessionData, type SessionDataOptions } from "./sessionData.ts";
import { createSessionReadouts, type SessionReadoutOptions } from "./sessionReadouts.ts";
import { createSessionPanels, type SessionPanelOptions } from "./sessionPanels.ts";
import { createSessionSelection, type SessionSelectionOptions } from "./sessionSelection.ts";

/** Options for one observable session publication. */
export interface SessionRendererOptions {
  data: SessionDataOptions;
  readouts: SessionReadoutOptions;
  panels: SessionPanelOptions;
  selection: SessionSelectionOptions;
  activePane(): string;
  invalidate(): void;
}

/** This order is observable: data → readouts → panel contents → selection routing. */
export function createEditorSessionRenderer(options: SessionRendererOptions) {
  const data = createSessionData(options.data);
  const readouts = createSessionReadouts(options.readouts);
  const panels = createSessionPanels(options.panels);
  const selection = createSessionSelection(options.selection);
  /** Runs one publication in its observable order. */
  function render(): void {
    const activePane = options.activePane();
    const current = data.prepare();
    readouts.publish(current.session);
    panels.refresh(current.session, current.tempo, activePane);
    selection.route(current.session, activePane);
    options.invalidate();
  }
  return {
    render,
    chartInfoPresenter: readouts.chartInfoPresenter,
    resetSelectionRouting: selection.reset,
    dispose: readouts.dispose,
  };
}
