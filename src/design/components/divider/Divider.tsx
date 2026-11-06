/** Axis-aligned hairline separator shared by toolbar and inspector rows. */
export function Divider({ axis = "y" }: { axis?: "x" | "y" }) {
  return <span className={`redux-divider redux-divider-${axis}`} aria-hidden="true" />;
}
