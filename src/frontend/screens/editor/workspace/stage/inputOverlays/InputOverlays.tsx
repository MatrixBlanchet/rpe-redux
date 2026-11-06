/**
 * Renders the optional key-press label and mouse trail above the workspace.
 * Input capture policy stays in the model modules; this component owns the
 * listeners, animation frame, and DOM nodes.
 */
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { hasOpenModal } from "../../../../../../design/components/modal/Modal.tsx";
import { isTextEntry } from "../../../../../platform/shortcuts/focus.ts";
import { useSetting } from "../../../../settings/useSetting.ts";
import {
  KEY_PRESS_LABEL_FADE_MS,
  advanceInputOverlayState,
  createInputOverlayState,
  pressKeyLabel,
  releaseKeyLabel,
} from "./inputOverlayModel.ts";
import { MouseTrailRuntime } from "./mouseTrailModel.ts";
import { createMouseTrailPathRender } from "./mouseTrailRendering.ts";
import { FrameCadence } from "../../runtime/frame/frameCadence.ts";

/** Human-readable label for a pressed key. */
function keyLabel(event: KeyboardEvent): string {
  if (event.key === " ") {
    return "Space";
  }
  if (event.key === "Unidentified") {
    return "";
  }
  return event.key.length === 1 ? event.key.toUpperCase() : event.key;
}

/** Whether a key event belongs to a modal, text field, or menu rather than the stage. */
function ignoredKeyEvent(event: KeyboardEvent): boolean {
  const target = event.target instanceof HTMLElement ? event.target : null;
  return Boolean(
    hasOpenModal() ||
    isTextEntry(target) ||
    target?.closest('[role="menu"], [role="menubar"], [role="dialog"]'),
  );
}

/** Pointer position in client pixels, or null when the event carries no position. */
function pointerPosition(event: PointerEvent): { x: number; y: number } | null {
  if (!Number.isFinite(event.clientX) || !Number.isFinite(event.clientY)) {
    return null;
  }
  return { x: event.clientX, y: event.clientY };
}

/** Renders whichever optional input overlays the settings enable. */
export function InputOverlays() {
  const keyEnabled = useSetting("key-press-label-enabled", false);
  const trailEnabled = useSetting("mouse-trail-enabled", false);
  if (!keyEnabled && !trailEnabled) {
    return null;
  }
  return (
    <div className="input-overlays" data-input-overlay aria-hidden="true">
      {keyEnabled && <KeyPressLabelOverlay />}
      {trailEnabled && <MouseTrailOverlay />}
    </div>
  );
}

/** Shows the most recent key press and fades it after release. */
function KeyPressLabelOverlay() {
  const [state, setState] = useState(createInputOverlayState);
  const [now, setNow] = useState(() => performance.now());

  useEffect(() => {
    /** Shows a label for an eligible key press. */
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.isComposing || ignoredKeyEvent(event)) {
        return;
      }
      const label = keyLabel(event);
      if (!label) {
        return;
      }
      setState((current) =>
        pressKeyLabel(current, event.code || event.key, label, performance.now()),
      );
    };
    /** Starts the fade for the released key. */
    const onKeyUp = (event: KeyboardEvent) => {
      setState((current) => releaseKeyLabel(current, event.code || event.key, performance.now()));
    };
    /** Removes the label when the window loses focus. */
    const clearKey = () => {
      setState((current) => (current.key ? { ...current, key: null } : current));
    };
    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("keyup", onKeyUp, true);
    window.addEventListener("blur", clearKey);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("keyup", onKeyUp, true);
      window.removeEventListener("blur", clearKey);
    };
  }, []);

  useEffect(() => {
    const key = state.key;
    if (!key || key.releasedAt === null) {
      return;
    }
    const timer = window.setTimeout(
      () => {
        const timestamp = performance.now();
        setNow(timestamp);
        setState((current) =>
          advanceInputOverlayState(current, timestamp, {
            keyEnabled: true,
          }),
        );
      },
      Math.max(16, key.releasedAt + KEY_PRESS_LABEL_FADE_MS - performance.now()),
    );
    return () => window.clearTimeout(timer);
  }, [state]);

  const key = state.key;
  if (!key) {
    return null;
  }
  return (
    <output
      className={`key-press-label${key.releasedAt === null ? "" : " is-released"}`}
      style={
        {
          "--key-label-age": `${Math.max(0, now - (key.releasedAt ?? now))}ms`,
        } as CSSProperties
      }
      data-key-press-label
    >
      {key.label}
    </output>
  );
}

/** Draws the pointer trail on a full-window canvas. */
function MouseTrailOverlay() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) {
      return;
    }

    const runtime = new MouseTrailRuntime();
    const cadence = new FrameCadence();
    let frameId = 0;
    let disposed = false;

    const clearCanvas = () => {
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.clearRect(0, 0, canvas.width, canvas.height);
    };

    /** Matches the canvas bitmap to its CSS size and returns CSS dimensions. */
    const prepare = () => {
      const ratio = globalThis.devicePixelRatio || 1;
      const width = Math.max(1, canvas.clientWidth);
      const height = Math.max(1, canvas.clientHeight);
      if (
        canvas.width !== Math.round(width * ratio) ||
        canvas.height !== Math.round(height * ratio)
      ) {
        canvas.width = Math.round(width * ratio);
        canvas.height = Math.round(height * ratio);
      }
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      return { width, height };
    };

    /** Advances the trail and repaints it until the tail has faded out. */
    const render = (timestamp: number) => {
      frameId = 0;
      if (disposed) {
        return;
      }
      if (!cadence.allow(timestamp, 60)) {
        if (runtime.pointCount > 0) {
          frameId = requestAnimationFrame(render);
        }
        return;
      }
      const frame = runtime.advance(timestamp);
      const { width, height } = prepare();
      context.clearRect(0, 0, width, height);
      if (frame.samples.length >= 2) {
        const pathRender = createMouseTrailPathRender(frame.samples);
        context.globalAlpha = Number(pathRender.opacity);
        context.fillStyle = getComputedStyle(canvas).color;
        context.fill(new Path2D(pathRender.d));
        context.globalAlpha = 1;
      }
      if (runtime.pointCount > 0) {
        frameId = requestAnimationFrame(render);
      }
    };

    /** Starts the paint loop when one is not already pending. */
    const schedule = () => {
      if (!frameId) {
        frameId = requestAnimationFrame(render);
      }
    };

    /** Drops all samples, cancels the frame, and erases the canvas. */
    const clear = () => {
      runtime.clear();
      cadence.reset();
      if (frameId) {
        cancelAnimationFrame(frameId);
        frameId = 0;
      }
      clearCanvas();
    };

    /** Samples mouse movement anywhere in the window. */
    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType && event.pointerType !== "mouse") {
        return;
      }
      // The trail is a window-level overlay: it follows the pointer over the
      // toolbar, the inspector, dialogs and the performance HUD as well, not
      // only over the authoring stage.
      const point = pointerPosition(event);
      if (!point) {
        return;
      }
      runtime.move(point, performance.now());
      schedule();
    };

    /** Clears the trail only when the pointer leaves the window. */
    const onPointerOut = (event: PointerEvent) => {
      // `relatedTarget` is null only when the pointer left the window; moving
      // between surfaces inside the app must not cut the trail.
      if (!event.relatedTarget) {
        clear();
      }
    };

    window.addEventListener("pointermove", onPointerMove, true);
    window.addEventListener("blur", clear, true);
    window.addEventListener("pointerout", onPointerOut, true);
    document.addEventListener("visibilitychange", clear, true);
    return () => {
      disposed = true;
      clear();
      window.removeEventListener("pointermove", onPointerMove, true);
      window.removeEventListener("blur", clear, true);
      window.removeEventListener("pointerout", onPointerOut, true);
      document.removeEventListener("visibilitychange", clear, true);
    };
  }, []);

  return <canvas ref={canvasRef} className="mouse-trail" aria-hidden="true" />;
}
