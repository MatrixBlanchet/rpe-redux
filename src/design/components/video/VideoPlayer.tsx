/**
 * A silent video player for the design system.
 *
 * It drives one native `<video>` element but paints its own transport inside
 * the frame: the play button and progress rail appear over the bottom edge on
 * hover or keyboard focus. Audio is deliberately always muted; callers choose a
 * clip range and the player owns seeking, play/pause, and end-of-range looping.
 */
import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useTranslation } from "../../../i18n/react.ts";
import { Icon } from "../icon/Icon.tsx";
import { formatMediaTime, mediaSeconds } from "../media/mediaTime.ts";
import { useSeekableMediaSource } from "../media/useSeekableMediaSource.ts";

export interface VideoPlayerProps {
  /** Video URL. Bundled assets can be resolved with `assetUrl()`. */
  src: string;
  /** Accessible name for the player and its frame. */
  label: string;
  /** Optional still shown before the first frame is available. */
  poster?: string;
  /** Clip start in seconds; defaults to the beginning of the file. */
  startAt?: number;
  /** Clip end in seconds; omitted means the end of the file. */
  endAt?: number;
  /** Start playing as soon as the clip has metadata. */
  autoPlay?: boolean;
  /** Hide the transport and progress rail entirely. */
  hideControls?: boolean;
  /** Replay the clip range from its start when it reaches the end. */
  loop?: boolean;
  className?: string;
}

/** A muted player with an explicit clip range and in-frame hover transport. */
export function VideoPlayer({
  src,
  label,
  poster,
  startAt,
  endAt,
  autoPlay = false,
  hideControls = false,
  loop = false,
  className = "",
}: VideoPlayerProps) {
  const { t } = useTranslation();
  const media = useRef<HTMLVideoElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const pendingSeek = useRef(0);
  const autoplayKey = useRef("");
  const dragging = useRef(false);
  const playbackSrc = useSeekableMediaSource(src);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [draggingState, setDraggingState] = useState(false);
  const [failed, setFailed] = useState(false);

  const begin = mediaSeconds(startAt) ?? 0;
  const finish = mediaSeconds(endAt);

  useEffect(() => {
    const element = media.current;
    if (!element) {
      return;
    }
    autoplayKey.current = "";
    pendingSeek.current = begin;
    element.pause();
    setCurrent(begin);
    setPlaying(false);
    setFailed(false);
    if (element.readyState >= HTMLMediaElement.HAVE_METADATA) {
      const total = Number.isFinite(element.duration) ? element.duration : 0;
      const stop = finish !== undefined ? Math.min(finish, total) : total;
      setDuration(Math.max(0, stop - begin));
      element.currentTime = begin;
    }
  }, [src, begin, finish]);

  useEffect(() => {
    if (!autoPlay) {
      autoplayKey.current = "";
      return;
    }
    const element = media.current;
    if (!element) {
      return;
    }
    const key = `${playbackSrc}|${begin}|${finish ?? "end"}`;
    if (autoplayKey.current === key) {
      return;
    }
    autoplayKey.current = key;
    const start = () => {
      element.currentTime = begin;
      void element.play().catch(() => setPlaying(false));
    };
    if (element.readyState >= HTMLMediaElement.HAVE_METADATA) {
      start();
      return;
    }
    element.addEventListener("loadedmetadata", start, { once: true });
    return () => element.removeEventListener("loadedmetadata", start);
  }, [autoPlay, playbackSrc, begin, finish]);

  /** Recompute the clip length from media metadata and re-seat the playhead. */
  const syncDuration = () => {
    const element = media.current;
    if (!element) {
      return;
    }
    const total = Number.isFinite(element.duration) ? element.duration : 0;
    const start = Math.min(pendingSeek.current, total);
    const stop = finish !== undefined ? Math.min(finish, total) : total;
    setDuration(Math.max(0, stop - start));
    if (Math.abs(element.currentTime - start) > 0.01) {
      element.currentTime = start;
    }
    setCurrent(element.currentTime);
  };

  /** Start playback inside the clip range, restarting when the playhead sits at its end. */
  const play = () => {
    const element = media.current;
    if (!element) {
      return;
    }
    if (element.currentTime < begin) {
      element.currentTime = begin;
    }
    if (finish !== undefined && element.currentTime >= finish - 0.04) {
      element.currentTime = begin;
    }
    void element.play().catch(() => setPlaying(false));
  };

  /** Play or pause depending on the element's current state. */
  const toggle = () => {
    const element = media.current;
    if (!element) {
      return;
    }
    if (element.paused) {
      play();
    } else {
      element.pause();
    }
  };

  /** Move the playhead to an offset from the clip start, clamped to the clip. */
  const seek = (value: number) => {
    const element = media.current;
    if (!element || !Number.isFinite(value)) {
      return;
    }
    const target = begin + Math.max(0, Math.min(value, duration));
    element.currentTime = target;
    setCurrent(target);
  };

  /** Map a pointer x-coordinate on the rail onto a clip offset. */
  const seekFromClientX = (clientX: number): void => {
    const element = track.current;
    if (!element || duration <= 0) {
      return;
    }
    const rect = element.getBoundingClientRect();
    if (rect.width <= 0) {
      return;
    }
    seek(((clientX - rect.left) / rect.width) * duration);
  };

  /** Begin a rail drag and seek to the pressed position. */
  const onTrackPointerDown = (event: ReactPointerEvent<HTMLDivElement>): void => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragging.current = true;
    setDraggingState(true);
    seekFromClientX(event.clientX);
  };

  /** Follow the pointer while the rail drag is active. */
  const onTrackPointerMove = (event: ReactPointerEvent<HTMLDivElement>): void => {
    if (dragging.current) {
      seekFromClientX(event.clientX);
    }
  };

  /** End a rail drag and release pointer capture. */
  const endDrag = (event: ReactPointerEvent<HTMLDivElement>): void => {
    dragging.current = false;
    setDraggingState(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  /** Arrow, Home, and End keys move the playhead along the rail. */
  const onTrackKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>): void => {
    const step = Math.max(0.5, duration / 20);
    let next: number | null = null;
    if (event.key === "ArrowLeft") {
      next = Math.max(0, position - step);
    } else if (event.key === "ArrowRight") {
      next = Math.min(duration, position + step);
    } else if (event.key === "Home") {
      next = 0;
    } else if (event.key === "End") {
      next = duration;
    }
    if (next !== null) {
      event.preventDefault();
      seek(next);
    }
  };

  const segment = duration > 0 ? duration : 0;
  const position = Math.max(0, Math.min(current - begin, segment));
  const ratio = segment > 0 ? position / segment : 0;

  return (
    <div
      className={`redux-video ${className}`}
      data-failed={failed ? "true" : undefined}
      data-controls={hideControls ? "hidden" : "visible"}
    >
      <div className="redux-video-frame">
        <video
          ref={media}
          src={playbackSrc}
          data-source={src}
          poster={poster}
          muted
          playsInline
          preload="metadata"
          aria-label={label}
          onClick={hideControls ? undefined : toggle}
          onLoadedMetadata={syncDuration}
          onTimeUpdate={(event) => {
            const element = event.currentTarget;
            setCurrent(element.currentTime);
            if (finish !== undefined && element.currentTime >= finish - 0.02) {
              if (loop) {
                element.currentTime = begin;
                setCurrent(begin);
                if (element.paused) {
                  void element.play().catch(() => setPlaying(false));
                }
              } else {
                element.pause();
                if (element.currentTime > finish) {
                  element.currentTime = finish;
                }
                setCurrent(finish);
              }
            }
          }}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => {
            if (loop) {
              const element = media.current;
              if (element) {
                element.currentTime = begin;
                void element.play().catch(() => setPlaying(false));
              }
              return;
            }
            setPlaying(false);
          }}
          onError={() => setFailed(true)}
        />
        {!hideControls && !playing && (
          <button
            type="button"
            className="redux-video-overlay"
            aria-label={t("design.video.play")}
            data-tip-title={t("design.video.play")}
            onClick={toggle}
          >
            <span className="redux-video-overlay-icon">
              <Icon name="playbackPlay" size={30} />
            </span>
          </button>
        )}
        <span className="redux-video-silent">{t("design.video.silent")}</span>
        {!hideControls && (
          <div
            className="redux-media-controls redux-video-controls"
            data-dragging={draggingState || undefined}
          >
            <button
              type="button"
              className="redux-media-button"
              aria-label={playing ? t("design.video.pause") : t("design.video.play")}
              data-tip-title={playing ? t("design.video.pause") : t("design.video.play")}
              onClick={toggle}
            >
              <Icon name={playing ? "playbackPause" : "playbackPlay"} size={17} />
            </button>
            <span className="redux-media-time">{formatMediaTime(position)}</span>
            <div
              ref={track}
              className="redux-media-track"
              role="slider"
              tabIndex={0}
              aria-label={t("design.video.seek")}
              aria-valuemin={0}
              aria-valuemax={segment}
              aria-valuenow={Math.round(position * 100) / 100}
              aria-valuetext={`${formatMediaTime(position)} / ${formatMediaTime(segment)}`}
              aria-disabled={segment <= 0 || undefined}
              onPointerDown={onTrackPointerDown}
              onPointerMove={onTrackPointerMove}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
              onLostPointerCapture={() => {
                dragging.current = false;
                setDraggingState(false);
              }}
              onKeyDown={onTrackKeyDown}
            >
              <span className="redux-media-track-fill" style={{ width: `${ratio * 100}%` }} />
              <span className="redux-media-track-thumb" style={{ left: `${ratio * 100}%` }} />
            </div>
            <span className="redux-media-time">{formatMediaTime(segment)}</span>
          </div>
        )}
      </div>
      {failed && (
        <p className="redux-video-error" role="alert">
          {t("design.video.unavailable")}
        </p>
      )}
    </div>
  );
}
