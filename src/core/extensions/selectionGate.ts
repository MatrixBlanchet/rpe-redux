/**
 * Capability-checked selection operations.
 *
 * The same view is used by `context.api.selection` and by script `editor`
 * access, so read and write methods cannot drift into a single all-or-nothing
 * handle. Every operation checks its own capability.
 */
import type { SelectionHandle } from "../api/selection.ts";
import { requireExtensionCapability, type ExtensionCapability } from "./capabilities.ts";

type Granted = ReadonlySet<ExtensionCapability>;

/** Wrap one handle method so it checks `capability` before delegating. */
function wrapMethod<T extends (...args: never[]) => unknown>(
  granted: Granted,
  capability: ExtensionCapability,
  action: string,
  method: T,
): T {
  return ((...args: Parameters<T>) => {
    requireExtensionCapability(granted, capability, action);
    return method(...args);
  }) as T;
}

/**
 * Build the selection handle for one grant.
 *
 * Read methods require `selection.read`; every mutating method requires
 * `selection.write` independently.
 */
export function gatedSelection(
  selection: Omit<SelectionHandle, "availability">,
  granted: Granted,
): Omit<SelectionHandle, "availability"> {
  const read = <T extends (...args: never[]) => unknown>(action: string, method: T): T =>
    wrapMethod(granted, "selection.read", action, method);
  const write = <T extends (...args: never[]) => unknown>(action: string, method: T): T =>
    wrapMethod(granted, "selection.write", action, method);
  return {
    state: read("selection.state", selection.state),
    subscribe: read("selection.subscribe", selection.subscribe),
    clear: write("selection.clear", selection.clear),
    copy: write("selection.copy", selection.copy),
    cut: write("selection.cut", selection.cut),
    delete: write("selection.delete", selection.delete),
    paste: write("selection.paste", selection.paste),
    notes: {
      select: write("selection.notes.select", selection.notes.select),
      range: write("selection.notes.range", selection.notes.range),
    },
    events: {
      select: write("selection.events.select", selection.events.select),
      range: write("selection.events.range", selection.events.range),
    },
  };
}
