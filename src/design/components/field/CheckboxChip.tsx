/**
 * A labelled checkbox chip: the native checkbox with a compact clickable
 * surface around it. Use it when a control is a single on/off permission rather
 * than a full field row; the label is part of the hit target.
 */
import { Input } from "../input/Input.tsx";

export type CheckboxChipTone = "default" | "accent";

export interface CheckboxChipProps {
  id: string;
  label: string;
  checked: boolean;
  onChange(checked: boolean): void;
  disabled?: boolean;
  /** Accent surface for a companion permission such as AI access. */
  tone?: CheckboxChipTone;
  describedBy?: string;
  /** Shared tooltip title; the label carries the annotation for the host. */
  tip?: string;
  /** Optional tooltip content, shown below the title. */
  tipDescription?: string;
}

/** Draw one labelled checkbox as a compact chip. */
export function CheckboxChip({
  id,
  label,
  checked,
  onChange,
  disabled = false,
  tone = "default",
  describedBy,
  tip,
  tipDescription,
}: CheckboxChipProps) {
  return (
    <label
      className="redux-checkbox-chip"
      data-tone={tone}
      htmlFor={id}
      data-tip-title={tip}
      data-tip-desc={tipDescription}
    >
      <Input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        aria-describedby={describedBy}
        onChange={(event) => onChange(event.currentTarget.checked)}
      />
      <span className="redux-checkbox-chip-label">{label}</span>
    </label>
  );
}
