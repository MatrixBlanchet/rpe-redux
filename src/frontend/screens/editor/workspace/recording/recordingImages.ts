/** Snapshots chart images and samples animated textures on the recording clock. */
import type { ImageRecord, ProjectImages } from "../../../../../core/media/images.ts";
import { mediaType } from "../../../../../core/media/mime.ts";
import { toArrayBuffer } from "../../../../../core/utils/bytes.ts";
import type { PreviewImages } from "../preview/scene/previewTypes.ts";

interface RecordingImage {
  source: ImageBitmap;
  naturalWidth: number;
  naturalHeight: number;
}
interface Animation {
  name: string;
  decoder: ImageDecoder;
  ends: number[];
  repetitions: number;
  current: number;
}

/** A recording owns its image copies so later document edits cannot release them. */
export interface RecordingImages {
  readonly images: PreviewImages;
  /** Select image frames at an absolute song time before sampling the scene. */
  sample(seconds: number, signal?: AbortSignal): Promise<void>;
  dispose(): void;
}

/** Reads one animated image as a frame schedule for the recording clock. */
async function animatedRecord(record: ImageRecord, signal?: AbortSignal): Promise<Animation> {
  const type = /\.apng$/i.test(record.name) ? "image/png" : mediaType(record.name);
  if (typeof ImageDecoder === "undefined" || !(await ImageDecoder.isTypeSupported(type))) {
    throw new Error(`recording_image_decoder_unavailable:${record.name}`);
  }
  const data = record.bytes
    ? toArrayBuffer(record.bytes)
    : await fetch(record.uri ?? "", { signal }).then((response) => {
        if (!response.ok) {
          throw new Error(`recording_image_unavailable:${record.name}`);
        }
        return response.arrayBuffer();
      });
  const decoder = new ImageDecoder({ data, type, preferAnimation: true });
  try {
    await decoder.tracks.ready;
    await decoder.completed;
    const track = decoder.tracks.selectedTrack;
    if (!track || track.frameCount < 1) {
      throw new Error(`recording_image_unavailable:${record.name}`);
    }
    const ends: number[] = [];
    let total = 0;
    for (let index = 0; index < track.frameCount; index++) {
      signal?.throwIfAborted();
      const { image } = await decoder.decode({ frameIndex: index });
      // A missing or zero duration is held for 100 ms, as for a static image.
      total += image.duration && image.duration > 0 ? image.duration / 1_000_000 : 0.1;
      image.close();
      ends.push(total);
    }
    return { name: record.name, decoder, ends, repetitions: track.repetitionCount, current: -1 };
  } catch (error) {
    decoder.close();
    throw error;
  }
}

/** Decode and copy each image before rendering the first frame. */
export async function snapshotRecordingImages(
  source: ProjectImages,
  signal?: AbortSignal,
): Promise<RecordingImages> {
  const generation = source.generation;
  const result = new Map<string, RecordingImage>();
  const animations: Animation[] = [];
  const dispose = () => {
    for (const image of result.values()) {
      image.source.close();
    }
    for (const animation of animations) {
      animation.decoder.close();
    }
    result.clear();
    animations.length = 0;
  };
  try {
    for (const record of source.records.values()) {
      signal?.throwIfAborted();
      if (record.animated) {
        animations.push(await animatedRecord(record, signal));
      } else {
        // A decode already in flight may have started at preview resolution.
        while (!record.failed && (!record.image || record.scale < 1)) {
          signal?.throwIfAborted();
          source.texture(record.name, 1);
          await record.pending;
          if (generation !== source.generation) {
            throw new Error("recording_resources_changed");
          }
        }
        const decoded = record.image;
        if (!decoded) {
          throw new Error(`recording_image_unavailable:${record.name}`);
        }
        const bitmap = await createImageBitmap(decoded.source);
        result.set(record.name, {
          source: bitmap,
          naturalWidth: decoded.naturalWidth,
          naturalHeight: decoded.naturalHeight,
        });
      }
      if (generation !== source.generation) {
        throw new Error("recording_resources_changed");
      }
    }
    const backgroundName = source.backgroundName;
    const images: PreviewImages = {
      backgroundName,
      background: result.get(backgroundName) ?? null,
      backgroundAnimated: animations.some((item) => item.name === backgroundName),
      texture: (name) => result.get(name) ?? null,
      describe: (name) => result.get(name),
      trim: () => {},
    };
    const sample = async (seconds: number, signal?: AbortSignal) => {
      for (const animation of animations) {
        signal?.throwIfAborted();
        const length = animation.ends.at(-1) ?? 0.1;
        const elapsed = Math.max(0, seconds);
        const ended =
          Number.isFinite(animation.repetitions) && elapsed >= length * (animation.repetitions + 1);
        const time = ended ? length : elapsed % length;
        const found = animation.ends.findIndex((end) => time < end);
        const index = found < 0 ? animation.ends.length - 1 : found;
        if (index === animation.current) {
          continue;
        }
        const { image } = await animation.decoder.decode({ frameIndex: index });
        try {
          const bitmap = await createImageBitmap(image);
          result.get(animation.name)?.source.close();
          result.set(animation.name, {
            source: bitmap,
            naturalWidth: image.displayWidth,
            naturalHeight: image.displayHeight,
          });
          animation.current = index;
        } finally {
          image.close();
        }
      }
      images.background = result.get(backgroundName) ?? null;
    };
    await sample(0, signal);
    return { images, sample, dispose };
  } catch (error) {
    dispose();
    throw error;
  }
}
