/**
 * Sequences a document replacement: validate the new chart, release the current
 * document, install the session, then publish. Teardown and installation remain
 * feature-owned; this module fixes the order between them.
 */
import { assertChart, type Chart } from "../../../../../../core/global/chart/chart.ts";
import type { AssetMap } from "../../../../../../core/global/document/types.ts";
import type { ChartDiagnostic } from "../../../../../../core/global/chart/diagnostics.ts";

/** One validated document ready to replace the current one. */
export interface DocumentReplacement {
  chart: Chart;
  name: string;
  assets: AssetMap;
  folders: Set<string>;
  loadImages: boolean;
  diagnostics: readonly ChartDiagnostic[];
  readOnly: boolean;
}
/** Teardown, installation, and publication steps in replacement order. */
export interface DocumentReplacementSteps {
  releasePrevious(): void;
  install(document: DocumentReplacement): void;
  synchronize(name: string): void;
}

/** Validation precedes teardown; install completes before any new view is published. */
export function createDocumentReplacer(steps: DocumentReplacementSteps) {
  return function replaceChart(
    chart: Chart,
    name: string,
    assets: AssetMap = new Map(),
    folders: string[] = [],
    loadImages = true,
    diagnostics: readonly ChartDiagnostic[] = [],
    readOnly = false,
  ): void {
    assertChart(chart);
    steps.releasePrevious();
    steps.install({
      chart,
      name,
      assets,
      folders: new Set(folders ?? []),
      loadImages,
      diagnostics,
      readOnly,
    });
    steps.synchronize(name);
  };
}
