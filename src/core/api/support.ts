/**
 * Owns the shared result envelopes, availability reporting, and frozen geometry
 * values used by every public API handle.
 */
import type { ApiAvailability, ApiError, ApiResult } from "./contract.ts";

/** Available when the runtime is connected; otherwise the handle's stable reason. */
export function availabilityFor(runtime: unknown, message: string): ApiAvailability {
  return runtime
    ? { status: "available" }
    : { status: "unavailable", error: { code: "unavailable", message } };
}

/** A structured unavailable result for a call made before the editor mounts. */
export function unavailableResult<T>(message: string): ApiResult<T> {
  return { ok: false, error: { code: "unavailable", message } };
}

/** Map a thrown operation error onto the public error contract. */
export function errorResult<T>(error: unknown): ApiResult<T> {
  const mapped: ApiError =
    error instanceof RangeError
      ? { code: "invalid_request", message: error.message }
      : {
          code: "failed",
          message: error instanceof Error ? error.message : String(error),
        };
  return { ok: false, error: mapped };
}

/** Run one synchronous facade call behind the shared result envelope. */
export function apiCall<T>(run: () => T): ApiResult<T> {
  try {
    return { ok: true, value: run() };
  } catch (error) {
    return errorResult(error);
  }
}

/** Run one asynchronous facade call behind the shared result envelope. */
export async function apiCallAsync<T>(run: () => Promise<T>): Promise<ApiResult<T>> {
  try {
    return { ok: true, value: await run() };
  } catch (error) {
    return errorResult(error);
  }
}

/** Freeze a point-shaped value without widening it to a new interface. */
export function frozenPoint<T extends { x: number; y: number }>(point: T): T {
  return Object.freeze({ ...point });
}

/** Freeze a rectangle-shaped value without widening it to a new interface. */
export function frozenRect<T extends { left: number; top: number; width: number; height: number }>(
  rect: T,
): T {
  return Object.freeze({ ...rect });
}
