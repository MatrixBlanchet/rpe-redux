/**
 * Root of the torn-off performance HUD window.
 *
 * The native companion window loads this module in its own WebView and renders the
 * same HUD with the design styles loaded.
 */
import "../../../design/styles/index.less";
import { useTooltipHost } from "../../../design/patterns/TooltipHost.tsx";
import { PerformanceHud } from "./PerformanceHud.tsx";

/** The native companion window renders the same HUD surface in its own WebView. */
export function PerformanceHudWindow() {
  const tooltip = useTooltipHost();
  return (
    <main className="redux-performance-hud-window">
      <PerformanceHud detached />
      {tooltip.element}
    </main>
  );
}
