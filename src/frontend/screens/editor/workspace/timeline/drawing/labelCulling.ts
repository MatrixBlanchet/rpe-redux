/**
 * Grid-bucketed label culling for the timeline canvases: reserves label boxes so
 * dense note and event text does not overlap without rescanning every prior label.
 *
 * Callers create one per draw pass; the culler keeps only the reserved label boxes.
 */
export interface TimelineLabelPoint {
  readonly x: number;
  readonly y: number;
}

export interface TimelineLabelCullingOptions {
  readonly horizontalGap?: number;
  readonly verticalGap?: number;
  readonly force?: boolean;
}

const CELL_WIDTH = 32;
const CELL_HEIGHT = 24;

/**
 * Keeps dense canvas labels readable without making every draw call scan all
 * previous labels. Forced labels are reserved for selected or otherwise
 * explicitly important items.
 */
export class TimelineLabelCuller {
  private readonly cells = new Map<string, TimelineLabelPoint[]>();

  /** Forget every reserved label box. */
  clear(): void {
    this.cells.clear();
  }

  /** Reserve a label box when it clears its neighbours; forced labels always reserve. */
  tryPlace(point: TimelineLabelPoint, options: TimelineLabelCullingOptions = {}): boolean {
    const horizontalGap = options.horizontalGap ?? 18;
    const verticalGap = options.verticalGap ?? 18;
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) {
      return false;
    }
    if (!options.force && this.overlaps(point, horizontalGap, verticalGap)) {
      return false;
    }
    const key = this.key(point.x, point.y);
    const cell = this.cells.get(key) ?? [];
    cell.push(point);
    this.cells.set(key, cell);
    return true;
  }

  /** True when a reserved label lies within the configured gaps of `point`. */
  private overlaps(point: TimelineLabelPoint, horizontalGap: number, verticalGap: number): boolean {
    const cellX = Math.floor(point.x / CELL_WIDTH);
    const cellY = Math.floor(point.y / CELL_HEIGHT);
    for (let x = cellX - 1; x <= cellX + 1; x++) {
      for (let y = cellY - 1; y <= cellY + 1; y++) {
        const candidates = this.cells.get(`${x}:${y}`);
        if (!candidates) {
          continue;
        }
        if (
          candidates.some(
            (candidate) =>
              Math.abs(candidate.x - point.x) < horizontalGap &&
              Math.abs(candidate.y - point.y) < verticalGap,
          )
        ) {
          return true;
        }
      }
    }
    return false;
  }

  /** Spatial cell key for one label position. */
  private key(x: number, y: number): string {
    return `${Math.floor(x / CELL_WIDTH)}:${Math.floor(y / CELL_HEIGHT)}`;
  }
}
