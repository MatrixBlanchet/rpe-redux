/**
 * Roving keyboard behaviour for a single-select listbox.
 *
 * The listbox keeps focus while `aria-activedescendant` names the active option;
 * Arrow keys, Home, and End move the active option, and Enter or Space selects
 * it. Callers render the options and keep their own layout and labels.
 */
import { useEffect, useState, type KeyboardEvent } from "react";

export interface ListboxOptionProps {
  id: string;
  role: "option";
  "aria-selected": boolean;
  tabIndex: -1;
  onPointerMove(): void;
  onClick(): void;
}

export interface ListboxController {
  activeIndex: number;
  setActiveIndex(index: number): void;
  listProps: {
    tabIndex: 0;
    "aria-activedescendant": string | undefined;
    onKeyDown(event: KeyboardEvent<HTMLElement>): void;
  };
  optionProps(index: number): ListboxOptionProps;
}

/** The next active option for a navigation key, or `null` when the key does not move. */
export function listboxNavigation(key: string, active: number, count: number): number | null {
  if (count <= 0) {
    return null;
  }
  if (key === "ArrowDown" || key === "ArrowRight") {
    return (active + 1) % count;
  }
  if (key === "ArrowUp" || key === "ArrowLeft") {
    return (active - 1 + count) % count;
  }
  if (key === "Home") {
    return 0;
  }
  if (key === "End") {
    return count - 1;
  }
  return null;
}

/** Build roving focus and selection handlers for one listbox. */
export function useListbox({
  count,
  selected,
  onSelect,
  idPrefix,
}: {
  count: number;
  selected: number;
  onSelect(index: number): void;
  idPrefix: string;
}): ListboxController {
  const [active, setActive] = useState(selected >= 0 && selected < count ? selected : 0);
  useEffect(() => {
    if (selected >= 0 && selected < count) {
      setActive(selected);
    }
  }, [count, selected]);
  useEffect(() => {
    if (active >= count) {
      setActive(Math.max(0, count - 1));
    }
  }, [active, count]);

  /** Move the active option and select only on Enter or Space. */
  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    const next = listboxNavigation(event.key, active, count);
    if (next !== null) {
      event.preventDefault();
      setActive(next);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect(active);
    }
  };

  return {
    activeIndex: active,
    setActiveIndex: setActive,
    listProps: {
      tabIndex: 0,
      "aria-activedescendant": count ? `${idPrefix}-${active}` : undefined,
      onKeyDown,
    },
    optionProps: (index) => ({
      id: `${idPrefix}-${index}`,
      role: "option",
      "aria-selected": selected === index,
      tabIndex: -1,
      onPointerMove: () => setActive(index),
      onClick: () => {
        setActive(index);
        onSelect(index);
      },
    }),
  };
}
