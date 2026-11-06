/** Session-wide preview mode for noise areas; chart serialization stays unchanged. */
import { defineValue } from "../../state/values.ts";

/** Whether the editor renders the animated NoiseField effect; false draws a flat fill. */
export const detailedNoiseRendering = defineValue({
  id: "editor.detailedNoiseRendering",
  initial: true,
});
