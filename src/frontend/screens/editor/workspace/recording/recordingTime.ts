/** Parse and format the song-time values used by the recording range. */

/** `m:ss.mmm`, or `h:mm:ss.mmm` past an hour. */
export function formatRecordingTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return "0:00.000";
  }
  // Truncate rather than round: a duration that is a fraction of a millisecond
  // above the displayed value must not read back as a later, rejected time.
  const totalMilliseconds = Math.floor(seconds * 1000 + 1e-6);
  const hours = Math.floor(totalMilliseconds / 3_600_000);
  const minutes = Math.floor((totalMilliseconds % 3_600_000) / 60_000);
  const remainder = totalMilliseconds % 60_000;
  const wholeSeconds = Math.floor(remainder / 1000);
  const milliseconds = remainder % 1000;
  const minuteText = hours > 0 ? String(minutes).padStart(2, "0") : String(minutes);
  return `${hours > 0 ? `${hours}:` : ""}${minuteText}:${String(wholeSeconds).padStart(2, "0")}.${String(milliseconds).padStart(3, "0")}`;
}

/**
 * Parse a song time as seconds or `m:ss.mmm` / `h:mm:ss.mmm`.
 *
 * Returns null for text that is not a time. Minutes and hours must be whole
 * numbers; the seconds part may carry a fraction. A value outside the caller's
 * range is still parsed, so the owner can reject it with its own message.
 */
export function parseRecordingTime(text: string): number | null {
  const trimmed = text.trim();
  if (!trimmed) {
    return null;
  }
  if (/^\+?(?:\d+\.?\d*|\.\d+)$/.test(trimmed)) {
    return Number(trimmed);
  }
  const parts = trimmed.split(":");
  if (parts.length < 2 || parts.length > 3) {
    return null;
  }
  const values = parts.map((part) => Number(part));
  if (values.some((value) => !Number.isFinite(value) || value < 0)) {
    return null;
  }
  // Only the last part owns a fraction; an hour or minute fraction would read
  // as a decimal minute and make the notation ambiguous.
  if (!Number.isInteger(values[parts.length - 2])) {
    return null;
  }
  if (parts.length === 3 && !Number.isInteger(values[0])) {
    return null;
  }
  let seconds = 0;
  for (const value of values) {
    seconds = seconds * 60 + value;
  }
  return seconds;
}
