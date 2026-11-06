/**
 * Scheduling policy for loopback service calls.
 *
 * The local Go service is fast but still single-process. Bounding concurrent
 * JSON calls and giving mutations priority over listings keeps a large project
 * refresh from delaying a save or an occupancy change. The queue has no HTTP
 * knowledge; the library client supplies one request at a time.
 */
import { TaskQueue } from "../../runtime/taskQueue.ts";

/** Four concurrent calls, with a small burst budget for interactive edits. */
const serviceQueue = new TaskQueue({
  concurrency: 4,
  ratePerSecond: 40,
  burst: 20,
  maxQueued: 64,
});

/** Queue one service call; reads are normal priority and writes are high. */
export function scheduleServiceRequest<T>(method: string, task: () => Promise<T>): Promise<T> {
  return serviceQueue.run(task, {
    priority: method === "GET" || method === "HEAD" ? "normal" : "high",
  });
}
