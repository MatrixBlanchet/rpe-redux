/**
 * Renders the editor's central authoring surface.
 *
 * `Workspace` owns the stage slot only; shell chrome and runtime state live
 * outside it.
 */
import { CanvasStage } from "../stage/surface/CanvasStage.tsx";

/**
 * The editing surface: the merged preview and authoring canvas.
 *
 * Every surrounding region, including the top bar, inspector, rail, and status
 * bar, is a sibling of the workspace rather than part of it.
 */
export function Workspace({ hidden = false }: { hidden?: boolean }) {
  return (
    <main className="workspace panel redux-stage-overlay" hidden={hidden}>
      <CanvasStage />
    </main>
  );
}
