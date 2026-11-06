/**
 * The preview's game-UI overlay: where each HUD element sits, and what feeds it.
 *
 * The seven elements are a chart's `attachUI` targets. They are authored against a
 * 1920x1080 stage, so the positions below are fractions of that space, projected
 * onto the logical chart box the judge lines are authored in — which is why
 * `gameUiLayout` needs the logical size: an element pinned to a stage edge follows
 * that edge as the box changes shape, while a centred one does not.
 *
 * This is presentation geometry, not chart knowledge: it says where the overlay
 * draws. It sits with the frontend preview because no core module reads it.
 */
import type { JudgeLine } from "../../../../../../core/global/chart/chart.ts";
import { noiseLineSettings } from "../../../../../../core/global/chart/noise/noiseLine.ts";
import type { LineState } from "../../../../../../core/global/chart/runtime/scene.ts";
import type { MessageKey } from "../../../../../../i18n/index.ts";
import { PREVIEW_LOGICAL_SIZE } from "../scene/constants.ts";

interface GameUiLayoutSpec {
  /** The message used by the inspector when assigning this overlay element. */
  binding: MessageKey;
  /** Left position as a fraction of the 1920px authoring width, before projection. */
  x: number;
  /** Top position as a fraction of the 1080px authoring height, before projection. */
  y: number;
  /** Which point of the element `x` pins: 0 = its left edge, 0.5 = its centre, 1 = its right edge. */
  anchorX: number;
  /** Vertical counterpart of `anchorX`. */
  anchorY: number;
  /** Stage edge the element follows when the box is wider than 16:9: -1 left, 0 centred, 1 right. */
  edgeX: number;
  /** Vertical counterpart of `edgeX`, for a box taller than 16:9. */
  edgeY: number;
  /** Element width in authoring pixels; absent means the element sizes itself. */
  width?: number;
  /** Element height in authoring pixels, for the elements that draw a box. */
  height?: number;
  /** Text size in authoring pixels, for the elements that draw text. */
  fontSize?: number;
}

/** One overlay element with its projected position in chart units. */
export interface GameUiItem extends GameUiLayoutSpec {
  key: GameUiKey;
}

/** The canonical overlay catalog: key, inspector binding, and projected layout. */
const layout = {
  pause: {
    binding: "editor.display.gameUi.bindingPause",
    x: 0.021,
    y: 0.838,
    anchorX: 0,
    anchorY: 1,
    width: 42,
    height: 42,
    edgeX: -1,
    edgeY: 1,
  },
  combonumber: {
    binding: "editor.display.gameUi.bindingComboNumber",
    // Sits a little lower than the chart's authored point: the number and its label are
    // the first thing a player looks at, and pinned at the authored height they hugged
    // the top edge of the preview.
    x: 0.3516,
    y: 0.805,
    anchorX: 0.5,
    anchorY: 0.5,
    fontSize: 67,
    edgeX: 0,
    edgeY: 1,
  },
  combo: {
    binding: "editor.display.gameUi.bindingCombo",
    x: 0.3516,
    y: 0.7633,
    anchorX: 0.5,
    anchorY: 0.5,
    fontSize: 35,
    edgeX: 0,
    edgeY: 1,
  },
  score: {
    binding: "editor.display.gameUi.bindingScore",
    // Keep the score just below the frame's top edge; the authored point sits a
    // little high once the HUD is projected into a 16:9 preview.
    x: 0.6855,
    y: 0.83,
    anchorX: 1,
    anchorY: 1,
    fontSize: 49,
    edgeX: 1,
    edgeY: 1,
  },
  bar: {
    binding: "editor.display.gameUi.bindingBar",
    x: 0,
    y: 0.863,
    anchorX: 0,
    anchorY: 0.5,
    height: 8,
    edgeX: -1,
    edgeY: 1,
  },
  name: {
    binding: "editor.display.gameUi.bindingName",
    x: 0.02,
    y: 0.05417,
    anchorX: 0,
    anchorY: 0,
    fontSize: 35,
    edgeX: -1,
    edgeY: -1,
  },
  level: {
    binding: "editor.display.gameUi.bindingLevel",
    x: 0.6855,
    y: 0.05417,
    anchorX: 1,
    anchorY: 0,
    fontSize: 33,
    edgeX: 1,
    edgeY: -1,
  },
} as const satisfies Record<string, GameUiLayoutSpec>;

/** Overlay keys the game UI knows how to place. */
export type GameUiKey = keyof typeof layout;

/** The `attachUI` values the overlay knows how to place, derived from `layout`. */
export const GAME_UI_KEYS = Object.keys(layout) as GameUiKey[];
/** Each key beside the message the inspector labels it with. Derived, so it cannot drift. */
export const GAME_UI_BINDING_LABELS = GAME_UI_KEYS.map(
  (key) => [key, layout[key].binding] as const,
);

const bindingKeys: ReadonlySet<string> = new Set(GAME_UI_KEYS);

/** Narrows an arbitrary `attachUI` string to a known overlay key. */
export function isGameUiKey(value: string): value is GameUiKey {
  return bindingKeys.has(value);
}

/**
 * Projects the canonical 1920×1080 layout onto a logical chart box.
 *
 * Edge-anchored elements follow the box edge; centred elements stay centred.
 */
export function gameUiLayout(logicalWidth: number, logicalHeight: number): GameUiItem[] {
  return GAME_UI_KEYS.map((key) => {
    const item = layout[key];
    return {
      ...item,
      key,
      x:
        item.x * 1920 -
        PREVIEW_LOGICAL_SIZE.width / 2 +
        (item.edgeX * (logicalWidth - PREVIEW_LOGICAL_SIZE.width)) / 2,
      y:
        item.y * 1080 -
        PREVIEW_LOGICAL_SIZE.height * 0.54 +
        (item.edgeY * (logicalHeight - PREVIEW_LOGICAL_SIZE.height)) / 2,
    };
  });
}

/** One HUD element bound to the line currently driving it. */
export interface GameUiBinding extends LineState {
  lineIndex: number;
}

/** Maps each `attachUI` key to the line state that currently drives it. */
export function gameUiBindings(
  chart: { judgeLineList?: readonly JudgeLine[] },
  states: readonly (LineState | undefined)[],
): Map<string, GameUiBinding> {
  const result = new Map<string, GameUiBinding>();
  for (const [index, line] of (chart.judgeLineList ?? []).entries()) {
    const key = line.attachUI;
    const state = states[index];
    // A noise line never drives a HUD element, even when an imported chart
    // assigns it an `attachUI` value.
    if (key === undefined || !state || !isGameUiKey(key) || noiseLineSettings(line)) {
      continue;
    }
    result.set(key, { ...state, lineIndex: index });
  }
  return result;
}
