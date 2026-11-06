/**
 * Renders the line-switcher's scrollable card grid, including the sized content
 * spacer, column count, and empty state.
 *
 * Scroll and card selection are forwarded to the controller through the supplied
 * actions.
 */
import { useTranslation } from "../../../../../../i18n/react.ts";
import { LineSwitcherCard } from "./LineSwitcherCard.tsx";
import type {
  LineSwitcherContentActions,
  LineSwitcherViewportSnapshot,
} from "./lineSwitcherTypes.ts";

/** Render the switcher's scrollable card grid, spacer, and empty state. */
export function LineSwitcherViewport({
  viewport,
  setViewport,
  onScroll,
  onSelect,
}: {
  viewport: LineSwitcherViewportSnapshot;
  setViewport: LineSwitcherContentActions["setViewport"];
  onScroll(): void;
  onSelect(index: number): void;
}) {
  const { t } = useTranslation();
  return (
    <div
      className="line-switcher-viewport"
      ref={setViewport}
      style={{ height: `${viewport.height}px` }}
      onScroll={onScroll}
    >
      <div className="line-switcher-content" style={{ height: `${viewport.contentHeight}px` }}>
        <div
          className="line-switcher-grid"
          style={{
            top: `${viewport.gridTop}px`,
            gridTemplateColumns: `repeat(${viewport.columns}, minmax(0, 1fr))`,
          }}
        >
          {viewport.cards.map((card) => (
            <LineSwitcherCard key={card.index} card={card} onSelect={onSelect} />
          ))}
        </div>
      </div>
      <div className="line-switcher-empty" hidden={!viewport.empty} role="status">
        {t("editorPanels.lineSwitcher.empty")}
      </div>
    </div>
  );
}
