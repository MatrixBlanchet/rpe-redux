/**
 * A shared asynchronous image with the common skeleton and failure states.
 *
 * Callers own the surrounding sized surface; this primitive owns the decode
 * handshake so media buttons, asset thumbnails, texture swatches, and cover
 * previews do not each re-declare the same loaded/failed state machine.
 */
import { useState, type ReactNode } from "react";

export interface AsyncImageProps {
  src?: string;
  alt?: string;
  /** Applied to the `<img>`; the skeleton sits beside it. */
  className?: string;
  /** Added once the current source decodes. */
  loadedClassName?: string;
  loading?: "eager" | "lazy";
  decoding?: "async" | "sync" | "auto";
  draggable?: boolean;
  /** Rendered when the source is absent or fails to decode. */
  fallback?: ReactNode;
}

/** Shows the source image, a skeleton until it decodes, and the fallback on failure. */
export function AsyncImage({
  src,
  alt = "",
  className,
  loadedClassName = "is-loaded",
  loading,
  decoding,
  draggable = false,
  fallback = null,
}: AsyncImageProps) {
  const [loadedSrc, setLoadedSrc] = useState("");
  const [failedSrc, setFailedSrc] = useState("");

  if (!src || failedSrc === src) {
    return <>{fallback}</>;
  }

  const loaded = loadedSrc === src;
  return (
    <>
      {!loaded && <span className="redux-image-skeleton" aria-hidden="true" />}
      <img
        src={src}
        alt={alt}
        draggable={draggable}
        loading={loading}
        decoding={decoding}
        className={`${className ?? ""}${loaded ? ` ${loadedClassName}` : ""}`.trim()}
        onLoad={() => setLoadedSrc(src)}
        onError={() => setFailedSrc(src)}
      />
    </>
  );
}
