/**
 * Composes the line-switcher body from its scrolling card viewport.
 *
 * The floating host and dismissal live in `LineSwitcherOverlay`; this view only
 * forwards the presentation actions.
 */
import { LineSwitcherViewport } from "./LineSwitcherViewport.tsx";
import type {
  LineSwitcherContentActions,
  LineSwitcherViewportSnapshot,
} from "./lineSwitcherTypes.ts";

export interface LineSwitcherViewProps {
  viewport: LineSwitcherViewportSnapshot;
  actions: LineSwitcherContentActions;
}

/** Compose the switcher body from its scrolling card viewport. */
export function LineSwitcherView({ viewport, actions }: LineSwitcherViewProps) {
  return (
    <LineSwitcherViewport
      viewport={viewport}
      setViewport={actions.setViewport}
      onScroll={actions.scroll}
      onSelect={actions.select}
    />
  );
}
