/**
 * Syntax-highlighted text field for curve equations.
 *
 * A transparent textarea owns editing and selection; the matching `<pre>` layer
 * paints the same string with token colors. Both layers share font, padding,
 * wrapping, and scroll offsets so the caret stays aligned with the colors.
 */
import { useMemo, useRef, type KeyboardEvent, type UIEvent } from "react";
import { Button } from "../../../../design/components/button/Button.tsx";
import { tokenizeEquation } from "./equationSyntax.ts";

/** Props for one syntax-highlighted equation field. */
export interface EquationEditorProps {
  value: string;
  onChange(value: string): void;
  ariaLabel: string;
  /** Applies to the native textarea so callers keep their existing test hooks. */
  className?: string;
  inputId?: string;
  multiline?: boolean;
  placeholder?: string;
  /** Receives the textarea node for palette insertion and focus management. */
  inputRef?: (node: HTMLTextAreaElement | null) => void;
  onFocus?(): void;
  autoFocus?: boolean;
  /** Opens the enlarged editor for this field. */
  onOpenEditor?(): void;
  /** Accessible name for the three-dot action. */
  actionLabel?: string;
}

/** One equation field with live token coloring. */
export function EquationEditor({
  value,
  onChange,
  ariaLabel,
  className = "",
  inputId,
  multiline = false,
  placeholder,
  inputRef,
  onFocus,
  autoFocus = false,
  onOpenEditor,
  actionLabel,
}: EquationEditorProps) {
  const highlight = useRef<HTMLPreElement>(null);
  const tokens = useMemo(() => tokenizeEquation(value), [value]);

  /** Keep the highlight layer aligned with the textarea's scroll offsets. */
  const syncScroll = (event: UIEvent<HTMLTextAreaElement>) => {
    const pre = highlight.current;
    if (!pre) {
      return;
    }
    pre.scrollTop = event.currentTarget.scrollTop;
    pre.scrollLeft = event.currentTarget.scrollLeft;
  };

  /** Keep a single-line equation from accepting a newline. */
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((event.ctrlKey || event.metaKey) && event.key === "Backspace") {
      event.preventDefault();
      onChange("");
      return;
    }
    if (!multiline && event.key === "Enter") {
      event.preventDefault();
    }
  };

  return (
    <div
      className={`curve-equation-editor${multiline ? " is-multiline" : ""}${
        onOpenEditor ? " has-action" : ""
      }`}
    >
      <pre ref={highlight} className="curve-equation-highlight" aria-hidden="true">
        {tokens.map((token, index) =>
          token.kind === "space" ? (
            token.text
          ) : (
            <span
              key={`${index}:${token.kind}`}
              className={`curve-equation-token is-${token.kind}`}
            >
              {token.text}
            </span>
          ),
        )}
        {value.endsWith("\n") ? "\n" : null}
      </pre>
      <textarea
        ref={(node) => {
          inputRef?.(node);
        }}
        id={inputId}
        className={`curve-equation-input ${className}`}
        aria-label={ariaLabel}
        value={value}
        placeholder={placeholder}
        rows={multiline ? 5 : 1}
        wrap={multiline ? "soft" : "off"}
        spellCheck={false}
        autoComplete="off"
        autoFocus={autoFocus}
        onChange={(event) => onChange(event.currentTarget.value)}
        onScroll={syncScroll}
        onKeyDown={onKeyDown}
        onFocus={onFocus}
      />
      {onOpenEditor ? (
        <Button
          type="button"
          variant="plain"
          className="curve-equation-more"
          aria-label={actionLabel}
          title={actionLabel}
          onClick={onOpenEditor}
        >
          ⋯
        </Button>
      ) : null}
    </div>
  );
}
