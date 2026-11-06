/**
 * Preset actions for the trajectory pane: load, validate, save, copy, import,
 * and export custom presets.
 *
 * Storage goes through `presetStorage`, while this module owns the file and
 * notification side effects and reports failures through the supplied callbacks.
 */
import {
  PRESET_CATEGORIES,
  validateCurvePreset,
  type CurvePreset,
  type EditableTrajectoryOptions,
  type ValidatedCurvePreset,
} from "../../../../../core/global/chart/trajectory/curveTrajectory.ts";
import {
  copyCurvePreset,
  deleteCurvePreset,
  parseCurvePreset,
  saveCurvePreset,
} from "../../../../../core/global/chart/trajectory/trajectoryPresets.ts";
import { download } from "../../../../platform/download.ts";
import { t } from "../../../../../i18n/index.ts";
import {
  presetStorage,
  STORAGE_KEY,
  type PresetDraft,
  type TrajectoryOptionBag,
} from "./trajectoryPanelControls.ts";

/** Panel surface the preset actions mutate. */
interface PresetActionHost {
  options: TrajectoryOptionBag;
  optionsRevision: number;
  custom: ValidatedCurvePreset[];
  presetDraft: PresetDraft | null;
  customEditingName: string | null;
  customSource?: string;
  openCategory: string | null;
  openCategoryRevision: number;
  customOpen: boolean;
  customHasError: boolean;
  customActionsDisabled: boolean;
  customMessage: string;
  customCopyVisible: boolean;
  customScrollRevision: number;
  refresh(): void;
  error(error: unknown): void;
  renderPresets(): void;
  loadCustom(preset: CurvePreset | ValidatedCurvePreset, originalName?: string | null): void;
  customError(error: unknown): void;
  validateCustom(): void;
  notify(message: string, severity?: string): void;
}

export interface TrajectoryPresetCallbacks {
  onTogglePreset(preset: CurvePreset | ValidatedCurvePreset | null): void;
  onPresetDraft(draft: PresetDraft): void;
  onPresetError(error: unknown): void;
  onFillPreset(options: EditableTrajectoryOptions): void;
  onDeletePreset(preset: ValidatedCurvePreset): void;
  onEditCustom(preset: ValidatedCurvePreset): void;
  onCustomOpenChange(open: boolean): void;
  onCustomSource(source: string): void;
  onLoadCurrent(): void;
  onSaveCustom(): void;
  onCopyCustom(): void;
  onExportCustom(): void;
  onImportCustom(file: File): Promise<void>;
  onCustomError(error: unknown): void;
}

/** Expands or collapses a preset's parameter editor. */
function togglePreset(this: PresetActionHost, preset: CurvePreset | ValidatedCurvePreset | null) {
  this.presetDraft = null;
  if (preset) {
    this.openCategory = preset.category;
  }
  this.refresh();
}

/** Holds a preset's edited preview while its card is open. */
function presetDraft(this: PresetActionHost, draft: PresetDraft) {
  this.presetDraft = draft;
  this.refresh();
}

/** Copies a preset's edited options into the main form. */
function fillPreset(this: PresetActionHost, options: EditableTrajectoryOptions) {
  this.options = structuredClone(options);
  this.optionsRevision += 1;
  this.presetDraft = null;
  this.refresh();
}

/** Removes a custom preset and persists the list. */
function deletePreset(this: PresetActionHost, preset: ValidatedCurvePreset) {
  try {
    this.custom = deleteCurvePreset(this.custom, preset.name);
    presetStorage.setItem(STORAGE_KEY, JSON.stringify(this.custom));
    if (this.customEditingName === preset.name) {
      this.customEditingName = null;
      this.validateCustom();
    }
    this.presetDraft = null;
    this.renderPresets();
    this.refresh();
    this.notify(t("editorPanels.trajectory.presetDeleted"), "success");
  } catch (error) {
    this.customError(error);
  }
}

/** Mirrors the custom editor's disclosure state. */
function customOpenChange(this: PresetActionHost, open: boolean) {
  this.customOpen = open;
  this.renderPresets();
}

/** Stores edited custom JSON and revalidates it. */
function customSource(this: PresetActionHost, source: string) {
  this.customSource = source;
  this.validateCustom();
}

/** Seeds the custom editor from the form's current options. */
function loadCurrent(this: PresetActionHost) {
  try {
    this.loadCustom(
      copyCurvePreset(
        this.custom,
        validateCurvePreset({
          ...this.options,
          name: this.options.name ?? t("editorPanels.trajectory.myTrajectory"),
          parameters: Object.entries(this.options.parameters ?? {}).map(([key, value]) => ({
            key,
            label: key,
            value,
          })),
        }),
      ),
    );
  } catch (error) {
    this.customError(error);
  }
}

/** Saves the custom source in place or as a copy. */
function saveCustom(this: PresetActionHost, copy: boolean) {
  try {
    const parsed = parseCurvePreset(this.customSource ?? "");
    const preset = copy ? copyCurvePreset(this.custom, parsed) : parsed;
    this.custom = saveCurvePreset(this.custom, preset, copy ? null : this.customEditingName);
    presetStorage.setItem(STORAGE_KEY, JSON.stringify(this.custom));
    this.customEditingName = preset.name;
    this.customSource = JSON.stringify(preset, null, 2);
    this.presetDraft = null;
    this.openCategory = PRESET_CATEGORIES.custom;
    this.openCategoryRevision += 1;
    this.validateCustom();
    this.refresh();
    this.customMessage = t("editorPanels.trajectory.savedHint", {
      name: preset.name,
      category: t(PRESET_CATEGORIES.custom),
    });
    this.renderPresets();
    this.notify(t("editorPanels.trajectory.presetSaved"), "success");
  } catch (error) {
    this.customError(error);
  }
}

/** Downloads the custom source as a preset file. */
function exportCustom(this: PresetActionHost) {
  try {
    const preset = parseCurvePreset(this.customSource ?? "");
    download(
      new Blob([JSON.stringify(preset, null, 2)], { type: "application/json" }),
      preset.name + ".trajectory.json",
    );
  } catch (error) {
    this.customError(error);
  }
}

/** Reads a preset file into the custom editor. */
function importCustom(this: PresetActionHost, file: File) {
  return file
    .text()
    .then((source) => this.loadCustom(parseCurvePreset(source)))
    .catch((error) => this.customError(error));
}

/** Forwards a custom-editor failure to the panel. */
function customError(this: PresetActionHost, error: unknown) {
  this.customError(error);
}

/** Binds every preset callback to the panel that owns the state. */
export function createTrajectoryPresetCallbacks(host: PresetActionHost): TrajectoryPresetCallbacks {
  return {
    onTogglePreset: togglePreset.bind(host),
    onPresetDraft: presetDraft.bind(host),
    onPresetError: host.error.bind(host),
    onFillPreset: fillPreset.bind(host),
    onDeletePreset: deletePreset.bind(host),
    onEditCustom: (preset) => host.loadCustom(preset, preset.name),
    onCustomOpenChange: customOpenChange.bind(host),
    onCustomSource: customSource.bind(host),
    onLoadCurrent: loadCurrent.bind(host),
    onSaveCustom: () => saveCustom.call(host, false),
    onCopyCustom: () => saveCustom.call(host, true),
    onExportCustom: exportCustom.bind(host),
    onImportCustom: importCustom.bind(host),
    onCustomError: customError.bind(host),
  };
}
