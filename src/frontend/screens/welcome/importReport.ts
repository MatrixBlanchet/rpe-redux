/**
 * Import compatibility reports.
 *
 * An import converts a chart it did not author. Whatever the converter could not
 * carry — a media file it could not read, an unsupported field, a dropped event
 * track — is collected as one line instead of collapsing into a warning count, so
 * the author can see whether a difference matters before they start editing.
 *
 * Reports are stored per library project. The title bar shows a badge for the
 * project currently open, and the notice that follows an import links to the same
 * list.
 */
import { useSyncExternalStore } from "react";
import { createValue } from "../../../core/state/values.ts";

/** One difference an import introduced. */
export interface ImportIssue {
  /** The chart or file the issue belongs to; empty for a whole-batch issue. */
  scope: string;
  /** What was carried differently. */
  detail: string;
}

/** The compatibility report for one imported project. */
export interface ImportReport {
  /** Library project id the report belongs to. */
  projectId: string;
  /** Display name shown in the report heading. */
  title: string;
  /** How the chart arrived: an RPE folder, an official chart, or a PEC file. */
  source: string;
  issues: readonly ImportIssue[];
}

const reports = createValue<readonly ImportReport[]>({ initial: [] });

/** Every report recorded this session, newest last. */
export const getImportReports = reports.get;
/** Subscribes to report changes. */
export const subscribeImportReports = reports.subscribe;

/** Records one project's report, replacing an earlier report for the same project. */
export function recordImportReport(report: ImportReport): void {
  if (!report.projectId) {
    return;
  }
  reports.set([...reports.get().filter((item) => item.projectId !== report.projectId), report]);
}

/** The report for one project, or null when that import carried no issues. */
export function importReportFor(projectId: string): ImportReport | null {
  return reports.get().find((report) => report.projectId === projectId) ?? null;
}

/** Drops one project's report, keeping the store from growing across sessions. */
export function forgetImportReport(projectId: string): void {
  reports.set(reports.get().filter((report) => report.projectId !== projectId));
}

/** Reads one project's report in React. */
export function useImportReport(projectId: string): ImportReport | null {
  return (
    useSyncExternalStore(subscribeImportReports, getImportReports, getImportReports).find(
      (report) => report.projectId === projectId,
    ) ?? null
  );
}

/** Reads every report in React; the title-bar badge uses it for the current project. */
export function useImportReports(): readonly ImportReport[] {
  return useSyncExternalStore(subscribeImportReports, getImportReports, getImportReports);
}
