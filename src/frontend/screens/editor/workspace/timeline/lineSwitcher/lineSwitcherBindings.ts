/**
 * Creates the line-switcher controller and publishes its presentation snapshot plus
 * stable actions to the overlay components.
 *
 * This is the binding seam only; layout and chart logic stay in `LineSwitcher`.
 */
import { LineSwitcher } from "./lineSwitcher.ts";
import { createValue, type ValueCell } from "../../../../../../core/state/values.ts";
import type {
  LineSwitcherActions,
  LineSwitcherContext,
  LineSwitcherPresentation,
} from "./lineSwitcherTypes.ts";

export interface LineSwitcherViewState {
  readonly presentation: ValueCell<LineSwitcherPresentation | null>;
}

/** Creates the cell that publishes the switcher snapshot and actions. */
export function createLineSwitcherViewState(): LineSwitcherViewState {
  return Object.freeze({
    presentation: createValue<LineSwitcherPresentation | null>({ initial: null }),
  });
}

/** Publish stable feature actions independently of the changing display snapshot. */
export function createLineSwitcher(
  stage: HTMLElement,
  getContext: () => LineSwitcherContext,
  state: LineSwitcherViewState,
  { select = () => {} }: { select?: (index: number) => unknown } = {},
): LineSwitcher {
  let switcher: LineSwitcher | null = null;
  const actions: LineSwitcherActions = {
    setViewport(element) {
      if (switcher) {
        switcher.viewport = element;
      }
    },
    scroll: () => switcher?.renderWindow(),
    browse(row) {
      if (switcher) {
        switcher.browseRow = row;
        switcher.lastFrame = -Infinity;
        switcher.draw(performance.now());
      }
    },
    select: (index) => {
      switcher?.selectCard(index);
    },
    step(direction) {
      switcher?.step(direction);
      switcher?.show();
    },
    dismiss: () => switcher?.hide(),
  };
  const controller = new LineSwitcher(stage, getContext, {
    select,
    renderView: (snapshot) => {
      if (switcher) {
        state.presentation.set({ snapshot, actions });
      }
    },
    disposeView: () => state.presentation.set(null),
  });
  switcher = controller;
  controller.renderPanel();
  return controller;
}
