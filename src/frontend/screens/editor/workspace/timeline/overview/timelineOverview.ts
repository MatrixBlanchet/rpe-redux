/**
 * Draws the timeline overview strips: chart density, edit history, the current-time
 * marker, and drag seeking.
 *
 * Hovering a strip feeds the floating thumbnail preview; chart sampling and
 * navigation math come from core.
 */
import type { Chart } from "../../../../../../core/global/chart/chart.ts";
import type { TempoMap } from "../../../../../../core/global/chart/timing/tempo.ts";
import type { RecentEdit } from "../../../../../../core/edit/session/session.ts";
import type { HistoryEntries } from "../../../../../../core/edit/session/history.ts";
import type { TimelineActivity } from "../../../../../../core/edit/timeline/activity.ts";
import { clamp } from "../../../../../../core/utils/numbers.ts";
import { prepareCanvas } from "../../../canvas/canvas2d.ts";
import type { TimelineThumbnail } from "./timelineThumbnail.ts";
import {
  sameOverviewFrame,
  sameOverviewStripKey,
  type OverviewFrameKey,
  type OverviewStripKey,
} from "./overviewFrameKey.ts";
import {
  type TimelineBindingsState,
  type TimelineOverviewBindings,
} from "../surface/timelineBindings.ts";
import { t } from "../../../../../../i18n/index.ts";
import { setTransientTooltip } from "../../../../../../design/patterns/TooltipHost.tsx";
import { readCanvasPalette, type CanvasPalette } from "../../../canvas/palette.ts";

interface StripKey extends OverviewStripKey {
  chart: Chart;
  palette: CanvasPalette;
}

interface StripCache extends StripKey {
  note: HTMLCanvasElement;
  history: HTMLCanvasElement;
}

export interface TimelineOverviewSnapshot {
  chart: Chart;
  tempo: TempoMap;
  lineIndex: number;
  layer: number;
  extended: boolean;
  mediaDuration: number;
  currentSeconds: number;
  offsetSeconds: number;
  recentEdits: readonly RecentEdit[];
  historyEntries: HistoryEntries;
  /** Changes only when the history stacks or document change. */
  historyRevision: number;
  hasDocument: boolean;
  atHome: boolean;
}

export interface TimelineOverviewOptions {
  densityCanvas: HTMLCanvasElement;
  historyCanvas: HTMLCanvasElement;
  /** The editing canvases the strips are drawn to match. */
  timeline: { notesCanvas: HTMLCanvasElement; eventsCanvas: HTMLCanvasElement };
  activity: Pick<TimelineActivity, "compile" | "density" | "duration">;
  thumbnail: Pick<TimelineThumbnail, "show" | "hide">;
  bindings: TimelineBindingsState;
  densityBarsEnabled: () => boolean;
  hoverPreviewEnabled: () => boolean;
  getSnapshot: () => TimelineOverviewSnapshot;
  seek: (seconds: number) => void;
  jumpToHistory: (entryId: number) => boolean;
  centerTimeline: (start: number, end: number) => void;
}

export interface HistoryBarGeometry {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** True when two history entries share a start beat, so they can stack in one lane. */
function sameHistoryAnchor(left: RecentEdit, right: RecentEdit): boolean {
  return left.start === right.start;
}

/** Keep drawing and pointer hit-testing on the same song-time/lane geometry. */
export function historyBarGeometry(
  entries: readonly RecentEdit[],
  index: number,
  duration: number,
  width: number,
  height: number,
): HistoryBarGeometry | null {
  const entry = entries[index];
  if (!entry || !duration || !width || !height) {
    return null;
  }
  const start = clamp(entry.start, 0, duration);
  const end = clamp(entry.end, start, duration);
  const lanes = entries.filter((candidate) => sameHistoryAnchor(candidate, entry));
  const lane = entries
    .slice(0, index)
    .filter((candidate) => sameHistoryAnchor(candidate, entry)).length;
  const gap = lanes.length > 1 ? 1 : 0;
  const usableWidth = Math.max(1, width - 4);
  const laneWidth = Math.max(2, (usableWidth - gap * (lanes.length - 1)) / lanes.length);
  const y1 = height - (end / duration) * height;
  const y2 = height - (start / duration) * height;
  return {
    x: 2 + lane * (laneWidth + gap),
    y: Math.min(y1, y2) - 1,
    width: laneWidth,
    height: Math.max(2, Math.abs(y2 - y1) + 2),
  };
}

/** The history bar under a strip-local pointer, preferring the newest entry. */
export function hitHistoryBar(
  entries: readonly RecentEdit[],
  duration: number,
  width: number,
  height: number,
  x: number,
  y: number,
): RecentEdit | null {
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const geometry = historyBarGeometry(entries, index, duration, width, height);
    if (
      geometry &&
      x >= geometry.x &&
      x <= geometry.x + geometry.width &&
      y >= geometry.y &&
      y <= geometry.y + geometry.height
    ) {
      return entries[index];
    }
  }
  return null;
}

/** Owns the timeline's density/history strip drawing, hover preview and drag seeking. */
export class TimelineOverview {
  private readonly options: TimelineOverviewOptions;
  private cache: StripCache | null = null;
  private lastSeek = -Infinity;
  private pendingSeek: ReturnType<typeof setTimeout> | undefined;
  private pendingSeconds = 0;
  private seekingCanvas: HTMLCanvasElement | null = null;
  private pressedHistoryEntry: RecentEdit | null = null;
  private shownHistoryLabel = "";
  private readonly bindings: TimelineOverviewBindings;
  private readonly bindingState: TimelineBindingsState;
  private drawnFrame: OverviewFrameKey | null = null;
  private disposed = false;

  /** Bind both strips to the supplied canvases and publish their bindings. */
  constructor(options: TimelineOverviewOptions) {
    this.options = options;
    this.bindingState = options.bindings;
    this.bindings = {
      density: this.stripBindings(options.densityCanvas),
      history: this.stripBindings(options.historyCanvas),
    };
    this.bindingState.overview.set(this.bindings);
  }

  /** Paint both strips using the same chart-time sample as the timeline frame. */
  draw(currentSeconds?: number): void {
    const { densityCanvas, historyCanvas, activity } = this.options;
    if (!this.options.densityBarsEnabled()) {
      this.options.thumbnail.hide();
      return;
    }
    if (!this.options.hoverPreviewEnabled()) {
      this.options.thumbnail.hide();
    }
    const snapshot = this.options.getSnapshot();
    const palette = readCanvasPalette();
    // Only one editing field can be visible at a time in the exclusive layouts,
    // and the hidden canvas reports a zero height. The strips match whichever
    // field is actually on screen.
    const height =
      this.options.timeline.notesCanvas.clientHeight ||
      this.options.timeline.eventsCanvas.clientHeight;
    const width = densityCanvas.clientWidth;
    if (!height || !width) {
      this.drawnFrame = null;
      return;
    }
    activity.compile(snapshot.chart, snapshot.tempo);
    const duration = Math.max(
      0.001,
      snapshot.mediaDuration > 0 ? snapshot.mediaDuration : activity.duration,
    );
    const historyEntries = snapshot.recentEdits;
    const key: StripKey = {
      chart: snapshot.chart,
      line: snapshot.lineIndex,
      layer: snapshot.layer,
      extended: snapshot.extended,
      duration,
      width,
      historyWidth: historyCanvas.clientWidth,
      height,
      historyRevision: snapshot.historyRevision,
      palette,
    };
    const markerY =
      height - (clamp(currentSeconds ?? snapshot.currentSeconds, 0, duration) / duration) * height;
    if (sameOverviewFrame(this.drawnFrame, { ...key, markerY })) {
      return;
    }
    let cached = this.cache;
    if (!cached || !sameOverviewStripKey(cached, key)) {
      const noteFrame = this.createStripCanvas(width, height);
      const historyFrame = this.createStripCanvas(historyCanvas.clientWidth, height);
      const { bins, noteBins, eventBins, maximum } = activity.density(
        snapshot.lineIndex,
        snapshot.layer,
        snapshot.extended,
        duration,
        height,
      );
      const logarithm = Math.log1p(maximum);
      const half = Math.max(1, width / 2 - 2);
      for (let index = 0; index < bins; index++) {
        const y = height - ((index + 1) * height) / bins;
        const barHeight = Math.max(1, height / bins - 1);
        const noteValue = noteBins[index] ? Math.log1p(noteBins[index]) / logarithm : 0;
        const eventValue = eventBins[index] ? Math.log1p(eventBins[index]) / logarithm : 0;
        if (noteValue) {
          noteFrame.context.fillStyle = palette.noteTap;
          noteFrame.context.globalAlpha = noteValue;
          noteFrame.context.fillRect(2, y, half, barHeight);
        }
        if (eventValue) {
          noteFrame.context.fillStyle = palette.eventFill;
          noteFrame.context.globalAlpha = eventValue;
          noteFrame.context.fillRect(width - half - 2, y, half, barHeight);
        }
      }
      const historyWidth = historyCanvas.clientWidth;
      const activeHistoryIds = new Set(snapshot.historyEntries.undo.map((entry) => entry.id));
      historyEntries.forEach((entry, index) => {
        const geometry = historyBarGeometry(historyEntries, index, duration, historyWidth, height);
        if (!geometry) {
          return;
        }
        const active = activeHistoryIds.has(entry.entryId);
        historyFrame.context.globalAlpha = active
          ? Math.max(0.35, (index + 1) / Math.max(1, historyEntries.length))
          : 0.2;
        historyFrame.context.fillStyle = active ? palette.eventSelectedFill : palette.outline;
        historyFrame.context.fillRect(geometry.x, geometry.y, geometry.width, geometry.height);
        historyFrame.context.strokeStyle = active ? palette.eventSelectedStroke : palette.outline;
        historyFrame.context.strokeRect(
          geometry.x + 0.5,
          geometry.y + 0.5,
          Math.max(1, geometry.width - 1),
          Math.max(1, geometry.height - 1),
        );
      });
      historyFrame.context.globalAlpha = 1;
      cached = { ...key, note: noteFrame.canvas, history: historyFrame.canvas };
      this.cache = cached;
    }
    const noteFrame = prepareCanvas(densityCanvas);
    const historyFrame = prepareCanvas(historyCanvas);
    noteFrame.context.drawImage(cached.note, 0, 0, width, height);
    historyFrame.context.drawImage(cached.history, 0, 0, historyCanvas.clientWidth, height);
    for (const frame of [noteFrame, historyFrame]) {
      frame.context.strokeStyle = palette.bottomValue;
      frame.context.lineWidth = 1;
      frame.context.beginPath();
      frame.context.moveTo(0, markerY + 0.5);
      frame.context.lineTo(frame.width, markerY + 0.5);
      frame.context.stroke();
    }
    this.drawnFrame = { ...key, markerY };
  }

  /** Release timers, tooltip, and published bindings. */
  dispose(): void {
    this.disposed = true;
    clearTimeout(this.pendingSeek);
    this.pendingSeek = undefined;
    this.pressedHistoryEntry = null;
    this.clearHistoryTooltip();
    if (this.bindingState.overview.get() === this.bindings) {
      this.bindingState.overview.set(null);
    }
  }

  /** Pointer bindings for one overview strip. */
  private stripBindings(strip: HTMLCanvasElement) {
    return {
      pointerDown: (event: PointerEvent) => {
        if (this.disposed) {
          return;
        }
        if (strip === this.options.historyCanvas) {
          const historyEntry = this.historyEntryAt(event);
          this.updateHistoryTooltip(historyEntry, event);
          if (historyEntry) {
            this.pressedHistoryEntry = historyEntry;
            strip.setPointerCapture?.(event.pointerId);
            this.previewOnStrip(strip, event);
            return;
          }
        }
        this.seekingCanvas = strip;
        strip.setPointerCapture?.(event.pointerId);
        this.seekFromStrip(strip, event);
        this.previewOnStrip(strip, event);
      },
      pointerMove: (event: PointerEvent) => {
        if (this.disposed) {
          return;
        }
        if (strip === this.options.historyCanvas) {
          const historyEntry = this.historyEntryAt(event);
          this.updateHistoryTooltip(historyEntry, event);
          if (this.pressedHistoryEntry) {
            this.previewOnStrip(strip, event);
            return;
          }
        }
        if (this.seekingCanvas === strip) {
          this.seekFromStrip(strip, event);
        }
        this.previewOnStrip(strip, event);
      },
      pointerUp: (event: PointerEvent) => {
        if (this.disposed) {
          return;
        }
        if (strip === this.options.historyCanvas && this.pressedHistoryEntry) {
          const pressed = this.pressedHistoryEntry;
          const historyEntry = this.historyEntryAt(event);
          this.pressedHistoryEntry = null;
          strip.releasePointerCapture?.(event.pointerId);
          if (historyEntry?.entryId === pressed.entryId && this.isActiveHistoryEntry(pressed)) {
            if (this.options.jumpToHistory(pressed.entryId)) {
              this.options.centerTimeline(pressed.start, pressed.end);
            }
          }
          this.updateHistoryTooltip(historyEntry, event);
          return;
        }
        if (this.seekingCanvas === strip) {
          this.seekFromStrip(strip, event, true);
          this.seekingCanvas = null;
        }
      },
      pointerLeave: () => {
        if (this.disposed) {
          return;
        }
        if (this.seekingCanvas !== strip) {
          this.options.thumbnail.hide();
        }
        if (strip === this.options.historyCanvas && !this.pressedHistoryEntry) {
          this.updateHistoryTooltip(null);
        }
      },
    };
  }

  /** History entry under a pointer event on the history strip. */
  private historyEntryAt(event: PointerEvent): RecentEdit | null {
    const rect = this.options.historyCanvas.getBoundingClientRect();
    const snapshot = this.options.getSnapshot();
    return hitHistoryBar(
      snapshot.recentEdits,
      this.duration(),
      this.options.historyCanvas.clientWidth,
      this.stripHeight(),
      event.clientX - rect.left,
      event.clientY - rect.top,
    );
  }

  /** The editing field's height; the hidden field reports zero. */
  private stripHeight(): number {
    return (
      this.options.timeline.notesCanvas.clientHeight ||
      this.options.timeline.eventsCanvas.clientHeight
    );
  }

  /** True when the entry is still on the undo stack. */
  private isActiveHistoryEntry(entry: RecentEdit): boolean {
    return this.options
      .getSnapshot()
      .historyEntries.undo.some((candidate) => candidate.id === entry.entryId);
  }

  /** Publish the entry label as the strip's tooltip and aria-label. */
  private updateHistoryTooltip(entry: RecentEdit | null, point?: PointerEvent): void {
    if (!entry) {
      this.clearHistoryTooltip();
      return;
    }
    const label = t("workspace.timeline.historyTooltip", {
      label: entry.label,
      count: entry.affectedCount,
    });
    // A pointer crossing one bar fires many moves; only a new bar changes the
    // tip, so the host is not asked to re-render on every frame.
    if (this.shownHistoryLabel === label) {
      return;
    }
    this.shownHistoryLabel = label;
    this.options.historyCanvas.setAttribute("aria-label", label);
    setTransientTooltip({
      title: label,
      anchor: this.options.historyCanvas,
      pointer: point ? { x: point.clientX, y: point.clientY } : undefined,
    });
  }

  /** Remove the history strip's tooltip and aria-label. */
  private clearHistoryTooltip(): void {
    this.shownHistoryLabel = "";
    this.options.historyCanvas.removeAttribute("aria-label");
    setTransientTooltip(null);
  }

  /** Create a device-scaled offscreen strip canvas. */
  private createStripCanvas(width: number, height: number) {
    const canvas = document.createElement("canvas");
    const { context } = prepareCanvas(canvas, true, { width, height });
    return { canvas, context };
  }

  /** Chart duration in seconds, preferring the media duration. */
  private duration(): number {
    const snapshot = this.options.getSnapshot();
    this.options.activity.compile(snapshot.chart, snapshot.tempo);
    return snapshot.mediaDuration > 0 ? snapshot.mediaDuration : this.options.activity.duration;
  }

  /**
   * Show the hover preview for a strip.
   *
   * The preview is pinned to the strip's inner edge so it opens towards the
   * middle of the workspace rather than under the cursor.
   */
  private preview(strip: HTMLCanvasElement, seconds: number, clientY: number): void {
    const snapshot = this.options.getSnapshot();
    if (snapshot.atHome || !snapshot.hasDocument) {
      this.options.thumbnail.hide();
      return;
    }
    const rect = strip.getBoundingClientRect();
    const left = strip === this.options.densityCanvas;
    this.options.thumbnail.show({
      scene: {
        chart: snapshot.chart,
        tempo: snapshot.tempo,
        seconds,
        lineIndex: snapshot.lineIndex,
      },
      anchor: {
        y: clientY,
        edge: left ? rect.right : rect.left,
        side: left ? "left" : "right",
      },
    });
  }

  /** Convert a strip hover into a preview request for the matching chart time. */
  private previewOnStrip(strip: HTMLCanvasElement, event: PointerEvent): void {
    if (!this.options.hoverPreviewEnabled()) {
      this.options.thumbnail.hide();
      return;
    }
    const rect = strip.getBoundingClientRect();
    if (!rect.height) {
      return;
    }
    const ratio = clamp((event.clientY - rect.top) / rect.height, 0, 1);
    this.preview(strip, (1 - ratio) * this.duration(), event.clientY);
  }

  /** Seek to the chart time under the pointer, throttled unless `force` is set. */
  private seekFromStrip(strip: HTMLCanvasElement, event: PointerEvent, force = false): void {
    const rect = strip.getBoundingClientRect();
    if (!rect.height) {
      return;
    }
    const ratio = clamp((event.clientY - rect.top) / rect.height, 0, 1);
    this.pendingSeconds = (1 - ratio) * this.duration() + this.options.getSnapshot().offsetSeconds;
    const now = performance.now();
    const elapsed = now - this.lastSeek;
    if (!force && elapsed < 50) {
      if (!this.pendingSeek) {
        this.pendingSeek = setTimeout(() => {
          this.pendingSeek = undefined;
          this.lastSeek = performance.now();
          this.options.seek(this.pendingSeconds);
        }, 50 - elapsed);
      }
      return;
    }
    clearTimeout(this.pendingSeek);
    this.pendingSeek = undefined;
    this.lastSeek = now;
    this.options.seek(this.pendingSeconds);
  }
}
