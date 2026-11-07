/** View-state rules shared by the easing field's direction control. */

/** The native control state for a family that may not define directions. */
export interface EasingDirectionControlState {
  disabled: boolean;
  ariaDisabled: boolean | undefined;
  tabIndex: number | undefined;
}

/** Disable a directionless Linear placeholder while keeping its value visible. */
export function easingDirectionControlState(
  hasDirections: boolean,
  fieldDisabled: boolean,
): EasingDirectionControlState {
  if (fieldDisabled) {
    return { disabled: true, ariaDisabled: undefined, tabIndex: undefined };
  }
  if (!hasDirections) {
    return { disabled: true, ariaDisabled: undefined, tabIndex: undefined };
  }
  return { disabled: false, ariaDisabled: undefined, tabIndex: undefined };
}
