/**
 * Downloads a generated blob through a temporary anchor.
 *
 * The shell uses it for exports and backups; the object URL is revoked after the
 * click has had time to start.
 */
/** Downloads a blob under a file-system-safe name through a temporary anchor. */
export function download(blob: Blob, name: string): void {
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.href = url;
  // eslint-disable-next-line no-control-regex -- stripping control characters is the point
  link.download = name.replace(/[<>:"/\\|?*\x00-\x1f]/g, "_");
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
