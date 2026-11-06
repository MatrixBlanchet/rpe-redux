/** Official built-in note transforms for exploring the Extension SDK. */

const NOTE_TYPES = Object.freeze({ Tap: 1, Hold: 2, Flick: 3, Drag: 4 });

/** Read the selected notes and their current chart lines. */
async function selectedNotes(api) {
  const selection = await api.selection.state();
  if (!selection.ok) {
    return { error: selection.error.code };
  }
  if (selection.value.notes.length === 0) {
    return { empty: true };
  }
  const lines = await api.chart.lines();
  if (!lines.ok) {
    return { error: lines.error.code };
  }
  const notes = selection.value.notes
    .map((reference) => {
      const note = lines.value[reference.lineIndex]?.notes?.[reference.index];
      return note && note.id ? { note, id: note.id } : null;
    })
    .filter(Boolean);
  return { lines: lines.value, notes };
}

/** Commit a set of id-addressed note patches and report its outcome. */
async function applyPatches({ api, i18n, ui }, key, patches) {
  if (patches.length === 0) {
    ui.notice({ key: "notice.noChanges" }, { level: "warning" });
    return;
  }
  const result = await api.transaction.apply({
    label: i18n.t(`history.${key}`),
    notes: { update: patches },
  });
  if (!result.ok) {
    ui.notice({ key: "notice.failed", params: { status: result.error.code } }, { level: "error" });
  } else if (result.value.status === "committed") {
    ui.notice({ key: "notice.success", params: { count: patches.length } }, { level: "success" });
  } else if (result.value.status === "unchanged") {
    ui.notice({ key: "notice.unchanged" }, { level: "info" });
  } else {
    ui.notice(
      { key: "notice.failed", params: { status: result.value.status } },
      { level: "error" },
    );
  }
}

/** Register one transform whose patch is derived from every selected note. */
function registerTransform(context, definition) {
  context.scripts.register({
    id: definition.id,
    label: { key: `script.${definition.id}.label` },
    description: { key: `script.${definition.id}.description` },
    icon: definition.icon || "mirror",
    async run({ api, i18n, ui }) {
      const selected = await selectedNotes(api);
      if (selected.error) {
        ui.notice({ key: "notice.failed", params: { status: selected.error } }, { level: "error" });
        return;
      }
      if (selected.empty) {
        ui.notice({ key: "notice.noSelection" }, { level: "warning" });
        return;
      }
      const patches = definition.patch(selected.notes, selected.lines || []).filter(Boolean);
      await applyPatches({ api, i18n, ui }, definition.id, patches);
    },
  });
}

/** Register all official examples. */
export default {
  activate(context) {
    const transforms = [
      {
        id: "MirrorY",
        patch: (notes) =>
          notes.map(({ id, note }) => ({ id, patch: { positionX: -Number(note.positionX || 0) } })),
      },
      {
        id: "MirrorMid",
        patch: (notes) => {
          const values = notes.map(({ note }) => Number(note.positionX)).filter(Number.isFinite);
          if (!values.length) {
            return [];
          }
          const center = (Math.min(...values) + Math.max(...values)) / 2;
          return notes.map(({ id, note }) => ({
            id,
            patch: { positionX: 2 * center - Number(note.positionX || 0) },
          }));
        },
      },
      {
        id: "SideSwitch",
        patch: (notes) =>
          notes.map(({ id, note }) => ({
            id,
            patch: {
              above:
                note.type === NOTE_TYPES.Hold
                  ? Number(note.above) === 1
                    ? 0
                    : 1
                  : Number(note.above) === 1
                    ? 2
                    : 1,
            },
          })),
      },
      {
        id: "SideUp",
        patch: (notes) => notes.map(({ id }) => ({ id, patch: { above: 1 } })),
      },
      {
        id: "SideDown",
        patch: (notes) =>
          notes.map(({ id, note }) => ({
            id,
            patch: { above: note.type === NOTE_TYPES.Hold ? 0 : 2 },
          })),
      },
      { id: "ToReal", patch: (notes) => notes.map(({ id }) => ({ id, patch: { isFake: 0 } })) },
      { id: "ToFake", patch: (notes) => notes.map(({ id }) => ({ id, patch: { isFake: 1 } })) },
      {
        id: "ToTap",
        patch: (notes) => notes.map(({ id }) => ({ id, patch: { type: NOTE_TYPES.Tap } })),
      },
      {
        id: "ToFlick",
        patch: (notes) => notes.map(({ id }) => ({ id, patch: { type: NOTE_TYPES.Flick } })),
      },
      {
        id: "ToDrag",
        patch: (notes) => notes.map(({ id }) => ({ id, patch: { type: NOTE_TYPES.Drag } })),
      },
      {
        id: "ToHold",
        patch: (notes, lines) => {
          const length = 1 / Math.max(1, lines.length);
          return notes.map(({ id, note }) => ({
            id,
            patch: {
              type: NOTE_TYPES.Hold,
              endTime: Number(note.startTime) + length,
            },
          }));
        },
      },
    ];
    transforms.forEach((definition) => registerTransform(context, definition));
  },
};
