/**
 * Give the browser event loop one turn so timers, paint, and input can run.
 *
 * Worker handoff and CPU-heavy loading loops use this between bounded chunks;
 * it deliberately does not use microtasks, which would resume before paint.
 */
export function yieldToHost(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}
