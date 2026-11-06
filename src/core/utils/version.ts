/**
 * Minimal semantic-version comparison for release tags.
 *
 * GitHub tags commonly carry a leading `v`; the updater and the changelog both
 * need the numeric/prerelease ordering, not a full parser. Build metadata is
 * ignored and malformed versions compare as equal so a bad tag cannot announce
 * an update by accident.
 */

interface ParsedVersion {
  major: number;
  minor: number;
  patch: number;
  prerelease: string[];
}

/** Strip the conventional tag prefix without touching the version itself. */
export function normalizeVersion(value: string): string {
  return value.trim().replace(/^[vV]/, "");
}

/** Parse a version into numeric core fields and prerelease identifiers, or null. */
function parse(value: string): ParsedVersion | null {
  const normalized = normalizeVersion(value).split("+", 1)[0] ?? "";
  const dash = normalized.indexOf("-");
  const core = dash >= 0 ? normalized.slice(0, dash) : normalized;
  const prerelease = dash >= 0 ? normalized.slice(dash + 1) : "";
  const parts = core.split(".");
  if (parts.length < 1 || parts.length > 3) {
    return null;
  }
  const numbers = parts.map((part) => (/^\d+$/u.test(part) ? Number(part) : Number.NaN));
  if (numbers.some((number) => !Number.isSafeInteger(number) || number < 0)) {
    return null;
  }
  return {
    major: numbers[0] ?? 0,
    minor: numbers[1] ?? 0,
    patch: numbers[2] ?? 0,
    prerelease: prerelease ? prerelease.split(".") : [],
  };
}

/** Compare prerelease identifiers; an absent prerelease sorts after a present one. */
function comparePrerelease(left: string[], right: string[]): number {
  if (!left.length && !right.length) {
    return 0;
  }
  if (!left.length) {
    return 1;
  }
  if (!right.length) {
    return -1;
  }
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const a = left[index];
    const b = right[index];
    if (a === undefined) {
      return -1;
    }
    if (b === undefined) {
      return 1;
    }
    const aNumeric = /^\d+$/u.test(a);
    const bNumeric = /^\d+$/u.test(b);
    if (aNumeric && bNumeric) {
      const difference = Number(a) - Number(b);
      if (difference) {
        return difference > 0 ? 1 : -1;
      }
    } else if (aNumeric !== bNumeric) {
      return aNumeric ? -1 : 1;
    } else if (a !== b) {
      return a > b ? 1 : -1;
    }
  }
  return 0;
}

/** Negative when `left` is older, positive when it is newer, zero when equal. */
export function compareVersions(left: string, right: string): number {
  const a = parse(left);
  const b = parse(right);
  if (!a || !b) {
    return 0;
  }
  if (a.major !== b.major) {
    return a.major > b.major ? 1 : -1;
  }
  if (a.minor !== b.minor) {
    return a.minor > b.minor ? 1 : -1;
  }
  if (a.patch !== b.patch) {
    return a.patch > b.patch ? 1 : -1;
  }
  return comparePrerelease(a.prerelease, b.prerelease);
}

/** True when the string can participate in a release comparison. */
export function isVersion(value: string): boolean {
  return parse(value) !== null;
}

/** Whether a semantic version carries a prerelease identifier. */
export function isPrereleaseVersion(value: string): boolean {
  return (parse(value)?.prerelease.length ?? 0) > 0;
}

/** A version pattern used by an Extension `engines` range. */
interface VersionPattern {
  /** Numeric major, or null for a wildcard. */
  major: number | null;
  /** Numeric minor, or null when omitted or wildcarded. */
  minor: number | null;
  /** Numeric patch, or null when omitted or wildcarded. */
  patch: number | null;
  prerelease: string[];
  /** How many leading numeric fields the author actually wrote. */
  specified: number;
  text: string;
}

interface VersionBound {
  version: string;
  /** Whether equality with the bound satisfies the comparator. */
  inclusive: boolean;
  direction: "lower" | "upper";
}

/** Split a range token into an operator and a version pattern. */
function parsePattern(token: string): VersionPattern | null {
  const normalized = normalizeVersion(token).replace(/\s+/gu, "");
  if (!normalized) {
    return null;
  }
  const [corePart] = normalized.split("+", 1);
  const dash = corePart.indexOf("-");
  const core = dash >= 0 ? corePart.slice(0, dash) : corePart;
  const prerelease = dash >= 0 ? corePart.slice(dash + 1).split(".") : [];
  const parts = core.split(".");
  if (parts.length < 1 || parts.length > 3) {
    return null;
  }
  let wildcard = false;
  let specified = 0;
  const numbers: Array<number | null> = [];
  for (const part of parts) {
    if (part === "x" || part === "X" || part === "*") {
      wildcard = true;
      numbers.push(null);
      continue;
    }
    if (wildcard || !/^\d+$/u.test(part)) {
      return null;
    }
    const number = Number(part);
    if (!Number.isSafeInteger(number) || number < 0) {
      return null;
    }
    numbers.push(number);
    specified += 1;
  }
  if (wildcard && specified === 0) {
    return { major: null, minor: null, patch: null, prerelease: [], specified: 0, text: token };
  }
  if (prerelease.length > 0 && specified !== 3) {
    return null;
  }
  return {
    major: numbers[0] ?? null,
    minor: numbers[1] ?? null,
    patch: numbers[2] ?? null,
    prerelease,
    specified,
    text: token,
  };
}

/** Render a pattern as a concrete version, filling omitted fields with zero. */
function formatPattern(pattern: VersionPattern, overrides: Partial<ParsedVersion> = {}): string {
  const major = overrides.major ?? pattern.major ?? 0;
  const minor = overrides.minor ?? pattern.minor ?? 0;
  const patch = overrides.patch ?? pattern.patch ?? 0;
  const prerelease = overrides.prerelease ?? pattern.prerelease;
  return `${major}.${minor}.${patch}${prerelease.length ? `-${prerelease.join(".")}` : ""}`;
}

/** The floor version of a pattern, filling omitted fields with zero. */
function patternFloor(pattern: VersionPattern): string {
  return formatPattern(pattern);
}

/** The exclusive upper bound of a partial pattern. */
function patternCeiling(pattern: VersionPattern): string | null {
  if (pattern.major === null) {
    return null;
  }
  if (pattern.specified <= 1) {
    return `${pattern.major + 1}.0.0`;
  }
  if (pattern.specified === 2) {
    return `${pattern.major}.${pattern.minor! + 1}.0`;
  }
  return null;
}

/** Bounds for one comparator token. Null means the token is invalid. */
function boundsFor(operator: string, pattern: VersionPattern): VersionBound[] | null {
  if (operator === "=" || operator === "") {
    if (pattern.major === null) {
      return [];
    }
    if (pattern.specified < 3) {
      const ceiling = patternCeiling(pattern);
      return [
        { version: patternFloor(pattern), inclusive: true, direction: "lower" },
        ...(ceiling
          ? [{ version: ceiling, inclusive: false, direction: "upper" } as VersionBound]
          : []),
      ];
    }
    return [
      { version: patternFloor(pattern), inclusive: true, direction: "lower" },
      { version: patternFloor(pattern), inclusive: true, direction: "upper" },
    ];
  }
  if (operator === ">=") {
    return [{ version: patternFloor(pattern), inclusive: true, direction: "lower" }];
  }
  if (operator === ">") {
    const ceiling = patternCeiling(pattern);
    if (!ceiling) {
      return null;
    }
    return [{ version: ceiling, inclusive: true, direction: "lower" }];
  }
  if (operator === "<=") {
    const ceiling = patternCeiling(pattern);
    if (!ceiling) {
      return [{ version: patternFloor(pattern), inclusive: true, direction: "upper" }];
    }
    return [{ version: ceiling, inclusive: false, direction: "upper" }];
  }
  if (operator === "<") {
    return [{ version: patternFloor(pattern), inclusive: false, direction: "upper" }];
  }
  if (operator === "^") {
    if (pattern.major === null) {
      return [];
    }
    const floor = patternFloor(pattern);
    let ceiling: string;
    if (pattern.major > 0 || pattern.specified <= 1) {
      ceiling = `${pattern.major + 1}.0.0`;
    } else if ((pattern.minor ?? 0) > 0 || pattern.specified === 2) {
      ceiling = `0.${(pattern.minor ?? 0) + 1}.0`;
    } else {
      ceiling = `0.0.${(pattern.patch ?? 0) + 1}`;
    }
    return [
      { version: floor, inclusive: true, direction: "lower" },
      { version: ceiling, inclusive: false, direction: "upper" },
    ];
  }
  if (operator === "~") {
    if (pattern.major === null) {
      return [];
    }
    const floor = patternFloor(pattern);
    const ceiling =
      pattern.specified <= 1
        ? `${pattern.major + 1}.0.0`
        : `${pattern.major}.${(pattern.minor ?? 0) + 1}.0`;
    return [
      { version: floor, inclusive: true, direction: "lower" },
      { version: ceiling, inclusive: false, direction: "upper" },
    ];
  }
  return null;
}

/** Compile one AND group (whitespace separated comparators). */
function compileGroup(source: string): VersionBound[] | null {
  const text = source.trim();
  if (!text) {
    return null;
  }
  const hyphen = /^(\S+)\s+-\s+(\S+)$/u.exec(text);
  if (hyphen) {
    const lower = parsePattern(hyphen[1]);
    const upper = parsePattern(hyphen[2]);
    if (!lower || !upper || lower.major === null || upper.major === null) {
      return null;
    }
    const ceiling = patternCeiling(upper);
    return [
      { version: patternFloor(lower), inclusive: true, direction: "lower" },
      {
        version: ceiling ?? patternFloor(upper),
        inclusive: ceiling === null,
        direction: "upper",
      },
    ];
  }
  const normalized = text.replace(/([<>]=?|=|\^|~)\s+/gu, "$1");
  const bounds: VersionBound[] = [];
  for (const token of normalized.split(/\s+/u)) {
    if (!token) {
      continue;
    }
    const match = /^(>=|<=|>|<|=|\^|~)?(.*)$/u.exec(token);
    if (!match) {
      return null;
    }
    const pattern = parsePattern(match[2]);
    if (!pattern) {
      return null;
    }
    const tokenBounds = boundsFor(match[1] ?? "", pattern);
    if (!tokenBounds) {
      return null;
    }
    bounds.push(...tokenBounds);
  }
  return bounds.length ? bounds : [];
}

/** Whether every bound of one AND group admits the version. */
function matchesBounds(version: string, bounds: readonly VersionBound[]): boolean {
  for (const bound of bounds) {
    const comparison = compareVersions(version, bound.version);
    if (bound.direction === "lower" && (comparison < 0 || (!bound.inclusive && comparison === 0))) {
      return false;
    }
    if (bound.direction === "upper" && (comparison > 0 || (!bound.inclusive && comparison === 0))) {
      return false;
    }
  }
  return true;
}

/** True when the string is a semver range the Extension engine accepts. */
export function isVersionRange(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) {
    return false;
  }
  if (trimmed === "*" || trimmed === "x" || trimmed === "X") {
    return true;
  }
  return trimmed.split("||").every((group) => compileGroup(group) !== null);
}

/**
 * Whether a host version satisfies an Extension range.
 *
 * Supports exact and partial versions, `x`/`*` wildcards, `^`, `~`, the
 * comparison operators, hyphen ranges, whitespace AND, and `||` OR. A
 * malformed version or range does not satisfy anything.
 */
export function satisfiesVersionRange(version: string, range: string): boolean {
  if (!isVersion(version) || !isVersionRange(range)) {
    return false;
  }
  const trimmed = range.trim();
  if (trimmed === "*" || trimmed === "x" || trimmed === "X") {
    return true;
  }
  return trimmed.split("||").some((group) => {
    const bounds = compileGroup(group);
    return bounds !== null && matchesBounds(version, bounds);
  });
}
