/**
 * Shared request-slot mechanism for inspector forms.
 *
 * A form request carries the live session and chart snapshot that a panel edits,
 * plus the callback used after a successful commit. The slot owns showing and
 * clearing that request; individual panels keep their own view and draft state.
 */
import { createValue, type ValueCell } from "../../../../core/state/values.ts";
import type { Chart } from "../../../../core/global/chart/chart.ts";
import type { EditorSession } from "../../../../core/edit/session/session.ts";

/** One panel's pending edit target and its post-commit callback. */
export interface FormRequest {
  session: EditorSession;
  chart: Chart;
  onCommit?: () => void;
}

/** Observable request slot with one show/clear protocol. */
export interface FormRequestCell<T extends FormRequest> extends ValueCell<T | null> {
  show(session: EditorSession, onCommit?: () => void): void;
  clear(): void;
}

/** Create one observable form request slot with one show/clear protocol. */
export function createFormRequest<T extends FormRequest = FormRequest>(): FormRequestCell<T> {
  const cell = createValue<T | null>({ initial: null });
  return Object.freeze({
    ...cell,
    show(session: EditorSession, onCommit?: () => void): void {
      cell.set({ session, chart: session.chart, onCommit } as T);
    },
    clear(): void {
      cell.set(null);
    },
  });
}
