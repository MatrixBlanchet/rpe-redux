/**
 * Hosts the shared transport card and applies the theme's placement preset.
 *
 * The card stays mounted in one React position for the whole session: a theme
 * switch only changes the host's class and data attributes, so the scrubber,
 * marker layer, and spectrum canvas keep the same DOM nodes the editor assembly
 * captured at mount. A floating host can be dragged by its grip; the position is
 * clamped to the viewport and resets when the preset changes.
 */
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  getEditorVisibility,
  subscribeToEditorVisibility,
} from "../../../core/edit/state/visibility.ts";
import { useTranslation } from "../../../i18n/react.ts";
import { useThemeChrome } from "../../app/useThemeChrome.ts";
import { Button } from "../../../design/components/button/Button.tsx";
import { ChartProgress } from "./ChartProgress.tsx";

interface DragOrigin {
  pointerX: number;
  pointerY: number;
  left: number;
  top: number;
  width: number;
  height: number;
}

/** The transport card with a stable mount point and a themed placement. */
export function TransportHost() {
  const { t } = useTranslation();
  const chrome = useThemeChrome();
  const visible = useSyncExternalStore(
    subscribeToEditorVisibility,
    getEditorVisibility,
    getEditorVisibility,
  );
  const floating = chrome.layout.transport === "floating";
  const draggable = floating && chrome.layout.transportDraggable;
  const anchor = chrome.layout.transportAnchor;
  const host = useRef<HTMLDivElement>(null);
  const origin = useRef<DragOrigin | null>(null);
  const [position, setPosition] = useState<{
    preset: string;
    left: number;
    top: number;
  } | null>(null);
  // A preset change returns the card to its themed corner. User dragging is a
  // session adjustment, not a second persisted layout, so the position is keyed
  // by the preset instead of reset through an effect.
  const preset = `${floating}|${anchor}|${draggable}`;
  const activePosition = position?.preset === preset ? position : null;

  // A resized window invalidates the clamped coordinates; returning to the
  // themed corner is safer than leaving the card outside the viewport.
  useEffect(() => {
    if (!floating) {
      return;
    }
    const reset = () => {
      setPosition(null);
      origin.current = null;
    };
    window.addEventListener("resize", reset);
    return () => window.removeEventListener("resize", reset);
  }, [floating]);

  /** Start a drag from the grip. */
  const beginDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const node = host.current;
    if (!node || !draggable) {
      return;
    }
    const rect = node.getBoundingClientRect();
    origin.current = {
      pointerX: event.clientX,
      pointerY: event.clientY,
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
    };
    setPosition({ preset, left: rect.left, top: rect.top });
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  };

  /** Move the floating card, keeping its whole box inside the viewport. */
  const moveDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const start = origin.current;
    if (!start) {
      return;
    }
    const maxLeft = Math.max(0, window.innerWidth - start.width);
    const maxTop = Math.max(0, window.innerHeight - start.height);
    setPosition({
      preset,
      left: Math.min(maxLeft, Math.max(0, start.left + event.clientX - start.pointerX)),
      top: Math.min(maxTop, Math.max(0, start.top + event.clientY - start.pointerY)),
    });
  };

  /** Finish a drag and release pointer capture. */
  const endDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    origin.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  return (
    <div
      ref={host}
      className="transport-host"
      hidden={visible.atHome}
      data-floating={floating ? "true" : "false"}
      data-anchor={anchor}
      data-draggable={draggable ? "true" : "false"}
      style={
        activePosition
          ? {
              left: activePosition.left,
              top: activePosition.top,
              right: "auto",
              bottom: "auto",
            }
          : undefined
      }
    >
      {draggable && (
        <Button
          type="button"
          variant="plain"
          className="transport-host-grip"
          aria-label={t("chrome.transport.move")}
          data-tip-title={t("chrome.transport.move")}
          onPointerDown={beginDrag}
          onPointerMove={moveDrag}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        />
      )}
      <ChartProgress />
    </div>
  );
}
