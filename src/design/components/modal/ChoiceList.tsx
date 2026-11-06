/**
 * Modal choice-list primitive: a column of mutually exclusive answers for
 * "which one" questions. It holds no state; callers own the choices, labels, and
 * selected answer.
 */
import { Button } from "../button/Button.tsx";

export interface Choice {
  key: number;
  label: string;
  disabled?: boolean;
  selected?: boolean;
}

/**
 * A column of mutually exclusive answers.
 *
 * The modal counterpart to a message box: it is what a modal puts in its
 * content area when the question is "which one" rather than "yes or no". It holds
 * no state of its own — the caller owns the list, the labels and the answer.
 */
export function ChoiceList({
  choices,
  onChoose,
}: {
  choices: readonly Choice[];
  onChoose(key: number): void;
}) {
  return (
    <>
      {choices.map(({ key, label, disabled = false, selected = false }) => (
        <Button
          key={key}
          type="button"
          variant="plain"
          className="modal-choice"
          disabled={disabled}
          autoFocus={selected}
          aria-pressed={selected}
          data-selected={selected ? "true" : undefined}
          onClick={() => onChoose(key)}
        >
          {label}
        </Button>
      ))}
    </>
  );
}
