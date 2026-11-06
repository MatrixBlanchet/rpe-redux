/** View-state rules shared by the easing field's direction control. */

/** The native control state for a family that may not define directions. */
export interface EasingDirectionControlState {
  disabled: boolean;
  ariaDisabled: boolean | undefined;
  tabIndex: number | undefined;
}

/** Keep a directionless Linear placeholder readable without making it disabled. */
export function easingDirectionControlState(
  hasDirections: boolean,
  fieldDisabled: boolean,
): EasingDirectionControlState {
  if (fieldDisabled) {
    return { disabled: true, ariaDisabled: undefined, tabIndex: undefined };
  }
  if (!hasDirections) {
    return { disabled: false, ariaDisabled: true, tabIndex: -1 };
  }
  return { disabled: false, ariaDisabled: undefined, tabIndex: undefined };
}
