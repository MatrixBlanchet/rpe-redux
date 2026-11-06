/**
 * Renders the shared transient notification stack.
 *
 * The host drives row lifetime, pause/resume, click-to-dismiss, the visible close
 * control, keyed merging, and the subscription to the value cell below it.
 * Callers provide localized text and a severity, optionally with a compact still
 * or muted clip; long tasks can update a row's progress fill.
 */
import { useState, useSyncExternalStore, type CSSProperties } from "react";
import { createValue } from "../../core/state/values.ts";
import { useTranslation } from "../../i18n/react.ts";
import { Button } from "../components/button/Button.tsx";
import { IconButton } from "../components/button/IconButton.tsx";
import {
  TOAST_ERROR_DURATION,
  TOAST_MAX_ROWS,
  dueToasts,
  dismissToastRow,
  insertToast,
  toastDuration,
} from "./toastLifecycle.ts";

/** Optional media embedded beside a notice's text. */
export type ToastMedia =
  | { kind: "image"; src: string; alt?: string }
  | { kind: "video"; src: string; label?: string; poster?: string };

/** An action offered inside a notice, such as cancelling a long task. */
export interface ToastAction {
  label: string;
  variant?: "solid" | "outlined" | "plain" | "danger";
  /** Dismiss the row once the action has run; defaults to false. */
  dismissOnSelect?: boolean;
  onSelect(): void;
}

/** Step progress for a notice that walks a known sequence. */
export interface ToastStep {
  current: number;
  total: number;
}

/**
 * One row of the notice stack.
 *
 * A level is a plain string: the row styles know `success`, `warning` and
 * `error`, and any other level draws the neutral one. Durations are part of the
 * row because a warning or error may need more reading time than a save notice.
 */
export interface Toast {
  id: number;
  message: string;
  level: string;
  /** Notices sharing a key merge into one visible row. */
  key?: string;
  /** Compact still or muted clip shown to the left of the message. */
  media?: ToastMedia;
  /** The extension or subsystem that raised a notice, when it has one. */
  source?: string;
  /** Buttons that answer the task behind a sticky row. */
  actions?: readonly ToastAction[];
  /** Step progress, drawn as a labelled bar instead of the lifetime rail. */
  step?: ToastStep;
  /** Lifetime in milliseconds; `0` keeps the row until the user closes it. */
  duration: number;
  /** Clock reading when the current lifetime began; the pure expiry rules read this. */
  startedAt: number;
  /** Rows always expose the close control; the flag is explicit for the lifecycle rules. */
  closable: boolean;
  /** Inserted hidden, revealed on the next frame so the entry transition has a state to leave. */
  visible: boolean;
  /** Playing the exit transition; the row is dropped once it is over. */
  leaving: boolean;
  /** Hovering or focusing the row freezes both the timer and the progress line. */
  paused: boolean;
  /** `null` for a normal notice; `0..1` for a task-backed toast. */
  progress: number | null;
  /** Called once the row has left; lets the producer release its own handle. */
  onDismiss?: (id: number) => void;
}

/** A partial update for a sticky notice. */
export interface ToastUpdate {
  message?: string;
  level?: string;
  source?: string;
  actions?: readonly ToastAction[];
  step?: ToastStep;
  progress?: number | null;
  duration?: number;
}

/** Imperative handle returned by a long-task toast. */
export interface ToastHandle {
  readonly id: number;
  update(patch: ToastUpdate): void;
  setProgress(value: number): void;
  finish(message: string, level?: string, duration?: number): void;
  fail(message: string, duration?: number): void;
  dismiss(): void;
}

/** The object form for callers that need text and media together. */
export interface ToastContent {
  message: string;
  level?: string;
  duration?: number;
  /** Repeated notices with the same key merge instead of stacking. */
  key?: string;
  media?: ToastMedia;
  source?: string;
  actions?: readonly ToastAction[];
  step?: ToastStep;
  onDismiss?: (id: number) => void;
}

/** Covers the longer of the opacity and transform exits in `toast.less`. */
const EXIT_DURATION = 180;

interface TimerRecord {
  timer?: number;
  startedAt: number;
  remaining: number;
}

const toasts = createValue<Toast[]>({ initial: [] });
const timers = new Map<number, TimerRecord>();
const removalTimers = new Map<number, number>();
let sequence = 0;
let allowed: (level: string) => boolean = () => true;

/** Merge fields into one existing row. */
function update(id: number, fields: Partial<Toast>): void {
  toasts.set(toasts.get().map((toast) => (toast.id === id ? { ...toast, ...fields } : toast)));
}

/** Cancel the dismissal timer of one row. */
function clearTimer(id: number): void {
  const record = timers.get(id);
  if (record?.timer !== undefined) {
    window.clearTimeout(record.timer);
  }
  timers.delete(id);
}

/** Drop one row and notify its producer. */
function remove(id: number): void {
  clearTimer(id);
  const removal = removalTimers.get(id);
  if (removal !== undefined) {
    window.clearTimeout(removal);
    removalTimers.delete(id);
  }
  const { rows, removed } = dismissToastRow(toasts.get(), id);
  toasts.set(rows);
  removed?.onDismiss?.(id);
}

/** Start the exit transition and schedule the row's removal. */
function beginLeave(id: number): void {
  if (!toasts.get().some((toast) => toast.id === id && !toast.leaving)) {
    return;
  }
  clearTimer(id);
  update(id, { leaving: true, paused: false });
  removalTimers.set(
    id,
    window.setTimeout(() => remove(id), EXIT_DURATION),
  );
}

/** (Re)start the lifetime timer with a known delay. */
function scheduleDismiss(id: number, delay: number): void {
  clearTimer(id);
  const startedAt = performance.now();
  const remaining = Math.max(0, delay);
  const record: TimerRecord = {
    startedAt,
    remaining,
  };
  update(id, { startedAt, duration: remaining });
  record.timer = window.setTimeout(() => {
    timers.delete(id);
    for (const due of dueToasts(toasts.get(), performance.now())) {
      beginLeave(due.id);
    }
  }, record.remaining);
  timers.set(id, record);
}

/** Insert one row, merge a repeated key, and reveal it after a committed hidden frame. */
function createToast(
  message: string,
  level: string,
  duration: number,
  progress: number | null,
  media?: ToastMedia,
  source?: string,
  actions?: readonly ToastAction[],
  step?: ToastStep,
  onDismiss?: (id: number) => void,
  key?: string,
): number {
  const text = message.trim();
  if (!text || !allowed(level)) {
    return -1;
  }
  const current = toasts.get();
  const previous = key ? current.find((toast) => toast.key === key && !toast.leaving) : undefined;
  const candidate: Toast = {
    id: ++sequence,
    message: text,
    level,
    ...(key ? { key } : {}),
    ...(media ? { media } : {}),
    ...(source ? { source } : {}),
    ...(actions?.length ? { actions } : {}),
    ...(step ? { step } : {}),
    ...(onDismiss ? { onDismiss } : {}),
    duration: Math.max(0, duration),
    startedAt: performance.now(),
    closable: true,
    visible: false,
    leaving: false,
    paused: false,
    progress,
  };
  const inserted = insertToast(current, candidate, TOAST_MAX_ROWS);
  for (const stale of inserted.evicted) {
    clearTimer(stale.id);
    const removal = removalTimers.get(stale.id);
    if (removal !== undefined) {
      window.clearTimeout(removal);
      removalTimers.delete(stale.id);
    }
    stale.onDismiss?.(stale.id);
  }
  toasts.set(inserted.rows);
  const id = inserted.row.id;
  if (inserted.merged && previous) {
    // A repeated key updates the visible copy without restarting its lifetime,
    // so a background reload cannot pin the row on screen.
    update(id, { visible: true, leaving: false, paused: previous.paused });
    if (!previous.paused && inserted.row.duration > 0) {
      const remaining = Math.max(
        0,
        inserted.row.duration - (performance.now() - inserted.row.startedAt),
      );
      scheduleDismiss(id, remaining);
    }
    return id;
  }
  // Give React a committed hidden frame before revealing the row, including
  // when the notice was raised during another animation callback.
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      if (!toasts.get().some((toast) => toast.id === id && !toast.leaving)) {
        return;
      }
      update(id, { visible: true });
      if (inserted.row.duration > 0) {
        scheduleDismiss(id, inserted.row.duration);
      }
    }),
  );
  return id;
}

/**
 * Raises one notice, appended under the ones already on screen.
 *
 * A notice without a key is an event, so the same message raised twice is two
 * rows: what the user reads off the stack is how often something happened.
 * Callers that repeat a background condition pass a key so the row merges and
 * updates in place. The stack is capped so a burst of failures cannot cover the
 * timeline; the oldest row yields.
 */
export function showToast(content: ToastContent): number;
export function showToast(
  message: string,
  level?: string,
  duration?: number,
  media?: ToastMedia,
): number;
export function showToast(
  input: string | ToastContent,
  level = "success",
  duration?: number,
  media?: ToastMedia,
): number {
  if (typeof input !== "string") {
    const nextLevel = input.level ?? "success";
    return createToast(
      input.message,
      nextLevel,
      input.duration ?? toastDuration(nextLevel),
      null,
      input.media,
      input.source,
      input.actions,
      input.step,
      input.onDismiss,
      input.key,
    );
  }
  return createToast(input, level, duration ?? toastDuration(level), null, media);
}

/** Build the imperative handle over an existing row. */
function handleFor(id: number): ToastHandle {
  return {
    id,
    update(patch: ToastUpdate) {
      if (!toasts.get().some((toast) => toast.id === id && !toast.leaving)) {
        return;
      }
      const fields: Partial<Toast> = {};
      if (patch.message !== undefined) {
        fields.message = patch.message;
      }
      if (patch.level !== undefined) {
        fields.level = patch.level;
      }
      if (patch.source !== undefined) {
        fields.source = patch.source;
      }
      if (patch.actions !== undefined) {
        fields.actions = patch.actions;
      }
      if (patch.step !== undefined) {
        fields.step = patch.step;
      }
      if (patch.progress !== undefined) {
        fields.progress = patch.progress;
      }
      if (patch.duration !== undefined) {
        fields.duration = Math.max(0, patch.duration);
      }
      update(id, fields);
    },
    setProgress(value: number) {
      if (!Number.isFinite(value)) {
        return;
      }
      update(id, { progress: Math.max(0, Math.min(1, value)) });
    },
    finish(message: string, nextLevel = "success", duration = toastDuration(nextLevel)) {
      if (!toasts.get().some((toast) => toast.id === id && !toast.leaving)) {
        return;
      }
      const lifetime = Math.max(0, duration);
      update(id, {
        message,
        level: nextLevel,
        duration: lifetime,
        progress: 1,
        visible: true,
        leaving: false,
        paused: false,
      });
      if (lifetime > 0) {
        scheduleDismiss(id, lifetime);
      }
    },
    fail(message: string, duration = TOAST_ERROR_DURATION) {
      if (!toasts.get().some((toast) => toast.id === id && !toast.leaving)) {
        return;
      }
      const lifetime = Math.max(0, duration);
      update(id, {
        message,
        level: "error",
        duration: lifetime,
        progress: 1,
        visible: true,
        leaving: false,
        paused: false,
      });
      if (lifetime > 0) {
        scheduleDismiss(id, lifetime);
      }
    },
    dismiss() {
      beginLeave(id);
    },
  };
}

/**
 * Raises a sticky notice whose text, step, source, and actions may change while
 * it is visible. `duration: 0` is the default; pass a lifetime to let it close
 * on its own.
 */
export function showStickyToast(content: ToastContent): ToastHandle {
  const level = content.level ?? "info";
  const id = createToast(
    content.message,
    level,
    content.duration ?? 0,
    null,
    content.media,
    content.source,
    content.actions,
    content.step,
    content.onDismiss,
    content.key,
  );
  return handleFor(id);
}

/**
 * Raises a sticky task row whose background fills from left to right.
 *
 * The caller owns the work and calls `setProgress` as it advances. `finish`
 * turns the same row into the success message and starts its normal lifetime;
 * `fail` does the same with an error. The row itself is still click-dismissible.
 */
export function showProgressToast(
  message: string,
  level = "info",
  media?: ToastMedia,
): ToastHandle {
  const id = createToast(message, level, 0, 0, media);
  return handleFor(id);
}

/** Freeze a row while the pointer or keyboard focus is on it. */
export function pauseToast(id: number): void {
  const toast = toasts.get().find((item) => item.id === id);
  const record = timers.get(id);
  if (!toast || toast.leaving || toast.paused || !record || record.timer === undefined) {
    return;
  }
  const elapsed = performance.now() - record.startedAt;
  record.remaining = Math.max(0, record.remaining - elapsed);
  window.clearTimeout(record.timer);
  record.timer = undefined;
  update(id, { paused: true });
}

/** Resume a paused row with only the lifetime that was left. */
export function resumeToast(id: number): void {
  const toast = toasts.get().find((item) => item.id === id);
  const record = timers.get(id);
  if (!toast || toast.leaving || !toast.paused) {
    return;
  }
  if (!record || record.remaining <= 0) {
    beginLeave(id);
    return;
  }
  scheduleDismiss(id, record.remaining);
  update(id, { paused: false });
}

/** Dismiss one row immediately, running its short exit transition. */
export function dismissToast(id: number): void {
  beginLeave(id);
}

/** Drops every row and the timers they were waiting on; the editor calls this as it tears down. */
export function clearToasts(): void {
  for (const id of [...timers.keys()]) {
    clearTimer(id);
  }
  for (const timer of removalTimers.values()) {
    window.clearTimeout(timer);
  }
  removalTimers.clear();
  const current = toasts.get();
  toasts.set([]);
  for (const toast of current) {
    toast.onDismiss?.(toast.id);
  }
}

/**
 * Installs the filter that decides which levels reach the screen; the returned
 * function puts the previous one back.
 */
export function setToastPolicy(policy: { allowed(level: string): boolean }): () => void {
  const previous = allowed;
  allowed = policy.allowed;
  return () => {
    allowed = previous;
  };
}

/**
 * Compact media for one row.
 *
 * Images are decorative unless the caller supplies alt text. Clips are always
 * muted, loop, and carry no controls; a failed source leaves a plain surface so
 * the row still reserves the same thumbnail width.
 */
function ToastMediaView({ media }: { media: ToastMedia }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return <span className="toast-media is-empty" aria-hidden="true" />;
  }
  if (media.kind === "image") {
    return (
      <img
        className="toast-media"
        src={media.src}
        alt={media.alt ?? ""}
        draggable={false}
        onError={() => setFailed(true)}
      />
    );
  }
  return (
    <video
      className="toast-media"
      src={media.src}
      poster={media.poster}
      aria-label={media.label}
      muted
      loop
      autoPlay
      playsInline
      preload="metadata"
      onError={() => setFailed(true)}
    />
  );
}

/**
 * The single stack of transient notices.
 *
 * A notice is raised wherever the work happened — an import, a save, a failed
 * load — and most of those places are not React at all: they are actions, file
 * routines and error handlers. So the imperative half publishes into a
 * module-level cell and the declarative half subscribes to it, the same split
 * `TooltipHost` makes between the broker and the element it renders.
 *
 * There is exactly one host, mounted beside the app shell, which makes the stack
 * a singleton: a notice raised in settings, the editor, or the welcome page
 * lands in the same lower-left list and older rows move upward. The host stays
 * outside the shell so a modal scrim cannot blur or disable it.
 */
export function ToastHost({ className }: { className?: string }) {
  const items = useSyncExternalStore(toasts.subscribe, toasts.get, toasts.get);
  const { t } = useTranslation();
  return (
    <div
      className={className ? `toast-host ${className}` : "toast-host"}
      aria-live="polite"
      aria-relevant="additions"
    >
      {items.map((item) => (
        <div
          key={item.id}
          className={`toast ${item.level}${item.visible ? " visible" : ""}${item.leaving ? " leaving" : ""}${item.paused ? " paused" : ""}${item.progress !== null ? " with-progress" : ""}${item.media ? " with-media" : ""}${item.actions?.length ? " with-actions" : ""}`}
          role={item.level === "error" ? "alert" : "status"}
          aria-atomic="true"
          tabIndex={0}
          style={
            item.progress !== null
              ? ({ "--toast-progress": item.progress } as CSSProperties)
              : undefined
          }
          onClick={() => dismissToast(item.id)}
          onKeyDown={(event) => {
            if (event.target !== event.currentTarget) {
              return;
            }
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              dismissToast(item.id);
            }
          }}
          onPointerEnter={() => pauseToast(item.id)}
          onPointerLeave={() => resumeToast(item.id)}
          onFocusCapture={() => pauseToast(item.id)}
          onBlurCapture={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
              resumeToast(item.id);
            }
          }}
        >
          {item.progress !== null && <span className="toast-fill" aria-hidden="true" />}
          {item.media && <ToastMediaView media={item.media} />}
          <span className="toast-body">
            {item.source && <span className="toast-source">{item.source}</span>}
            <span className="toast-message">{item.message}</span>
            {item.step && (
              <span className="toast-step" aria-label={`${item.step.current}/${item.step.total}`}>
                <span className="toast-step-track" aria-hidden="true">
                  <span
                    style={{
                      width: `${Math.min(100, Math.max(0, (item.step.current / item.step.total) * 100))}%`,
                    }}
                  />
                </span>
                <span className="toast-step-label">
                  {item.step.current} / {item.step.total}
                </span>
              </span>
            )}
          </span>
          {item.closable && (
            <IconButton
              icon="close"
              size="small"
              className="toast-close"
              label={t("common.action.close")}
              onClick={(event) => {
                event.stopPropagation();
                dismissToast(item.id);
              }}
            />
          )}
          {item.actions?.length ? (
            <span className="toast-actions">
              {item.actions.map((action, index) => (
                <Button
                  key={`${index}:${action.label}`}
                  variant={action.variant ?? "outlined"}
                  onClick={(event) => {
                    event.stopPropagation();
                    action.onSelect();
                    if (action.dismissOnSelect) {
                      dismissToast(item.id);
                    }
                  }}
                >
                  {action.label}
                </Button>
              ))}
            </span>
          ) : null}
          {item.duration > 0 && !item.step && (
            <span
              className="toast-progress"
              aria-hidden="true"
              style={{ "--toast-duration": `${item.duration}ms` } as CSSProperties}
            />
          )}
        </div>
      ))}
    </div>
  );
}
