/**
 * Clock for the history pane's relative timestamps.
 *
 * The clock advances once per second only while the pane is active, has rows,
 * and the document is visible. Visibility changes pause and resume it so a
 * hidden pane does not wake React every second.
 */
import { useLayoutEffect, useState } from "react";

/**
 * Returns the current clock reading for history rows.
 *
 * Activation resets the reading before paint so a reopened pane never shows the
 * timestamp left over from when it was last hidden.
 */
export function useHistoryClock(active: boolean, hasRows: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useLayoutEffect(() => {
    if (!active || !hasRows) {
      return;
    }
    let timer: number | undefined;
    const tick = () => setNow(Date.now());
    const start = () => {
      if (timer !== undefined) {
        return;
      }
      tick();
      timer = window.setInterval(tick, 1_000);
    };
    const stop = () => {
      if (timer === undefined) {
        return;
      }
      window.clearInterval(timer);
      timer = undefined;
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        start();
      } else {
        stop();
      }
    };
    if (document.visibilityState === "visible") {
      start();
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [active, hasRows]);
  return now;
}
