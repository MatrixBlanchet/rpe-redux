/**
 * Keyboard hints: one key cap, a row of them, and the shortcut model's own view
 * of both.
 *
 * `Kbd` draws a stroke, `KbdBindings` draws the bindings of one shortcut, and
 * `ShortcutBindings` takes the model itself. Only the last of them knows
 * `core`'s `Shortcut`; `shortcutChips.ts` beside this file turns a value into
 * strokes, so the rest of `core` never learns what a chip looks like.
 */
import type { HTMLAttributes } from "react";
import type { Shortcut } from "../../../core/shortcuts/types.ts";
import { shortcutChips } from "./shortcutChips.ts";

export interface KbdStroke {
  ctrl?: boolean;
  alt?: boolean;
  shift?: boolean;
  meta?: boolean;
  /** The key's own label, already written for this platform. */
  keyLabel: string;
}

export interface KbdProps extends Omit<HTMLAttributes<HTMLElement>, "children">, KbdStroke {}

/** One chord drawn as key caps in written order. */
export function Kbd({
  className = "",
  ctrl = false,
  alt = false,
  shift = false,
  meta = false,
  keyLabel,
  ...props
}: KbdProps) {
  const parts = [
    ...(ctrl ? ["Ctrl"] : []),
    ...(alt ? ["Alt"] : []),
    ...(shift ? ["Shift"] : []),
    ...(meta ? ["Meta"] : []),
    keyLabel,
  ];
  if (!parts.length) {
    return null;
  }
  return (
    <kbd className={`redux-kbd ${className}`.trim()} {...props}>
      {parts.map((part, index) => (
        <span className="redux-kbd-part" key={`${part}:${index}`}>
          {index > 0 && (
            <span className="redux-kbd-plus" aria-hidden="true">
              +
            </span>
          )}
          {part}
        </span>
      ))}
    </kbd>
  );
}

/** Renders each binding as a chip; distinct bindings are separated only by gap. */
export function KbdBindings({
  strokes,
  className = "",
}: {
  strokes: readonly KbdStroke[];
  className?: string;
}) {
  return (
    <span className={`redux-kbd-group ${className}`.trim()}>
      {strokes.map((stroke, index) => (
        <Kbd {...stroke} key={`${stroke.keyLabel}:${index}`} />
      ))}
    </span>
  );
}

/** The same row, handed the model instead of strokes. */
export function ShortcutBindings({
  bindings,
  className = "",
}: {
  bindings: readonly Shortcut[];
  className?: string;
}) {
  return <KbdBindings strokes={shortcutChips(bindings)} className={className} />;
}
