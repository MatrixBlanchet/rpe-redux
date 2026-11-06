/**
 * One line-switcher card: renders the prepared line labels and paints its thumbnail
 * canvas on layout.
 *
 * It is memoized and presentational; selection is forwarded by index to the overlay.
 */
import { memo, useLayoutEffect, useRef } from "react";
import { ListRow } from "../../../../../../design/components/list/ListRow.tsx";
import { drawLineThumbnail } from "./lineThumbnail.ts";
import type { LineSwitcherCardSnapshot } from "./lineSwitcherTypes.ts";

/** One line-switcher card with its prepared labels and painted thumbnail. */
export const LineSwitcherCard = memo(function LineSwitcherCard({
  card,
  onSelect,
}: {
  card: LineSwitcherCardSnapshot;
  onSelect(index: number): void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    if (canvas.current && card.thumbnail.sample) {
      drawLineThumbnail(canvas.current, card.thumbnail);
    }
  }, [card.thumbnail]);
  return (
    <ListRow
      as="button"
      type="button"
      tabIndex={-1}
      selected={card.selected}
      className="line-switcher-card"
      aria-current={card.selected ? "true" : "false"}
      onKeyDown={(event) => {
        if (["Tab", "Enter", " "].includes(event.key)) {
          event.preventDefault();
          event.stopPropagation();
        }
      }}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onSelect(card.index);
      }}
    >
      <strong>
        <span className="line-switcher-number">{card.titleNumber}</span>
        <span className="line-switcher-line-group">{card.lineGroup}</span>
        <span className="line-switcher-line-name">{card.name}</span>
      </strong>
      <canvas ref={canvas} width={240} height={90} aria-hidden="true" />
      <small>{card.info}</small>
    </ListRow>
  );
});
