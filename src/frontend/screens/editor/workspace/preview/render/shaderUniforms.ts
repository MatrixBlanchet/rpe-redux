/**
 * Reading a shader's own uniform defaults, and normalizing incoming values.
 *
 * Both are pure: defaults are parsed out of the `%...%` comments the ported
 * sources carry, and a value authored in 0..255 is scaled to 0..1. No GL context
 * is involved.
 */

/** Parses `%value%` annotations into a uniform-name table of defaults. */
export function shaderDefaults(source: string): Record<string, number | number[]> {
  return Object.fromEntries(
    [...source.matchAll(/uniform\s+\w+\s+(\w+)\s*;[^\r\n%]*%([^%\r\n]+)%/g)]
      .map(([, name, value]): [string, number | number[]] => {
        const numbers = value.split(",").map(Number);
        return [name, numbers.length === 1 ? numbers[0] : numbers];
      })
      .filter(([, value]) => (Array.isArray(value) ? value : [value]).every(Number.isFinite)),
  );
}

/** Scales a four-channel colour authored in 0..255 into the 0..1 GL range. */
export function normalizeUniformValue(name: string, value: unknown): unknown {
  if (!Array.isArray(value)) {
    return value;
  }
  const result = value.map(Number);
  if (
    result.length === 4 &&
    (name === "color" || name.endsWith("Color") || result.some((entry) => Math.abs(entry) > 1))
  ) {
    if (result.some((entry) => Math.abs(entry) > 1)) {
      return result.map((entry) => entry / 255);
    }
  }
  return result;
}
