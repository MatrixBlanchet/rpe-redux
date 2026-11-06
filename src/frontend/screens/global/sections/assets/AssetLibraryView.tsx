/**
 * Renders the asset tree, its toolbar, the selection summary, and the pending
 * dialogs; edits arrive as callbacks from the panel model.
 *
 * Thumbnails track decode per URL, so an edited image returns to the skeleton
 * and a failed one stops loading.
 */
import { useEffect, useState } from "react";
import { Button } from "../../../../../design/components/button/Button.tsx";
import { AudioPlayer } from "../../../../../design/components/audio/AudioPlayer.tsx";
import { EmptyState } from "../../../../../design/components/empty-state/EmptyState.tsx";
import { AsyncImage } from "../../../../../design/components/image/AsyncImage.tsx";
import { TreeFolder } from "../../../../../design/patterns/tree/TreeFolder.tsx";
import { Icon } from "../../../../../design/components/icon/Icon.tsx";
import { FILE_DRAG_EVENT } from "../../../../../core/shell/shellEventNames.ts";
import { useTranslation } from "../../../../../i18n/react.ts";
import type { GlobalView } from "../../globalView.ts";
import { AssetDialogs } from "./AssetDialogs.tsx";
import type {
  AssetLibraryViewProps,
  AssetViewFile,
  AssetViewFolder,
  AssetViewKind,
} from "./model.ts";

function assetLabel(name: string): string {
  return name.split("/").at(-1) ?? name;
}

/**
 * Shows a spinner until one image URL finishes decoding.
 *
 * Large images, especially animated GIFs, can occupy the main thread for several
 * frames after `<img>` mounts. Tracking the URL keeps completed thumbnails visible,
 * returns edited images to loading when their URL changes, and treats failures as
 * terminal so a broken asset cannot leave the spinner running forever.
 */
function AssetThumb({
  url,
  alt,
  kind,
}: {
  url: string;
  alt: string;
  kind: AssetViewKind;
}): React.JSX.Element {
  if (kind === "audio") {
    return (
      <span className="asset-image asset-audio" aria-hidden="true">
        <Icon name="music" size={20} />
      </span>
    );
  }
  return (
    <span className="asset-image">
      {/* The URL already exists, so this only defers decode; a large library
          otherwise decodes every thumbnail on first paint. */}
      <AsyncImage
        src={url}
        alt={alt}
        loading="lazy"
        decoding="async"
        fallback={<Icon name="image" size={20} />}
      />
    </span>
  );
}

/**
 * The details pane with no selected asset.
 *
 * The pane keeps the real detail layout as muted blocks instead of a line of
 * copy: selecting an asset swaps content into an existing frame, and the empty
 * pane never duplicates the tree's own empty-state guidance. The blocks are
 * static because the pane is empty rather than busy, so they must not read as
 * loading; only the layout is promised, not content.
 */
function AssetDetailsSkeleton(): React.JSX.Element {
  return (
    <div className="asset-details asset-details-skeleton" aria-hidden="true">
      <span className="asset-skeleton-block asset-skeleton-name" />
      <span className="asset-skeleton-block asset-skeleton-preview" />
      <span className="asset-skeleton-block asset-skeleton-kind" />
      <span className="asset-skeleton-actions">
        <span className="asset-skeleton-block" />
        <span className="asset-skeleton-block" />
        <span className="asset-skeleton-block" />
      </span>
    </div>
  );
}

/** One static project asset; details owns every asset mutation. */
function AssetFileRow({
  file,
  onSelect,
}: {
  file: AssetViewFile;
  onSelect(name: string): void;
}): React.JSX.Element {
  return (
    <Button
      type="button"
      variant="plain"
      className={`asset-row${file.selected ? " is-selected" : ""}`}
      data-asset-name={file.name}
      onClick={() => onSelect(file.name)}
    >
      <AssetThumb url={file.url} alt={file.file} kind={file.kind} />
      <span className="asset-row-name">{file.file}</span>
    </Button>
  );
}

/** One static folder section with clickable assets and nested child folders. */
function AssetFolderView({
  folder,
  selectedFolder,
  collapsedFolders,
  onToggle,
  onSelect,
  onSelectFolder,
  empty = false,
}: {
  folder: AssetViewFolder;
  selectedFolder: string;
  collapsedFolders: ReadonlySet<string>;
  onToggle(path: string): void;
  onSelect(name: string): void;
  onSelectFolder(path: string): void;
  empty?: boolean;
}): React.JSX.Element {
  const { t } = useTranslation();
  const collapsed = collapsedFolders.has(folder.path);
  return (
    <TreeFolder
      label={folder.name}
      className={`asset-folder${folder.path === selectedFolder ? " is-selected" : ""}`}
      selected={folder.path === selectedFolder}
      folded={collapsed}
      headerClassName="asset-folder-header"
      bodyClassName="asset-folder-body"
      rowsClassName="asset-folder-rows"
      reserveDragSpace={false}
      name={
        <Button
          type="button"
          variant="plain"
          className="redux-tree-folder-name"
          onClick={() => onSelectFolder(folder.path)}
        >
          {folder.name}
        </Button>
      }
      count={t("editorPanels.assetLibrary.count", { count: folder.count })}
      onToggle={() => onToggle(folder.path)}
      expandLabel={t("editorPanels.assetLibrary.expandFolder", { name: folder.name })}
      collapseLabel={t("editorPanels.assetLibrary.collapseFolder", { name: folder.name })}
      data-folder-path={folder.path}
    >
      {folder.files.length > 0 && (
        <div className="asset-folder-items">
          {folder.files.map((file) => (
            <AssetFileRow key={file.name} file={file} onSelect={onSelect} />
          ))}
        </div>
      )}
      {empty && (
        <EmptyState
          variant="inline"
          title={t("editorPanels.assetLibrary.empty")}
          className="asset-folder-empty"
        />
      )}
      {folder.folders.map((child) => (
        <AssetFolderView
          key={child.path}
          folder={child}
          selectedFolder={selectedFolder}
          collapsedFolders={collapsedFolders}
          onToggle={onToggle}
          onSelect={onSelect}
          onSelectFolder={onSelectFolder}
        />
      ))}
    </TreeFolder>
  );
}

/**
 * The asset tree and the selected-asset details.
 *
 * The panel title lives in `AssetsPanel` so it stays on screen while the tree is
 * still being built; this component mounts once a snapshot is ready.
 *
 * Root assets live in the Default group so the tree reads like the judge-line
 * tree: one folder header, then its asset cards. The group is deletable once it
 * is empty; importing into a fully empty library recreates it. Imported files go
 * to the selected folder, and the library always uses the card grid.
 */
export function AssetLibraryView({
  files,
  folders,
  empty,
  rootVisible,
  blank,
  rootIndex,
  selected,
  selectedFolder,
  selectedFolderExists,
  selectedFolderCount,
  onAdd,
  onCreateFolder,
  onSelectFolder,
  onDeleteFolder,
  onFiles,
  addInputRef,
  onSelect,
  onRename,
  onEdit,
  onDelete,
  variant = "all",
}: AssetLibraryViewProps): React.JSX.Element {
  const { t } = useTranslation();
  const view: GlobalView = "grid";
  const [importDragging, setImportDragging] = useState(false);
  const [collapsedFolders, setCollapsedFolders] = useState<ReadonlySet<string>>(() => new Set());
  const toggleFolder = (path: string) => {
    setCollapsedFolders((current) => {
      const next = new Set(current);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };
  const showTree = variant !== "details";
  const showDetails = variant !== "tree";

  useEffect(() => {
    if (!showTree) {
      return;
    }
    const onDragState = (event: Event): void => {
      const state = (event as CustomEvent<string>).detail;
      setImportDragging(state === "enter" || state === "over");
    };
    window.addEventListener(FILE_DRAG_EVENT, onDragState);
    return () => window.removeEventListener(FILE_DRAG_EVENT, onDragState);
  }, [showTree]);

  const folderName = selectedFolder || t("editorPanels.assetLibrary.defaultFolder");
  const deleteLabel = selected
    ? t("editorPanels.assetLibrary.deleteSelected")
    : t("editorPanels.assetLibrary.deleteGroup");
  const orderedFolders = [...folders];
  if (rootVisible) {
    orderedFolders.splice(Math.min(rootIndex, orderedFolders.length), 0, {
      path: "",
      name: t("editorPanels.assetLibrary.defaultFolder"),
      count: files.length,
      files,
      folders: [],
    });
  }

  return (
    <>
      {showTree && (
        <div className="asset-tree-shell">
          <input
            ref={addInputRef}
            type="file"
            accept="image/*,audio/*"
            multiple
            hidden
            onChange={(event) => onFiles(event.currentTarget.files)}
          />
          {blank ? (
            <EmptyState
              icon="folder"
              title={t("editorPanels.assetLibrary.emptyState.title")}
              description={t("editorPanels.assetLibrary.emptyState.description")}
            />
          ) : (
            <div className="asset-tree" data-layout={view}>
              {orderedFolders.map((folder) => (
                <AssetFolderView
                  key={folder.path || "root"}
                  folder={folder}
                  selectedFolder={selectedFolder}
                  collapsedFolders={collapsedFolders}
                  onToggle={toggleFolder}
                  onSelect={onSelect}
                  onSelectFolder={onSelectFolder}
                  empty={folder.path === "" ? empty : false}
                />
              ))}
            </div>
          )}
          {importDragging && (
            <div className="asset-drop-overlay" role="status" aria-live="polite">
              <div className="asset-drop-card">
                <span className="asset-drop-icon" aria-hidden="true">
                  <Icon name="open" size={24} />
                </span>
                <strong>{t("editorPanels.assetLibrary.drop.title")}</strong>
                <small>{t("editorPanels.assetLibrary.drop.folder", { folder: folderName })}</small>
              </div>
            </div>
          )}
          <div className="asset-tree-footer redux-footer-bar redux-footer-bar-compact">
            <Button type="button" variant="solid" block onClick={onAdd}>
              <Icon name="plus" size={14} />
              <span className="redux-button-label">{t("editorPanels.assetLibrary.addImages")}</span>
            </Button>
            <div className="asset-tree-footer-actions redux-footer-actions">
              <Button type="button" variant="outlined" onClick={() => onCreateFolder()}>
                <Icon name="plus" size={14} />
                <span className="redux-button-label">
                  {t("editorPanels.assetLibrary.newFolderButton")}
                </span>
              </Button>
              {(selected || (selectedFolderExists && !blank)) && (
                <Button
                  type="button"
                  variant="danger"
                  disabled={!selected && selectedFolderCount > 0}
                  data-tip-title={
                    !selected && selectedFolderCount > 0
                      ? t("editorPanels.assetLibrary.deleteFolder.notEmpty", {
                          count: selectedFolderCount,
                        })
                      : deleteLabel
                  }
                  onClick={selected ? onDelete : () => onDeleteFolder(selectedFolder)}
                >
                  <Icon name="trash" size={14} />
                  <span className="redux-button-label">{deleteLabel}</span>
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
      {showDetails &&
        (selected ? (
          <div className="asset-details">
            <strong className="asset-details-name">{assetLabel(selected.name)}</strong>
            {selected.kind === "audio" ? (
              <AudioPlayer src={selected.url} label={assetLabel(selected.name)} />
            ) : (
              <AssetThumb url={selected.url} alt={selected.name} kind={selected.kind} />
            )}
            <small className="asset-details-kind">
              {t(
                selected.kind === "audio"
                  ? "editorPanels.assetLibrary.kind.audio"
                  : "editorPanels.assetLibrary.kind.image",
              )}
            </small>
            <div className="asset-detail-actions">
              <Button type="button" variant="outlined" onClick={onRename}>
                {t("common.action.rename")}
              </Button>
              {selected.kind === "image" && (
                <Button type="button" variant="outlined" onClick={onEdit}>
                  {t("editorPanels.assetLibrary.editImage")}
                </Button>
              )}
              <Button type="button" variant="danger" onClick={onDelete}>
                {t("common.action.delete")}
              </Button>
            </div>
          </div>
        ) : (
          <>
            {/* The visible pane is a layout skeleton; the action hint stays in the
                accessibility tree so the empty pane is still explained aloud. */}
            <p className="redux-visually-hidden">
              {t("editorPanels.assetLibrary.selectForDetails")}
            </p>
            <AssetDetailsSkeleton />
          </>
        ))}
      {showDetails && <AssetDialogs />}
    </>
  );
}
