/**
 * The home library's rows and tiles.
 *
 * Entries carry the title, composer, and difficulty for the carousel; the
 * selected entry's remaining metadata lives in the detail pane. A click selects
 * only: opening is the detail pane's own Open button, so a stray click on a card
 * never replaces the chart being edited.
 */
import { type MouseEvent } from "react";
import { t } from "../../../../i18n/index.ts";
import { Button } from "../../../../design/components/button/Button.tsx";
import { AsyncImage } from "../../../../design/components/image/AsyncImage.tsx";
import type { LibraryView } from "../libraryView.ts";
import type { LibraryEntry } from "./libraryEntries.ts";
import { ProjectDialogs } from "./ProjectDialogs.tsx";
import { setProjectMenuSnapshot, type ProjectMenuAction } from "./ProjectMenu.tsx";

/** Cover image that lets the shared decode handshake choose the placeholder. */
function CardCover({ url }: { url: string }) {
  return (
    <span className="project-cover-frame" aria-hidden="true">
      <AsyncImage
        src={url}
        alt=""
        className="project-cover"
        fallback={<span className="project-cover-placeholder" />}
      />
    </span>
  );
}

/** Opens the project menu at the pointer, or at the card's top-left on keyboard input. */
function openContextMenu(
  event: MouseEvent<HTMLElement>,
  actions: readonly ProjectMenuAction[],
): void {
  event.preventDefault();
  const rect = event.currentTarget.getBoundingClientRect();
  setProjectMenuSnapshot({
    owner: event.currentTarget,
    x: event.clientX || rect.left + 16,
    y: event.clientY || rect.top + 16,
    actions,
  });
}

/** Props for the library card list. */
export interface LibraryCardsProps {
  entries: readonly LibraryEntry[];
  selectedKey: string | null;
  view: LibraryView;
  onActivate(entry: LibraryEntry): void;
  onOpen(entry: LibraryEntry): void;
  onRename(entry: LibraryEntry): void;
  onCopy(entry: LibraryEntry): void;
  onArchive(entry: LibraryEntry): void;
  onDelete(entry: LibraryEntry): void;
}

/** Renders library entries as rows or tiles with a per-project context menu. */
export function LibraryCards({
  entries,
  selectedKey,
  view,
  onActivate,
  onOpen,
  onRename,
  onCopy,
  onArchive,
  onDelete,
}: LibraryCardsProps): React.JSX.Element {
  return (
    <>
      <div className="redux-library-cards" data-view={view}>
        {entries.map((entry) => {
          const selected = entry.key === selectedKey;
          const project = entry.source.project;
          return (
            <Button
              type="button"
              variant="plain"
              className="project-card"
              data-selected={selected}
              data-project-id={project.id}
              key={entry.key}
              aria-current={selected ? "true" : undefined}
              onClick={() => onActivate(entry)}
              onContextMenu={(event) => {
                const actions: ProjectMenuAction[] = [
                  {
                    label: entry.title,
                    tooltip: entry.title,
                    run: () => onOpen(entry),
                  },
                  {
                    label: t("editor.home.action.rename"),
                    tooltip: entry.title,
                    run: () => onRename(entry),
                  },
                  {
                    label: t("common.action.copy"),
                    tooltip: entry.title,
                    run: () => onCopy(entry),
                  },
                  {
                    label: project.archived
                      ? t("common.action.restore")
                      : t("editor.home.action.archive"),
                    tooltip: entry.title,
                    run: () => onArchive(entry),
                  },
                  {
                    label: t("common.action.delete"),
                    tooltip: entry.title,
                    danger: true,
                    run: () => onDelete(entry),
                  },
                ];
                openContextMenu(event, actions);
              }}
            >
              <span className="project-information">
                <CardCover key={`${entry.key}:${entry.cover}`} url={entry.cover} />
                <span className="project-copy">
                  <span className="project-title">{entry.title}</span>
                  <span className="project-composer">{entry.composer}</span>
                </span>
                {entry.level && (
                  <span
                    className="project-level"
                    data-tip-title={`${t("workspace.welcome.library.field.level")}: ${entry.level}`}
                  >
                    {entry.level}
                  </span>
                )}
              </span>
            </Button>
          );
        })}
      </div>
      <ProjectDialogs />
    </>
  );
}
