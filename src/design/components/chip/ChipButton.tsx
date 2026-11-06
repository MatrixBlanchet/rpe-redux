/**
 * Compact pill action for a badge, marker, or filter that must read as a chip
 * rather than a page button. It uses the shared button semantics and adds the
 * pill silhouette, icon slot, and compact type role.
 */
import { Button, type ButtonProps } from "../button/Button.tsx";
import { Icon, type IconName } from "../icon/Icon.tsx";

export interface ChipButtonProps extends Omit<ButtonProps, "children"> {
  icon?: IconName;
  iconSource?: string;
  children: React.ReactNode;
}

/** A pill-shaped button with an optional leading glyph. */
export function ChipButton({
  icon,
  iconSource,
  className = "",
  children,
  ...props
}: ChipButtonProps): React.JSX.Element {
  return (
    <Button
      {...props}
      variant="outlined"
      size="sm"
      density="compact"
      iconText={Boolean(icon)}
      className={`redux-chip-button ${className}`.trim()}
    >
      {icon && <Icon name={icon} size={14} source={iconSource} />}
      <span className="redux-button-label">{children}</span>
    </Button>
  );
}
