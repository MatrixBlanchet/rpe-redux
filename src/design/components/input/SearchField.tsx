/**
 * Composite search field: leading glyph, borderless input, and the shared clear
 * action. It owns the native search-cancel suppression and the shell focus ring,
 * so a search surface does not rebuild the same markup and feature CSS.
 */
import { Icon } from "../icon/Icon.tsx";
import { IconButton } from "../button/IconButton.tsx";

export interface SearchFieldProps {
  value: string;
  onChange(value: string): void;
  /** Accessible name for the input and the clear action. */
  label: string;
  placeholder?: string;
  /** Optional id for the inner input. */
  inputId?: string;
  /** Shell class supplied by the surface that places the field. */
  className?: string;
  /** Clears the field; the caller owns the text. */
  clearLabel?: string;
  size?: "default" | "compact";
  autoFocus?: boolean;
}

/** Renders one search shell with its clear action. */
export function SearchField({
  value,
  onChange,
  label,
  placeholder,
  inputId,
  className = "",
  clearLabel = "",
  size = "default",
  autoFocus = false,
}: SearchFieldProps): React.JSX.Element {
  return (
    <div
      className={`redux-search-field redux-input-shell${
        size === "compact" ? " redux-search-field-compact" : ""
      }${className ? ` ${className}` : ""}`}
    >
      <Icon name="search" size={size === "compact" ? 14 : 16} />
      <input
        id={inputId}
        type="search"
        className="redux-search-field-input"
        value={value}
        placeholder={placeholder}
        aria-label={label}
        autoComplete="off"
        spellCheck={false}
        autoFocus={autoFocus}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
      {value && (
        <IconButton
          icon="close"
          size={12}
          compact
          className="redux-search-field-clear"
          label={clearLabel || label}
          onClick={() => onChange("")}
        />
      )}
    </div>
  );
}
