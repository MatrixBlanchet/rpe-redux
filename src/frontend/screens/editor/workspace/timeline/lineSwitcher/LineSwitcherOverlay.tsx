/**
 * Floating line-switcher host: browser dismissal and presentation wiring; the
 * switcher content owns only feature actions.
 */
import { useEffect, useRef, type CSSProperties } from "react";
import { useEditorRuntimeValue } from "../../runtime/composition/EditorRuntime.tsx";
import { LineSwitcherView } from "./LineSwitcherView.tsx";

/** Own the floating host and browser dismissal; the content only sees feature actions. */
export function LineSwitcherOverlay() {
  const presentation = useEditorRuntimeValue(
    (runtime) => runtime.ui.lineSwitcher.presentation,
    null,
  );
  const host = useRef<HTMLElement>(null);
  const actions = presentation?.actions;
  useEffect(() => {
    const element = host.current;
    if (!element || !actions) {
      return;
    }
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      event.stopPropagation();
      if (event.deltaY) {
        actions.step(event.deltaY);
      }
    };
    const keyUp = (event: KeyboardEvent) => {
      if (["Control", "Meta"].includes(event.key)) {
        actions.dismiss();
      }
    };
    const outside = (event: PointerEvent) => {
      if (!element.contains(event.target as Node | null)) {
        actions.dismiss();
      }
    };
    element.addEventListener("wheel", wheel, { passive: false });
    window.addEventListener("keyup", keyUp, true);
    window.addEventListener("blur", actions.dismiss);
    window.addEventListener("pointerdown", outside, true);
    return () => {
      element.removeEventListener("wheel", wheel);
      window.removeEventListener("keyup", keyUp, true);
      window.removeEventListener("blur", actions.dismiss);
      window.removeEventListener("pointerdown", outside, true);
    };
  }, [actions]);
  const snapshot = presentation?.snapshot;
  return (
    <section
      ref={host}
      className="line-switcher"
      hidden={!snapshot?.visible}
      style={
        snapshot
          ? ({
              top: `${snapshot.host.top}px`,
              transform: "translateX(-50%)",
              width: `${snapshot.host.width}px`,
              "--thumbnail-height": `${snapshot.host.thumbnailHeight}px`,
            } as CSSProperties)
          : undefined
      }
    >
      {presentation && (
        <div onPointerDownCapture={(event) => event.stopPropagation()}>
          <LineSwitcherView
            viewport={presentation.snapshot.viewport}
            actions={presentation.actions}
          />
        </div>
      )}
    </section>
  );
}
