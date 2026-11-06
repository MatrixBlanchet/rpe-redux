/**
 * Detects reference cycles in a chart-like value.
 *
 * Charts are JSON documents: a value that points back at one of its ancestors
 * cannot be serialized, hashed, or diffed. Hashing and diffing already stop at a
 * cycle defensively; this check rejects the value at the boundary so the rest of
 * the editor never has to carry that state.
 *
 * The walk is iterative so a deeply nested value cannot overflow the stack while
 * it is being checked.
 */
export function containsCycle(root: unknown): boolean {
  if (root === null || typeof root !== "object") {
    return false;
  }
  const visiting = new WeakSet<object>();
  const done = new WeakSet<object>();
  const stack: { value: object; exiting: boolean }[] = [{ value: root as object, exiting: false }];
  while (stack.length > 0) {
    const entry = stack.pop() as { value: object; exiting: boolean };
    if (entry.exiting) {
      visiting.delete(entry.value);
      done.add(entry.value);
      continue;
    }
    if (done.has(entry.value)) {
      continue;
    }
    if (visiting.has(entry.value)) {
      return true;
    }
    visiting.add(entry.value);
    stack.push({ value: entry.value, exiting: true });
    if (Array.isArray(entry.value)) {
      for (let index = 0; index < entry.value.length; index += 1) {
        const child = entry.value[index];
        if (child !== null && typeof child === "object") {
          stack.push({ value: child as object, exiting: false });
        }
      }
    } else {
      // `for...in` avoids allocating a value array for every chart object.
      for (const key in entry.value as Record<string, unknown>) {
        const child = (entry.value as Record<string, unknown>)[key];
        if (child !== null && typeof child === "object") {
          stack.push({ value: child as object, exiting: false });
        }
      }
    }
  }
  return false;
}
