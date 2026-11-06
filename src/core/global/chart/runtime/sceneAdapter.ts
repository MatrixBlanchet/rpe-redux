/**
 * The non-visual scene-evaluation seam used by API and headless callers.
 *
 * `SceneAdapter` exposes compiled line runtimes and a sampler over `SceneRuntime`;
 * `createMemorySceneAdapter` builds the in-memory implementation without a renderer.
 */
import type { Chart } from "../chart.ts";
import type { TempoSource } from "../timing/events.ts";
import { SceneRuntime, type LineRuntime, type SampledLineState } from "./scene.ts";

/**
 * Pure scene-evaluation capabilities needed by non-visual consumers.
 *
 * The adapter deliberately exposes chart data and sampled states only. Canvas,
 * WebGL, layout measurement, and pointer events belong to the frontend that
 * consumes this data, so this seam can also be used by memory-only smoke tools.
 */
export interface SceneAdapter {
  readonly lines: readonly LineRuntime[];
  clear(): void;
  compile(chart: Chart, tempo: TempoSource): void;
  sampler(seconds: number): (index: number) => SampledLineState;
}

/** Create the in-memory scene adapter used by API and headless paths. */
export function createMemorySceneAdapter(): SceneAdapter {
  return new SceneRuntime();
}
