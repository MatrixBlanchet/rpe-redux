/**
 * Owns the shared vocabulary for the public `window.redux` contract.
 *
 * This file contains no editor implementation. Facades use these types to
 * describe availability and structured failures without exposing a session,
 * renderer, DOM node, or host adapter to an extension.
 *
 * There is exactly one version in this contract: the application version,
 * exposed as `redux.version`. Capability differences are reported only through
 * `ApiAvailability.status`.
 */
import type { ApiError } from "../contracts/result.ts";

export type { ApiError, ApiErrorCode, ApiResult } from "../contracts/result.ts";

export interface ApiAvailability {
  status: "available" | "unavailable";
  error?: ApiError;
}
