/** Shared extension registry used by internal owners and the public facade. */
import { ExtensionRegistry } from "./registry.ts";
import type { ExtensionEventPayloads, ExtensionHookPayloads } from "./contract.ts";

/** Guards against recursion when the failure reporter itself fails. */
let reportingFailure = false;

/** Application-wide event and hook registry; failures are re-emitted as events. */
export const extensionRegistry = new ExtensionRegistry<
  ExtensionEventPayloads,
  ExtensionHookPayloads
>((failure) => {
  if (reportingFailure) {
    console.error(
      "[redux.extensions] callback failure while reporting a callback failure",
      failure,
    );
    return;
  }
  reportingFailure = true;
  try {
    console.error("[redux.extensions] extension:callback-error", failure);
    extensionRegistry.emitEvent("extension:callback-error", failure);
  } finally {
    reportingFailure = false;
  }
});
