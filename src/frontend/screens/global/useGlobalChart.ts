/** React snapshot of the current chart for global workspace pages. */
import { useMemo, useSyncExternalStore } from "react";
import type { Chart } from "../../../core/global/chart/chart.ts";
import { useEditorRuntime } from "../editor/workspace/runtime/composition/EditorRuntime.tsx";
import { createSessionChartSource } from "./sessionChartSource.ts";

/**
 * Subscribes to the active session chart and returns the current chart object.
 *
 * A document open or close replaces the whole session behind
 * `providers.session`, so the source follows that holder instead of capturing
 * one session while the component mounts.
 */
export function useGlobalChart(): Chart | null {
  const runtime = useEditorRuntime();
  const sessions = runtime?.providers.session ?? null;
  const source = useMemo(() => createSessionChartSource(sessions), [sessions]);
  return useSyncExternalStore(source.subscribe, source.getSnapshot, source.getSnapshot);
}
