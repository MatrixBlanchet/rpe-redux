/**
 * Registers the editor's toolbar rows before the editor mounts.
 *
 * These contributions belong to editor mode; the mode module imports this side
 * effect so the shared shell never imports a screen.
 */
import { registerToolbarControls } from "./ToolbarControls.tsx";
import { registerNoiseToolbar } from "../workspace/preview/render/noiseToolbar.ts";

const dispose = [registerToolbarControls(), registerNoiseToolbar()];

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    for (const remove of dispose) {
      remove();
    }
  });
}
