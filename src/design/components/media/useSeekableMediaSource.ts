/**
 * Resolves a media source that the browser can seek.
 *
 * The desktop shell serves bundled files without HTTP range support, so the
 * media engine reports them as unseekable even when they are fully buffered.
 * Reading a same-origin clip into a Blob URL restores seeking without touching
 * the host's asset protocol. A remote source, a data URL, or a Blob URL keeps
 * its own address so a large stream is not downloaded before the first frame.
 */
import { useEffect, useState } from "react";

/** Return the source URL the media element should use for seekable playback. */
export function useSeekableMediaSource(src: string): string {
  const [fetched, setFetched] = useState<{ src: string; url: string } | null>(null);

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    if (!src || src.startsWith("data:") || src.startsWith("blob:")) {
      return undefined;
    }
    try {
      const url = new URL(src, document.baseURI);
      if (url.origin !== location.origin || !/^https?:$/.test(url.protocol)) {
        return undefined;
      }
      void fetch(url.href, { credentials: "same-origin" })
        .then((response) => {
          if (!response.ok) {
            throw new Error(`Media request failed: ${response.status}`);
          }
          return response.blob();
        })
        .then((blob) => {
          if (!active) {
            return;
          }
          objectUrl = URL.createObjectURL(blob);
          setFetched({ src, url: objectUrl });
        })
        .catch(() => {
          // Keeping the direct source is still enough for playback; only the
          // transport's seek rail is limited on hosts without range support.
        });
    } catch {
      // A malformed URL is left to the media element's own error event.
    }
    return () => {
      active = false;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [src]);

  return fetched?.src === src ? fetched.url : src;
}
