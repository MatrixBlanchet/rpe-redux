/**
 * Owns the editor session's live tempo map.
 *
 * Consumers retain a stable source and never cache a second map beside it. A
 * chart replacement swaps the map here, so timeline, playback and readouts all
 * observe the same timing contract on their next read.
 */
import { TempoMap, type TempoEntry } from "../../../../../../core/global/chart/timing/tempo.ts";

/** Keeps one live tempo map per editor session across chart replacement. */
export class EditorTempoSource {
  private current: TempoMap;

  /** Builds the initial map from the session's tempo entries. */
  constructor(entries: readonly TempoEntry[]) {
    this.current = this.create(entries);
  }

  /** The tempo map consumers should read now. */
  get = (): TempoMap => this.current;

  /** Replaces the map after the session installs a different chart. */
  setEntries(entries: readonly TempoEntry[]): void {
    this.current = this.create(entries);
  }

  /** Creates a tempo map from one entry list. */
  private create(entries: readonly TempoEntry[]): TempoMap {
    return new TempoMap(entries);
  }
}
