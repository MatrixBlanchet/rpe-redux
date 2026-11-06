/**
 * Shared right-click popup: an anchored action store plus the popover surface
 * that renders it.
 *
 * Sites own their actions and store. The popup measures once per snapshot,
 * clamps into the viewport, and returns focus to the anchor owner when a close
 * goes through `close`; light dismissal is left to `popover="auto"`.
 */
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { createValue } from "../../../core/state/values.ts";
import {
  POPOVER_EDGE,
  resolvePopoverLeft,
  type PopoverAlign,
} from "../../../design/patterns/useAnchoredPopover.ts";

/** One command offered by a context menu. */
export interface ContextMenuAction {
  id: string;
  label: string;
  tooltip?: string;
  icon?: string;
  /** Destructive commands keep danger ink in the popup. */
  danger?: boolean;
  /** Display text for the row's keyboard binding, when it has one. */
  shortcut?: string;
  enabled?(): boolean;
  run(): void;
}

/** Where a context menu opens and which element receives focus back. */
export interface ContextMenuAnchor {
  owner: HTMLElement | null;
  /** Horizontal baseline: the left edge for `start`, the centre for `center`, and the right edge for `end`. */
  x: number;
  y: number;
  /** Horizontal alignment against the measured menu; defaults to `start`. */
  align?: PopoverAlign;
}

/** A context menu anchor together with the actions to draw. */
export interface ContextMenuSnapshot extends ContextMenuAnchor {
  actions: readonly ContextMenuAction[];
}

/** Observable store holding at most one open context menu. */
export interface ContextMenuStore<T extends ContextMenuAnchor> {
  get(): T | null;
  subscribe(listener: () => void): () => void;
  set(snapshot: T | null): void;
}

/** Creates the observable store a site fills and the popup renders. */
export function createContextMenuState<T extends ContextMenuAnchor>(): ContextMenuStore<T> {
  const menu = createValue<T | null>({ initial: null });
  return Object.freeze({ get: menu.get, subscribe: menu.subscribe, set: menu.set });
}

/** Clamps one vertical popup offset inside the viewport, keeping the edge gap. */
function placeTop(offset: number, size: number, viewport: number): string {
  return `${Math.max(POPOVER_EDGE, Math.min(offset, viewport - size - POPOVER_EDGE))}px`;
}

/**
 * Style used before the menu has been measured.
 *
 * An `end` anchor already knows its visible right edge, so the unmeasured menu
 * can sit flush against it without guessing its width; the measured placement
 * then takes over with the actual width.
 */
function unmeasuredStyle(snapshot: ContextMenuAnchor): CSSProperties {
  if (snapshot.align === "end") {
    return {
      left: "auto",
      right: `${window.innerWidth - snapshot.x}px`,
      top: `${snapshot.y}px`,
    };
  }
  return { left: `${snapshot.x}px`, top: `${snapshot.y}px` };
}

/** Focuses the first visible, enabled item of an open menu. */
function focusFirstItem(menu: HTMLElement): void {
  const items = [...menu.querySelectorAll<HTMLButtonElement>("button:not(:disabled)")];
  items.find((item) => item.checkVisibility())?.focus();
}

/** Keyboard navigation for a popup menu. */
export function navigateMenu(event: KeyboardEvent<HTMLElement>, close: () => void): void {
  const root = event.currentTarget;
  const items = [
    ...root.querySelectorAll<HTMLButtonElement>("button:not(:disabled):not([hidden])"),
  ].filter((item) => item.checkVisibility());
  const index = items.indexOf(document.activeElement as HTMLButtonElement);
  if (["ArrowDown", "ArrowUp", "Home", "End", "Escape"].includes(event.key)) {
    event.preventDefault();
    event.stopPropagation();
    if (event.key === "Escape") {
      close();
    } else {
      const next =
        event.key === "Home"
          ? 0
          : event.key === "End"
            ? items.length - 1
            : (index + (event.key === "ArrowUp" ? -1 : 1) + items.length) % items.length;
      items[next]?.focus();
    }
  }
}

/**
 * The shared right-click popup.
 *
 * Native `popover="auto"` supplies light dismissal, so no site listens for
 * outside pointer events. The snapshot carries the pointer position only, so the
 * popup measures itself once open and clamps into the viewport. The measurement
 * is kept next to the snapshot it belongs to, so an unmeasured menu paints at
 * the pointer immediately.
 *
 * `close` clears the snapshot and nothing else. Hiding and handing focus back
 * to the surface stay in the effect, so the callback is safe to hand to the
 * menu's rows.
 */
export function ContextMenuPopup<T extends ContextMenuAnchor>({
  store,
  label,
  className = "",
  children,
}: {
  store: ContextMenuStore<T>;
  label: string;
  /** Extra class for the site's own composition details, on top of the shared look. */
  className?: string;
  children(snapshot: T, close: () => void): ReactNode;
}) {
  const snapshot = useSyncExternalStore(store.subscribe, store.get, store.get);
  const popup = useRef<HTMLDivElement>(null);
  const owner = useRef<HTMLElement | null>(null);
  const [placement, setPlacement] = useState<{ snapshot: T; left: string; top: string }>();
  const labelId = useId();
  const close = useCallback(() => store.set(null), [store]);

  // A popup is its own scroll context. The editor routes wheel input at the
  // window level, so the wheel over a list must never reach the workspace
  // behind it. Native scrolling stays in charge for smooth trackpads; a
  // capture owner that already refused the default keeps its gesture honored
  // here.
  useEffect(() => {
    const menu = popup.current;
    if (!menu) {
      return;
    }
    const onWheel = (event: WheelEvent) => {
      event.stopPropagation();
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? menu.clientHeight : 1;
      if (event.defaultPrevented) {
        event.preventDefault();
        menu.scrollTop += event.deltaY * unit;
        return;
      }
      const atTop = menu.scrollTop <= 0 && event.deltaY < 0;
      const atBottom =
        menu.scrollTop + menu.clientHeight >= menu.scrollHeight - 1 && event.deltaY > 0;
      // Keep a wheel that reaches either end - or a menu with nothing to
      // scroll - from chaining into the canvas or timeline below.
      if (atTop || atBottom || menu.scrollHeight <= menu.clientHeight) {
        event.preventDefault();
      }
    };
    menu.addEventListener("wheel", onWheel, { passive: false });
    return () => menu.removeEventListener("wheel", onWheel);
  }, []);

  useEffect(() => {
    const menu = popup.current;
    if (!menu) {
      return;
    }
    if (!snapshot) {
      // Only a close that went through `close` still has the popover showing. A
      // light dismissal arrives here already closed, and the browser restores
      // focus for that path on its own.
      const wasShowing = menu.matches(":popover-open");
      menu.hidePopover();
      if (wasShowing) {
        const target = owner.current;
        if (target?.isConnected && !target.closest("[inert]")) {
          target.focus();
        }
        owner.current = null;
      }
      return;
    }
    owner.current = snapshot.owner;
    if (!menu.matches(":popover-open")) {
      menu.showPopover();
    }
    const frame = requestAnimationFrame(() => {
      if (!menu.matches(":popover-open")) {
        return;
      }
      setPlacement({
        snapshot,
        left: `${resolvePopoverLeft(
          snapshot.x,
          menu.offsetWidth,
          window.innerWidth,
          snapshot.align,
        )}px`,
        top: placeTop(snapshot.y, menu.offsetHeight, window.innerHeight),
      });
      focusFirstItem(menu);
    });
    return () => cancelAnimationFrame(frame);
  }, [snapshot]);

  const measured = placement?.snapshot === snapshot ? placement : null;
  return (
    <div
      ref={popup}
      popover="auto"
      role="menu"
      aria-labelledby={labelId}
      className={`redux-menu-popup ${className}`.trim()}
      style={
        measured
          ? { left: measured.left, top: measured.top }
          : snapshot
            ? unmeasuredStyle(snapshot)
            : undefined
      }
      onToggle={(event) => {
        if (event.newState === "closed" && store.get()) {
          store.set(null);
        }
      }}
      onKeyDown={(event) => navigateMenu(event, close)}
    >
      <span id={labelId} className="redux-visually-hidden">
        {label}
      </span>
      {snapshot ? children(snapshot, close) : null}
    </div>
  );
}
