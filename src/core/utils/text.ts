/** Decode chart text as UTF-8, falling back to GB18030 for existing chart files. */
export function decodeChartText(bytes: AllowSharedBufferSource): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("gb18030").decode(bytes);
  }
}
