/**
 * Judge-line folder journey: folders are selectable, rename from the folder
 * panel, and bulk purpose edits reach every line without the row pencil action.
 *
 * Feature-specific journey; it runs against the packaged desktop app through the
 * shared CDP runner, like the P0 smoke journeys.
 */
import { closeDocument, createCanonical } from "./journeySupport.mjs";

/** Opens the lines drawer pane and waits for the folder tree. */
async function openLinesDrawer(runner) {
  await runner.evaluate(
    `document.querySelector('.sidebar [data-drawer-pane="lines"]')?.click(); true`,
  );
  await runner.waitFor("lines drawer tree", () =>
    runner.evaluate(
      `Boolean(document.querySelector('#inspector.is-drawer [data-drawer-pane="lines"] .drawer-split-list .line-tree'))`,
    ),
  );
  await runner.waitFor("line folder", () =>
    runner.evaluate(`Boolean(document.querySelector('.drawer-split-list .line-folder'))`),
  );
}

/** The current chart snapshot from the public API. */
async function chartSnapshot(runner) {
  const result = await runner.callApi("window.redux.chart.snapshot()");
  runner.assert(result.ok === true, `chart snapshot failed: ${JSON.stringify(result)}`);
  return result.value;
}

/** Clicks one folder name in the list column. */
async function clickFolder(runner) {
  await runner.evaluate(
    `document.querySelector('.drawer-split-list .line-folder .redux-tree-folder-name')?.click(); true`,
  );
}

export async function lineFolderJourney(runner) {
  await createCanonical(runner, "e2e-line-folder.json");
  await openLinesDrawer(runner);

  // The folder row no longer carries a pencil; rename lives in the properties panel.
  const actions = await runner.evaluate(
    `document.querySelectorAll('.drawer-split-list .line-folder .redux-tree-folder-actions').length`,
  );
  runner.assert(actions === 0, `folder rows still render a hover action: ${actions}`);

  // Clicking the folder selects the folder itself, not its first line.
  await clickFolder(runner);
  await runner.waitFor("folder properties panel", () =>
    runner.evaluate(
      `Boolean(document.querySelector('.drawer-split-properties .line-folder-panel'))`,
    ),
  );
  const selected = await runner.evaluate(`(() => ({
    folder: document.querySelector('.drawer-split-list .line-folder')?.classList.contains('is-selected') ?? false,
    lines: document.querySelectorAll('.drawer-split-list .line-row[aria-selected="true"]').length,
  }))()`);
  runner.assert(selected.folder, "clicking a folder did not select the folder row");
  runner.assert(selected.lines === 0, `folder mode still selects ${selected.lines} line row(s)`);

  // The folder panel renames the folder through the shared group edit.
  await runner.evaluate(`(() => {
    const input = document.querySelector('.line-folder-panel input#line-folder-name');
    if (!input) throw new Error('folder name field is missing');
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    input.focus();
    setter.call(input, 'Renamed Folder');
    input.blur();
    return true;
  })()`);
  await runner.waitFor("folder rename commit", async () => {
    const snapshot = await chartSnapshot(runner);
    return snapshot.judgeLineGroup?.[0] === "Renamed Folder";
  });
  // The tree repaints a frame after the chart publishes the rename; wait for the
  // visible label instead of sampling it once.
  await runner.waitFor("folder tree rename", () =>
    runner.evaluate(
      `document.querySelector('.drawer-split-list .line-folder .redux-tree-folder-name')?.textContent?.trim() === "Renamed Folder"`,
    ),
  );

  // A noise target clears notes after one confirmation and writes editor settings.
  await runner.evaluate(
    `document.querySelectorAll('.line-folder-panel .redux-segmented-option')[1]?.click(); true`,
  );
  await runner.waitFor("noise conflict confirmation", () =>
    runner.evaluate(`Boolean(document.querySelector('dialog.redux-confirm[open]'))`),
  );
  await runner.evaluate(
    `document.querySelector('dialog.redux-confirm[open] .modal-actions button:last-child')?.click(); true`,
  );
  await runner.waitFor("folder lines switch to noise", async () => {
    const snapshot = await chartSnapshot(runner);
    const lines = snapshot.judgeLineList ?? [];
    return lines.length > 0 && lines.every((line) => line._reduxNoiseLine?.invert === false);
  });
  const noise = await chartSnapshot(runner);
  runner.assert(
    (noise.judgeLineList ?? []).every((line) => (line.notes?.length ?? 0) === 0),
    "noise conversion did not clear folder notes",
  );

  // Selecting a line returns to the ordinary single-line property form.
  await runner.evaluate(
    `document.querySelector('.drawer-split-list .line-row[data-line-index="0"]')?.click(); true`,
  );
  await runner.waitFor("single line properties", () =>
    runner.evaluate(
      `Boolean(document.querySelector('.drawer-split-properties .line-panel-properties .line-panel-fields:not(.line-folder-panel)'))`,
    ),
  );
  const returned = await runner.evaluate(`(() => ({
    folderPanel: Boolean(document.querySelector('.drawer-split-properties .line-folder-panel')),
    lineSelected: document.querySelector('.drawer-split-list .line-row[data-line-index="0"]')?.getAttribute('aria-selected') === 'true',
    folderSelected: document.querySelector('.drawer-split-list .line-folder')?.classList.contains('is-selected') ?? false,
  }))()`);
  runner.assert(!returned.folderPanel, "the folder panel stayed open after selecting a line");
  runner.assert(returned.lineSelected, "the clicked line is not selected");
  runner.assert(!returned.folderSelected, "the folder row stayed selected after selecting a line");

  await closeDocument(runner);
}
