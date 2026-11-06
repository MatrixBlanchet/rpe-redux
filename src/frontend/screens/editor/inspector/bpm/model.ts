/**
 * The BPM pane's form-request slot.
 *
 * It shares the request mechanism from `formRequest.ts` but keeps its own cell,
 * so opening or closing another pane cannot replace the session this pane is
 * editing.
 */
import { createFormRequest, type FormRequest } from "../formRequest.ts";

export type BpmForm = FormRequest;

/** Creates the BPM pane's independent request slot. */
export function createBpmForm() {
  return createFormRequest<BpmForm>();
}
