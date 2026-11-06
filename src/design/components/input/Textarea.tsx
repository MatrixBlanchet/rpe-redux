/**
 * Multiline text field primitive.
 *
 * It owns the shared input surface plus the multiline sizing class, so prompt
 * bodies, schema text fields, and code blocks do not repeat the same class list
 * or forget the field padding. Callers own value, validation, and labels.
 */
import { forwardRef, type TextareaHTMLAttributes } from "react";

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

/** The shared multiline field; forwards its ref to the native element. */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className = "", ...props },
  ref,
) {
  return (
    <textarea
      ref={ref}
      className={`redux-input redux-field-textarea ${className}`.trim()}
      {...props}
    />
  );
});
