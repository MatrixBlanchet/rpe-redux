/**
 * Request stacks for features that ask one question at a time.
 *
 * A request reserves its queue slot when it is enqueued and settles when the modal
 * closes, including on dismissal.
 */
import { createValue } from "../../../core/state/values.ts";
import { dismissModal, presentModal } from "./modalQueue.ts";

/** Feature data waits here; its global stack position is reserved at request time. */
export function createModalRequests<T extends { id: number }>(prefix: string) {
  const requests = createValue<readonly T[]>({ initial: [] });
  const key = (id: number) => `${prefix}:${id}`;
  /** Dismisses the request's modal and removes it from the stack. */
  function close(id = requests.get()[0]?.id): void {
    if (id === undefined) {
      return;
    }
    dismissModal(key(id));
    requests.set(requests.get().filter((request) => request.id !== id));
  }
  return {
    get: (): T | null => requests.get()[0] ?? null,
    subscribe: requests.subscribe,
    enqueue(request: T): void {
      presentModal(key(request.id), { onClose: () => close(request.id) });
      requests.set([...requests.get(), request]);
    },
    close,
  };
}
