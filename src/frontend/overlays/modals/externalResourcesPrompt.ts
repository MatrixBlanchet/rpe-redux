/**
 * External-resource consent and unavailable-reference notices.
 *
 * The prompt lists the references a native open left unloaded, offers one
 * per-document grant, and reports paths that no grant can make readable. It
 * reuses the shared modal queue and the compatibility report's list rows.
 */
import { createElement } from "react";
import { t } from "../../../i18n/index.ts";
import { dismissModal, presentModal, MODAL_PRIORITY } from "./modalQueue.ts";
import { NoticeActions, PromptActions } from "./PromptContent.tsx";
import {
  truncateExternalResourcePath,
  type RejectedExternalResourceReview,
} from "../../screens/editor/workspace/document/open/externalResourceReview.ts";

let nextId = 0;

/** Rows naming rejected references, with a summary for the truncated remainder. */
function RejectedResourceList({ review }: { review: RejectedExternalResourceReview }) {
  return createElement(
    "ul",
    { className: "import-report-list" },
    ...review.visible.map((name, index) =>
      createElement(
        "li",
        { key: `${index}:${name}`, className: "import-report-item" },
        createElement(
          "span",
          { className: "import-report-detail" },
          truncateExternalResourcePath(name),
        ),
      ),
    ),
    review.hiddenCount > 0
      ? createElement(
          "li",
          { className: "import-report-item import-report-more" },
          t("workspace.document.externalResources.more", { count: review.hiddenCount }),
        )
      : null,
  );
}

/**
 * Ask whether this document may load its absolute external references.
 *
 * Dismissing the dialog keeps the default-deny result, the same as the keep
 * button, so closing never writes a grant.
 */
export function requestExternalResourcesConsent(
  review: RejectedExternalResourceReview,
): Promise<boolean> {
  return new Promise((resolve) => {
    const id = `external-resources:${++nextId}`;
    let pending = true;
    const settle = (allowed: boolean) => {
      if (!pending) {
        return;
      }
      pending = false;
      dismissModal(id);
      resolve(allowed);
    };
    presentModal(id, {
      label: t("workspace.document.externalResources.title"),
      description: t("workspace.document.externalResources.description", {
        count: review.total,
      }),
      className: "redux-prompt-dialog import-report-dialog",
      closeButton: false,
      role: "alertdialog",
      priority: MODAL_PRIORITY.consent,
      onClose: () => settle(false),
      actions: createElement(PromptActions, {
        confirm: true,
        label: t("workspace.document.externalResources.allow"),
        cancelLabel: t("workspace.document.externalResources.keep"),
        settle,
      }),
      children: createElement(RejectedResourceList, { review }),
    });
  });
}

/**
 * Explain that every remaining rejected reference must stay unloaded.
 *
 * This notice carries no grant action, so it also closes the loop after a
 * reopen when only relative escapes are left.
 */
export function showExternalResourcesUnavailable(review: RejectedExternalResourceReview): void {
  if (review.total === 0) {
    return;
  }
  const id = `external-resources-unavailable:${++nextId}`;
  const close = () => dismissModal(id);
  presentModal(id, {
    label: t("workspace.document.externalResources.unavailableTitle"),
    description: t("workspace.document.externalResources.unavailableDescription", {
      count: review.total,
    }),
    className: "redux-prompt-dialog import-report-dialog",
    role: "alertdialog",
    onClose: close,
    actions: createElement(NoticeActions, { close }),
    children: createElement(RejectedResourceList, { review }),
  });
}
