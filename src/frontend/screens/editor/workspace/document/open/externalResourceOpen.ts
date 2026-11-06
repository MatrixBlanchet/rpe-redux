/**
 * Native document opens that settle rejected external references.
 *
 * The open flow asks once whether a document may grant its out-of-folder
 * absolute references, then reopens exactly that path. The tracking lives per
 * connected editor session so a document cannot keep prompting or looping.
 */
import type { OpenResult } from "../../../../../../core/global/document/desktopTypes.ts";
import type { OpenDocumentOptions } from "../../../../../../core/platform/desktop/documentStore.ts";
import {
  createExternalResourceAuthorizationHistory,
  settleRejectedExternalResources,
  type ExternalResourceAuthorizationHistory,
} from "./externalResourceReview.ts";

/** One native open, with the grant flag used only for the confirmed reopen. */
export type ExternalResourceOpen = (
  path: string,
  options?: OpenDocumentOptions,
) => Promise<OpenResult>;

/**
 * Open one path and resolve its rejected external references.
 *
 * The first result is kept when the author declines; confirmation performs one
 * grant reopen and returns that result, including any unfixable escapes.
 */
export async function openWithExternalResourceReview(
  open: ExternalResourceOpen,
  path: string,
  history: ExternalResourceAuthorizationHistory,
): Promise<OpenResult> {
  const opened = await open(path);
  if (!opened.candidate.desktop?.rejected_external_resources?.length) {
    return opened;
  }
  // The prompt is only needed when the native host reported a rejection; the
  // dynamic import keeps the pure document lifecycle importable without React.
  const { requestExternalResourcesConsent, showExternalResourcesUnavailable } =
    await import("../../../../../overlays/modals/externalResourcesPrompt.ts");
  return settleRejectedExternalResources(path, opened, history, {
    confirm: requestExternalResourcesConsent,
    notifyUnavailable: showExternalResourcesUnavailable,
    reopen: (target) => open(target, { allowExternalResources: true }),
  });
}

/**
 * Create the per-editor-session open function used by a document flow.
 *
 * Reusing one session keeps the one-automatic-reopen rule scoped to this
 * mounted editor rather than the whole application process.
 */
export function createExternalResourceOpenSession(
  open: ExternalResourceOpen,
): (path: string) => Promise<OpenResult> {
  const history = createExternalResourceAuthorizationHistory();
  return (path) => openWithExternalResourceReview(open, path, history);
}
