/**
 * Title-bar background-task menu.
 *
 * Tasks are window-wide work, not a sidebar section: pinning the trigger beside
 * the update badge keeps it reachable across the window and lets the
 * panel animate from a stable anchor.
 */
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { IconButton } from "../../../design/components/button/IconButton.tsx";
import { Progress } from "../../../design/components/progress/Progress.tsx";
import { useAnchoredPopover } from "../../../design/patterns/useAnchoredPopover.ts";
import { getLongTasks, subscribeLongTasks } from "../../../core/state/longTasks.ts";
import { playTaskCompletionChime } from "../../platform/taskCompletionSound.ts";
import { useTranslation } from "../../../i18n/react.ts";

const PANEL_GAP = 6;

/** Shows all long-running operations without blocking the editor. */
export function LongTaskControl() {
  const { t, tRaw } = useTranslation();
  const tasks = useSyncExternalStore(subscribeLongTasks, getLongTasks, getLongTasks);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLElement>(null);
  const [open, setOpen] = useState(false);
  const active = tasks.filter(
    (task) => task.status === "running" || task.status === "cancelling",
  ).length;
  const lastStatuses = useRef(new Map<string, string>());

  // A finished task is the only event that rings the chime and pops the
  // trigger. Statuses are compared here so a panel reopened on an old task
  // never replays the notification.
  useEffect(() => {
    let completed = false;
    const seen = new Set<string>();
    for (const task of tasks) {
      seen.add(task.id);
      const previous = lastStatuses.current.get(task.id);
      if (previous && previous !== "completed" && task.status === "completed") {
        completed = true;
      }
      lastStatuses.current.set(task.id, task.status);
    }
    for (const id of lastStatuses.current.keys()) {
      if (!seen.has(id)) {
        lastStatuses.current.delete(id);
      }
    }
    if (!completed) {
      return;
    }
    playTaskCompletionChime();
    const button = trigger.current;
    if (button && !globalThis.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      button.animate(
        [
          { transform: "scale(1)" },
          { transform: "scale(1.18)", offset: 0.35 },
          { transform: "scale(0.96)", offset: 0.65 },
          { transform: "scale(1.04)", offset: 0.85 },
          { transform: "scale(1)" },
        ],
        { duration: 420, easing: "ease-out" },
      );
    }
  }, [tasks]);

  /** Closes the panel and optionally returns focus to the trigger. */
  const close = (restoreFocus = false) => {
    setOpen(false);
    if (restoreFocus) {
      trigger.current?.focus();
    }
  };
  const popover = useAnchoredPopover({
    open,
    anchor: trigger,
    panel,
    onClose: () => close(),
    align: "end",
    gap: PANEL_GAP,
  });

  return (
    <div className="redux-long-task">
      <IconButton
        ref={trigger}
        icon="list"
        size="md"
        label={t("chrome.tasks.title")}
        className="redux-long-task-button"
        active={open}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        {active > 0 && (
          <span className="redux-long-task-count" aria-hidden="true">
            {active}
          </span>
        )}
      </IconButton>
      <section
        ref={panel}
        className={`long-task-popover${open ? " is-open" : ""}`}
        role="dialog"
        aria-label={t("chrome.tasks.title")}
        aria-hidden={!open}
        inert={!open}
        data-placement={popover.side}
        style={popover.style}
      >
        <IconButton
          icon="close"
          label={t("common.action.close")}
          className="redux-long-task-close"
          onClick={() => close(true)}
        />
        <div className="long-task-popover-list">
          {tasks.map((task) => (
            <article className="long-task-row" key={task.id} data-status={task.status}>
              <strong className="long-task-row-title">{tRaw(task.label)}</strong>
              <p className="long-task-progress-line">
                {task.progress === null
                  ? task.stage
                    ? tRaw(task.stage)
                    : tRaw(`chrome.tasks.status.${task.status}`)
                  : `${Math.round(task.progress * 100)}%${task.stage ? ` · ${tRaw(task.stage)}` : ""}`}
              </p>
              <Progress
                max={1}
                value={task.progress ?? undefined}
                label={tRaw(task.label)}
                size="compact"
                className="long-task-progress"
              />
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
