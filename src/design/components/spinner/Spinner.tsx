/**
 * Indeterminate progress ring.
 *
 * Shared because every async surface wants the same thing: a sign that work is
 * happening, painted in the theme's own colour. `label` is the only text and it
 * is announced rather than drawn, so a caller that already shows a status line
 * can pass a short phrase without duplicating it visually.
 *
 * `className` exists for the overlay variant: when a spinner is laid on top of
 * the thing it is loading, the caller owns that box, so the positioning belongs
 * with the caller and only `.redux-spinner-overlay` lives in the design layer.
 */
/** An indeterminate progress ring whose label is announced but not drawn. */
export function Spinner({
  label,
  className = "",
}: {
  label: string;
  className?: string;
}): React.JSX.Element {
  return (
    <span className={`redux-spinner ${className}`} role="status">
      <span className="redux-spinner-ring" aria-hidden="true" />
      <span className="redux-visually-hidden">{label}</span>
    </span>
  );
}
