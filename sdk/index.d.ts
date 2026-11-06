/**
 * RPE Redux Extension SDK — types-only entry.
 *
 * The curated surface lives in `src/core/api/sdk.ts`; this file only forwards
 * it. `npm run check` type-checks this entry and the examples in `sdk/`.
 * There is no runtime, validator, or package: an Extension reads the live host
 * through its capability-gated `context.api`, and these types describe that
 * contract. Debug and automation builds expose a separate synchronous host
 * facade as `window.redux`; it is not the package contract.
 */
export type * from "../src/core/api/sdk.ts";
