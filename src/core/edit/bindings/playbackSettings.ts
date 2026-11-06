/**
 * Applies playback settings values to the mounted audio transport.
 *
 * Settings are subscribed rather than read once, so a volume, hitsound or
 * realtime-alpha change takes effect without reopening the editor, and every
 * subscription is returned for teardown.
 */
import { values } from "../../state/values.ts";
import type { HitSoundKind } from "../../media/hitsounds.ts";
import type { AudioTransport } from "../../media/audio.ts";
import { editorRate } from "../state/publishedValues.ts";

interface PlaybackControlActions {
  setVolume(value: number): void;
  setHitSoundVolume?(kind: HitSoundKind, value: number): void;
  setRealtimeAlpha(value: number): void;
  invalidate(): void;
}

/** Subscribes playback settings and forwards each change to the transport; returns the disposer. */
export function bindPlaybackControls(actions: PlaybackControlActions): () => void {
  const settingKeys = [
    "volume",
    "hitsound-tap",
    "hitsound-drag",
    "hitsound-flick",
    "hitsound-custom",
    "realtime-alpha",
  ];
  const removeSettingsCommitters = settingKeys.map((id) =>
    values.byId.subscribe(id, () => {
      const value = values.byId.get<string | undefined>(id) ?? "";
      if (id === "volume") {
        actions.setVolume(Number(value));
      } else if (id.startsWith("hitsound-")) {
        const kind = id.slice("hitsound-".length);
        if (["tap", "drag", "flick", "custom"].includes(kind)) {
          actions.setHitSoundVolume?.(kind as HitSoundKind, Number(value));
        }
      } else if (id === "realtime-alpha") {
        actions.setRealtimeAlpha(Number(value));
        actions.invalidate();
      }
    }),
  );
  return () => {
    for (const dispose of removeSettingsCommitters) {
      dispose();
    }
  };
}

/** Applies the current editor rate and keeps the transport rate in sync; returns the unsubscribe. */
export function bindEditorPlaybackValues({
  audio,
  invalidate,
}: {
  audio: Pick<AudioTransport, "setRate">;
  invalidate(): void;
}): () => void {
  /** Applies a finite editor rate to the transport and invalidates the frame. */
  const applyRate = () => {
    const rate = Number(editorRate.get());
    if (Number.isFinite(rate)) {
      audio.setRate(rate);
      invalidate();
    }
  };
  applyRate();
  return editorRate.subscribeKey(applyRate);
}
