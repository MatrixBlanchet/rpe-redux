/**
 * Registers the second-row noise-rendering switch. The control renderer lives
 * beside the other toolbar controls; this module only contributes its place in
 * the registry.
 */
import { toolbar } from "../../../../../../core/shell/registries/toolbar.ts";

/** Contribute the noise-rendering switch to the editor's second toolbar row. */
export function registerNoiseToolbar(): () => void {
  return toolbar.register({
    kind: "control",
    id: "stage.noiseRendering",
    order: 16,
    row: 2,
    controlId: "noiseRendering",
  });
}
