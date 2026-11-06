/**
 * Normalises asset and archive paths into one lookup form.
 *
 * Backslashes become slashes, dot segments are resolved, and the result is
 * lowercased so paths from different hosts compare equal.
 */
export function normalizePath(path: string): string {
  const parts: string[] = [];
  for (const part of path.replaceAll("\\", "/").split("/")) {
    if (part === "..") {
      parts.pop();
    } else if (part && part !== ".") {
      parts.push(part);
    }
  }
  return parts.join("/").toLowerCase();
}
