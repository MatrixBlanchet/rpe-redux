/** Projects an editor noise line from its sampled scene transform for preview. */
import type { JudgeLine } from "../chart.ts";
import type { LineState } from "../runtime/scene.ts";
import type { TempoMap } from "../timing/tempo.ts";
import { blockAreaBounds, type BlockArea } from "./blockArea.ts";
import type { NoiseAreaSample } from "./noiseRuntime.ts";
import { noiseAreaForLine } from "./noiseLine.ts";

/** Compile lifetime and activation independently of world-space line transforms. */
export function noiseLinePreviewArea(line: JudgeLine, tempo: TempoMap): BlockArea | null {
  return noiseAreaForLine({ ...line, father: -1, notes: [], eventLayers: [], extended: {} }, tempo);
}

/** Replace template corners with the current scene's world-space line geometry. */
export function sampleNoiseLinePreview(
  area: BlockArea,
  sample: NoiseAreaSample,
  state: LineState,
  sizeX: number,
  sizeY: number,
  aspect: number,
): NoiseAreaSample {
  const bounds = blockAreaBounds(area);
  const angle = (state.rotation * Math.PI) / 180;
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return {
    ...sample,
    points: bounds.corners.map(({ x, y }) => {
      const dx = (x - bounds.centerX) * sizeX;
      const dy = (y - bounds.centerY) * sizeY;
      return { x: state.x + c * dx + s * dy * aspect, y: state.y - (s * dx) / aspect + c * dy };
    }),
  };
}
