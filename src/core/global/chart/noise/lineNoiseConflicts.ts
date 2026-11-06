/** Checks and clears judge-line data incompatible with noise-area editing. */
import type { JudgeLine } from "../chart.ts";

/** Counts the data that requires confirmation before enabling noise editing. */
export interface LineNoiseConflicts {
  readonly notes: number;
  readonly alphaEvents: number;
  readonly speedEvents: number;
  /** A custom image cannot be part of a noise area, which draws its own field. */
  readonly textures: number;
}

/** Inspect every event layer without modifying the imported chart. */
export function lineNoiseConflicts(line: JudgeLine): LineNoiseConflicts {
  return {
    notes: line.notes?.length ?? 0,
    alphaEvents: (line.eventLayers ?? []).reduce(
      (count, layer) => count + (layer?.alphaEvents?.length ?? 0),
      0,
    ),
    speedEvents: (line.eventLayers ?? []).reduce(
      (count, layer) => count + (layer?.speedEvents?.length ?? 0),
      0,
    ),
    textures: line.Texture && line.Texture !== "line.png" ? 1 : 0,
  };
}

/** Return a copy without incompatible notes or alpha/speed events. */
export function clearLineNoiseConflicts(line: JudgeLine): JudgeLine {
  const conflicts = lineNoiseConflicts(line);
  if (!conflicts.notes && !conflicts.alphaEvents && !conflicts.speedEvents && !conflicts.textures) {
    return line;
  }
  return {
    ...line,
    ...(conflicts.notes ? { notes: [], numOfNotes: 0 } : {}),
    ...(conflicts.textures ? { Texture: "line.png" } : {}),
    ...(conflicts.alphaEvents || conflicts.speedEvents
      ? {
          eventLayers: line.eventLayers?.map((layer) => {
            if (!layer || (!layer.alphaEvents?.length && !layer.speedEvents?.length)) {
              return layer;
            }
            return {
              ...layer,
              ...(layer.alphaEvents?.length ? { alphaEvents: [] } : {}),
              ...(layer.speedEvents?.length ? { speedEvents: [] } : {}),
            };
          }),
        }
      : {}),
  };
}
