/**
 * Colour swatch input with a readable hex readout.
 *
 * Settings rows, collaboration profiles, and any future colour field share the
 * same square swatch and WCAG-contrast ink decision; callers supply the label
 * and write the value back.
 */
import { Input } from "./Input.tsx";
import { colorInk, normalizeColor } from "./colorModel.ts";

export interface ColorFieldProps {
  id?: string;
  value: string;
  disabled?: boolean;
  onChange(value: string): void;
  describedBy?: string;
  /** Tooltip content for the swatch input. */
  tipDescription?: string;
  className?: string;
}

/** Renders a colour swatch plus its hex readout in the higher-contrast ink. */
export function ColorField({
  id,
  value,
  disabled,
  onChange,
  describedBy,
  tipDescription,
  className = "",
}: ColorFieldProps) {
  const color = normalizeColor(value);
  return (
    <span className={`redux-color-field${className ? ` ${className}` : ""}`}>
      <span className="redux-color-swatch">
        <Input
          id={id}
          type="color"
          value={color}
          disabled={disabled}
          aria-describedby={describedBy}
          tipDescription={tipDescription}
          onChange={(event) => onChange(event.currentTarget.value)}
        />
        <output className="redux-color-hex" data-ink={colorInk(color)}>
          {color}
        </output>
      </span>
    </span>
  );
}
