/**
 * One judge-line selector folder header.
 *
 * The toolbar picker and the multi-line pane render the same folder anatomy:
 * a disclosure and the batch-select name. The shared view keeps both selectors
 * on one visual and interaction contract without adding a second count column.
 */
import { Button } from "../../../../design/components/button/Button.tsx";
import { IconButton } from "../../../../design/components/button/IconButton.tsx";
import { useTranslation } from "../../../../i18n/react.ts";

export interface LineSelectionGroupHeaderProps {
  name: string;
  folded: boolean;
  all: boolean;
  /** Number of selected rows, used only to distinguish all/some/none. */
  picked: number;
  groupAction: string;
  onToggle(): void;
  onSelect(): void;
}

/** Disclosure and group name for one selector folder. */
export function LineSelectionGroupHeader({
  name,
  folded,
  all,
  picked,
  groupAction,
  onToggle,
  onSelect,
}: LineSelectionGroupHeaderProps) {
  const { t } = useTranslation();
  return (
    <div
      className="line-selection-group-head"
      data-state={all ? "all" : picked > 0 ? "some" : "none"}
      onClick={(event) => {
        // The name and disclosure own their presses; the blank part of the
        // header still toggles the group.
        if (event.target instanceof Element && event.target.closest("button")) {
          return;
        }
        onSelect();
      }}
    >
      <IconButton
        icon="chevronDown"
        size={12}
        variant="plain"
        className="line-selection-group-disclosure"
        aria-expanded={!folded}
        label={t(
          folded ? "chrome.toolbar.lineSelectionExpand" : "chrome.toolbar.lineSelectionCollapse",
          { name },
        )}
        data-tip-title={t(folded ? "common.action.expand" : "common.action.collapse")}
        onClick={(event) => {
          event.stopPropagation();
          onToggle();
        }}
      />
      <Button
        type="button"
        variant="plain"
        className="line-selection-group-name"
        aria-label={groupAction}
        aria-pressed={all}
        data-tip-desc={groupAction}
        onClick={onSelect}
      >
        <span className="line-selection-group-label">{name}</span>
      </Button>
    </div>
  );
}
