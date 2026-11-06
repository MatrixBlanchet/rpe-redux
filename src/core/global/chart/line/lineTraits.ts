/**
 * What a judge line is for, and which authoring fields still carry meaning.
 *
 * A line is not always a playable judge line. The editor also uses one as a
 * noise area or as a game-UI binding, and imported charts can carry a text line.
 * Those purposes share the transform/event container but not the notes, texture,
 * mask, anchor, or ordering fields. The panel and the edit commands read this
 * one description.
 */
import type { JudgeLine } from "../chart.ts";
import { noiseLineSettings } from "../noise/noiseLine.ts";

/** The role a line plays in the chart or editor UI. */
export type JudgeLinePurpose = "standard" | "texture" | "noise" | "ui" | "text";

/** Which authoring fields and behaviors a line purpose keeps available. */
export interface JudgeLineTraits {
  readonly purpose: JudgeLinePurpose;
  readonly noiseInverted: boolean;
  readonly isTexture: boolean;
  readonly isNoise: boolean;
  readonly isUi: boolean;
  readonly isText: boolean;
  readonly allowsNotes: boolean;
  readonly allowsAlphaEvents: boolean;
  readonly allowsSpeedEvents: boolean;
  readonly allowsTexture: boolean;
  readonly allowsMask: boolean;
  readonly allowsAnchor: boolean;
  readonly allowsZOrder: boolean;
  readonly allowsUiBinding: boolean;
  readonly allowsNoiseMode: boolean;
}

/** Standard playable line with every standard authoring field. */
const STANDARD: JudgeLineTraits = Object.freeze({
  purpose: "standard",
  noiseInverted: false,
  isTexture: false,
  isNoise: false,
  isUi: false,
  isText: false,
  allowsNotes: true,
  allowsAlphaEvents: true,
  allowsSpeedEvents: true,
  allowsTexture: true,
  allowsMask: true,
  allowsAnchor: false,
  allowsZOrder: true,
  allowsUiBinding: true,
  allowsNoiseMode: true,
});

/** Custom-texture line: visuals and anchor, no notes or speed track. */
const TEXTURE: JudgeLineTraits = Object.freeze({
  ...STANDARD,
  purpose: "texture",
  isTexture: true,
  allowsNotes: false,
  allowsSpeedEvents: false,
  allowsMask: false,
  allowsAnchor: true,
  allowsUiBinding: false,
  allowsNoiseMode: false,
});

/** Noise-area line: transform and activation only. */
const NOISE: JudgeLineTraits = Object.freeze({
  ...STANDARD,
  purpose: "noise",
  isNoise: true,
  allowsNotes: false,
  allowsAlphaEvents: false,
  allowsSpeedEvents: false,
  allowsTexture: false,
  allowsMask: false,
  allowsAnchor: false,
  allowsZOrder: false,
  allowsUiBinding: false,
});

/** Line bound to a game UI element. */
const UI: JudgeLineTraits = Object.freeze({
  ...STANDARD,
  purpose: "ui",
  isUi: true,
  allowsNotes: false,
  allowsSpeedEvents: false,
  allowsTexture: false,
  allowsMask: false,
  allowsAnchor: false,
  allowsZOrder: false,
  allowsNoiseMode: false,
});

/** Text line: text events only. */
const TEXT: JudgeLineTraits = Object.freeze({
  ...STANDARD,
  purpose: "text",
  isText: true,
  allowsNotes: false,
  allowsSpeedEvents: false,
  allowsTexture: false,
  allowsMask: false,
  allowsAnchor: false,
  allowsUiBinding: false,
  allowsNoiseMode: false,
});

/** Traits for a missing line: every optional field is unavailable. */
const EMPTY: JudgeLineTraits = Object.freeze({
  ...STANDARD,
  allowsNotes: false,
  allowsAlphaEvents: false,
  allowsSpeedEvents: false,
  allowsTexture: false,
  allowsMask: false,
  allowsAnchor: false,
  allowsZOrder: false,
  allowsUiBinding: false,
  allowsNoiseMode: false,
});

/** Resolve the line purpose; noise and UI bindings take precedence over text. */
export function judgeLineTraits(line: JudgeLine | undefined): JudgeLineTraits {
  if (!line) {
    return EMPTY;
  }
  const noise = noiseLineSettings(line);
  if (noise) {
    return noise.invert ? { ...NOISE, noiseInverted: true } : NOISE;
  }
  if (line.attachUI) {
    return UI;
  }
  if (line.extended?.textEvents?.length) {
    return TEXT;
  }
  if (line.Texture && line.Texture !== "line.png") {
    return TEXTURE;
  }
  return STANDARD;
}

/** Intersection for batch editing: a field is shown only when every line keeps it. */
export function combineJudgeLineTraits(lines: readonly JudgeLine[]): JudgeLineTraits {
  if (!lines.length) {
    return EMPTY;
  }
  const traits = lines.map(judgeLineTraits);
  const first = traits[0];
  const every = (key: keyof JudgeLineTraits): boolean =>
    traits.every((entry) => entry[key] === true);
  return {
    purpose: traits.every((entry) => entry.purpose === first.purpose) ? first.purpose : "standard",
    noiseInverted: first.noiseInverted,
    isTexture: every("isTexture"),
    isNoise: every("isNoise"),
    isUi: every("isUi"),
    isText: every("isText"),
    allowsNotes: every("allowsNotes"),
    allowsAlphaEvents: every("allowsAlphaEvents"),
    allowsSpeedEvents: every("allowsSpeedEvents"),
    allowsTexture: every("allowsTexture"),
    allowsMask: every("allowsMask"),
    allowsAnchor: every("allowsAnchor"),
    allowsZOrder: every("allowsZOrder"),
    allowsUiBinding: every("allowsUiBinding"),
    allowsNoiseMode: every("allowsNoiseMode"),
  };
}

/** Whether new notes can be placed on this line. */
export function lineAllowsNotes(line: JudgeLine | undefined): boolean {
  return judgeLineTraits(line).allowsNotes;
}
