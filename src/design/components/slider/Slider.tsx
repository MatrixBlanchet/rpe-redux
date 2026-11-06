/**
 * Shared range-slider primitive for settings and editor controls.
 *
 * It owns the input type and delegates track/thumb styling to the design system;
 * callers supply the numeric value, bounds, and change callback. It contains no
 * setting-specific labels or product defaults, keeping slider behavior uniform.
 */
import { forwardRef, type InputHTMLAttributes } from "react";
import { Input } from "../input/Input.tsx";
/** A range input using the shared slider surface. */
export const Slider = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Slider(props, ref) {
    return <Input {...props} ref={ref} type="range" />;
  },
);
