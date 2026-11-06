/**
 * Projects chart-independent settings values onto runtime owners.
 *
 * The session, its event wheel steps and hitsound compilation read their policy
 * here. Changing hitsound offsets clears the compiled sounds because the
 * compiled buffer is keyed on those offsets.
 */
import type { HitSounds } from "../../media/hitsounds.ts";
import type { HitSoundOffsetMap } from "../../media/hitTimeline.ts";
import type { EditorSession } from "../session/session.ts";
import { values } from "../../state/values.ts";
import "../../settings/editorRuntime.ts";
import "../../settings/features/index.ts";

const hitSoundLimitEnabled = values.getHandle<boolean>("hitsound-limit-enabled");
const hitSoundLimit = values.getHandle<string | undefined>("hitsound-limit");
const eventWheelIncrements = values.getHandle<string | undefined>("event-wheel-increments");

/** Decodes persisted runtime settings for the session and playback owners. */
function numberArray(value: string | undefined): number[] {
  if (!value) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map((entry) => Number(entry)) : [];
  } catch {
    return [];
  }
}

/** True when both offset maps agree on every hitsound kind. */
function sameOffsets(left: HitSoundOffsetMap, right: HitSoundOffsetMap): boolean {
  return ["tap", "drag", "flick", "custom"].every(
    (kind) => left[kind as keyof HitSoundOffsetMap] === right[kind as keyof HitSoundOffsetMap],
  );
}

/** Reads hitsound offsets in seconds from the persisted millisecond settings. */
function soundOffsets(): HitSoundOffsetMap {
  return Object.fromEntries(
    ["tap", "drag", "flick", "custom"].map((kind) => [
      kind,
      Number(values.byId.get<string | undefined>(`hitsound-offset-${kind}`) ?? 0) / 1000,
    ]),
  );
}

/** Applies chart-independent settings values to runtime owners. */
export function applySessionRuntimeSettings(
  session: EditorSession,
  hitSounds: Pick<HitSounds, "soundPolicy" | "offsets" | "compiled">,
): void {
  hitSounds.soundPolicy.enabled = hitSoundLimitEnabled.get();
  hitSounds.soundPolicy.limit = Number(hitSoundLimit.get() ?? 5);
  const offsets = soundOffsets();
  if (!sameOffsets(offsets, hitSounds.offsets)) {
    hitSounds.offsets = offsets;
    hitSounds.compiled = null;
  }
  const scrollIncrements = numberArray(eventWheelIncrements.get());
  session.eventWheelSteps = Object.fromEntries(
    [
      "moveXEvents",
      "moveYEvents",
      "rotateEvents",
      "alphaEvents",
      "speedEvents",
      "scaleXEvents",
      "scaleYEvents",
    ].flatMap((key, index) =>
      Number.isFinite(scrollIncrements[index]) ? [[key, scrollIncrements[index]]] : [],
    ),
  );
}
