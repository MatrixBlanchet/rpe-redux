/** Selects media for one live document and follows resource references through history. */
import type { EditorSession } from "../../../../../../core/edit/session/session.ts";
import type { AssetMap } from "../../../../../../core/global/document/types.ts";
import type { Chart } from "../../../../../../core/global/chart/chart.ts";
import {
  assetBytes,
  assetPath,
  resourceReferences,
} from "../../../../../../core/global/document/resources.ts";
import { mediaType } from "../../../../../../core/media/mime.ts";
import { pickFiles } from "../../../../../platform/filePicker.ts";
import { mediaResourceName, prepareMediaFile } from "../../../chartMetadata/mediaFile.ts";
import type { CoverSource, MediaKind } from "../../../chartMetadata/MediaFields.tsx";
import { t } from "../../../../../../i18n/index.ts";

/** Host services the media picker reads and mutates. */
interface MetadataMediaOptions {
  getSession(): EditorSession;
  getAssets(): AssetMap;
  getChartName(): string;
  images: { load(chart: Chart, assets: AssetMap, chartName: string): void | Promise<void> };
  loadMusic(bytes: Uint8Array | string, name: string, updateMetadata?: boolean): Promise<void>;
  clearMusic(): void;
  reportError(error: unknown): void;
  changed(): void;
}

/** Tracks the open document's song and cover through chart and history changes. */
export function createMetadataMedia(options: MetadataMediaOptions) {
  let currentSession = options.getSession();
  let song = currentSession.chart.META.song;
  let background = currentSession.chart.META.background;
  let revision = 0;
  const requests = { song: 0, background: 0 };
  /** Re-reads the current session's media references and invalidates requests. */
  function reset() {
    currentSession = options.getSession();
    song = currentSession.chart.META.song;
    background = currentSession.chart.META.background;
    revision++;
    requests.song++;
    requests.background++;
  }
  /** Describes the current song and cover sources for the metadata fields. */
  function describe(session: EditorSession): {
    songName: string;
    song: CoverSource | null;
    coverName: string;
    cover: CoverSource | null;
  } {
    if (session !== options.getSession()) {
      return { songName: "", song: null, coverName: "", cover: null };
    }
    const assets = options.getAssets();
    const chartName = options.getChartName();
    const refs = resourceReferences(session.chart, assets, chartName);
    const path = assetPath(assets, refs.background, chartName);
    const bytes = assetBytes(assets, refs.background, chartName);
    const uri = path ? assets.uri?.(path) : undefined;
    const songPath = assetPath(assets, refs.song, chartName);
    const songBytes = assetBytes(assets, refs.song, chartName);
    const songUri = songPath ? assets.uri?.(songPath) : undefined;
    return {
      songName: songPath ? (refs.song.split("/").at(-1) ?? refs.song) : "",
      song:
        songBytes || songUri
          ? { bytes: songBytes ?? undefined, uri: songUri, type: mediaType(refs.song) }
          : null,
      coverName: path ? (refs.background.split("/").at(-1) ?? refs.background) : "",
      cover:
        bytes || uri ? { bytes: bytes ?? undefined, uri, type: mediaType(refs.background) } : null,
    };
  }
  /** Picks a song or cover file and commits its resource name into the chart. */
  async function pick(kind: MediaKind, session = options.getSession()): Promise<void> {
    const request = ++requests[kind];
    const files = await pickFiles({ accept: kind === "song" ? "audio/*" : "image/*" });
    if (!files?.[0] || options.getSession() !== session || request !== requests[kind]) {
      return;
    }
    const prepared = await prepareMediaFile(files[0], kind);
    if (options.getSession() !== session || request !== requests[kind]) {
      return;
    }
    const assets = options.getAssets();
    const name = mediaResourceName(prepared, assets.keys());
    assets.set(name, prepared.bytes);
    session.commitChart(
      t(kind === "song" ? "editor.app.commit.selectMusic" : "editor.app.commit.selectCover"),
      {
        ...session.chart,
        META: { ...session.chart.META, [kind]: name },
      },
      session.selectionState(),
      undefined,
      { normalized: true },
    );
  }
  /** Applies chart media-reference changes made by undo, history, or scripts. */
  function sync(): void {
    const session = options.getSession();
    if (session !== currentSession) {
      reset();
      return;
    }
    const chart = session.chart;
    const updateSong = chart.META.song !== song;
    const updateCover = chart.META.background !== background;
    if (!updateSong && !updateCover) {
      return;
    }
    song = chart.META.song;
    background = chart.META.background;
    const generation = ++revision;
    if (updateCover) {
      void Promise.resolve(
        options.images.load(chart, options.getAssets(), options.getChartName()),
      ).catch(options.reportError);
    }
    if (updateSong) {
      const assets = options.getAssets();
      const reference = resourceReferences(chart, assets, options.getChartName()).song;
      const bytes = assetBytes(assets, reference, options.getChartName());
      const path = assetPath(assets, reference, options.getChartName());
      const source = bytes ?? (path ? assets.uri?.(path) : undefined);
      if (!source) {
        options.clearMusic();
        return;
      }
      void options
        .loadMusic(source, reference, false)
        .then(() => {
          if (generation === revision && session === options.getSession()) {
            options.changed();
          }
        })
        .catch(options.reportError);
    }
  }
  return { reset, describe, pick, sync, dispose: reset };
}
