/**
 * Rename and remove dialogs for the home library.
 *
 * They read the pending request from `projectPrompts` through the shared queued
 * prompt state, so the last question stays on screen through its close
 * animation and a rejected submit is reported by the same footer every prompt
 * uses.
 */
import { useState } from "react";
import { useTranslation } from "../../../../i18n/react.ts";
import {
  usePromptAction,
  useQueuedPrompt,
  PromptDialog,
} from "../../../overlays/modals/QueuedPrompt.tsx";
import { HomeProjectDialogView } from "./HomeProjectDialogView.tsx";
import {
  closeProjectPrompt,
  getProjectPrompt,
  subscribeProjectPrompt,
  type ProjectEditPrompt,
  type ProjectRemovePrompt,
} from "./projectPrompts.ts";

/**
 * The home library's dialogs: deleting a project, and renaming one.
 *
 * They ask about the cards rather than about the window, so they hang off the
 * cards' own view. The question itself lives in `projectPrompts`; this file only
 * draws it. One at a time — the store holds a single request.
 */
export function ProjectDialogs() {
  const { request, open } = useQueuedPrompt(subscribeProjectPrompt, getProjectPrompt);
  if (!request) {
    return null;
  }
  return request.kind === "remove" ? (
    <ProjectRemoveDialog key={request.id} request={request} open={open} />
  ) : (
    <ProjectEditDialog key={request.id} request={request} open={open} />
  );
}

/** Confirmation dialog that deletes a project. */
function ProjectRemoveDialog({ request, open }: { request: ProjectRemovePrompt; open: boolean }) {
  const { t } = useTranslation();
  const action = usePromptAction(closeProjectPrompt);
  return (
    <PromptDialog
      requestId={`project:${request.id}`}
      open={open}
      onClose={closeProjectPrompt}
      label={request.title}
      description={request.description}
      className="redux-project-dialog"
      error={action.error}
      pending={action.pending}
      submitLabel={t("common.action.delete")}
      submitVariant="danger"
      cancelLabel={t("workspace.dialogs.dismiss")}
      onSubmit={() => action.run(request.submit)}
    >
      {null}
    </PromptDialog>
  );
}

/** Dialog that renames a project and moves it between groups. */
function ProjectEditDialog({ request, open }: { request: ProjectEditPrompt; open: boolean }) {
  const { t } = useTranslation();
  const action = usePromptAction(closeProjectPrompt);
  const [name, setName] = useState(request.name);
  const [group, setGroup] = useState(request.group);
  /** Submits the fields currently shown in the dialog. */
  const apply = () => action.run(() => request.submit(name, group));
  return (
    <PromptDialog
      requestId={`project:${request.id}`}
      open={open}
      onClose={closeProjectPrompt}
      label={request.title}
      description={request.description}
      className="redux-project-dialog"
      error={action.error}
      pending={action.pending}
      submitLabel={t("common.action.apply")}
      cancelLabel={t("workspace.dialogs.dismiss")}
      onSubmit={apply}
    >
      <HomeProjectDialogView
        name={name}
        group={group}
        onChange={(nextName, nextGroup) => {
          setName(nextName);
          setGroup(nextGroup);
        }}
        onEnter={apply}
      />
    </PromptDialog>
  );
}
