/**
 * Reads and writes the text format for curve presets.
 *
 * Parse, save, delete and copy return validated presets only; malformed input
 * reports a language-neutral code through the trajectory error contract.
 */
import { t } from "../../../../i18n/index.ts";
import { validateCurvePreset } from "./curveTrajectory.ts";
import type { ValidatedCurvePreset } from "./curveTrajectory.ts";
import { trajectoryError } from "./errorContract.ts";

/**
 * Read a stored preset list, keeping every valid entry.
 *
 * Preference storage is user-editable and may contain a partially corrupted
 * array. One malformed preset must not discard the rest, so invalid entries are
 * skipped and an unreadable payload yields an empty list.
 */
export function parseCurvePresets(source: string | null | undefined): ValidatedCurvePreset[] {
  if (!source) {
    return [];
  }
  let value: unknown;
  try {
    value = JSON.parse(source);
  } catch {
    return [];
  }
  if (!Array.isArray(value)) {
    return [];
  }
  const presets: ValidatedCurvePreset[] = [];
  for (const entry of value) {
    try {
      presets.push(validateCurvePreset(entry));
    } catch {
      // A damaged entry is dropped; the remaining custom presets stay usable.
    }
  }
  return presets;
}

/** Parse preset JSON text into a validated, normalised preset. */
export function parseCurvePreset(source: string): ValidatedCurvePreset {
  let value: unknown;
  try {
    value = JSON.parse(source);
  } catch (error) {
    throw trajectoryError(
      "invalidJson",
      { message: error instanceof Error ? error.message : String(error) },
      { cause: error },
    );
  }
  return validateCurvePreset(value);
}

/**
 * Add or replace a preset by name.
 *
 * `originalName` addresses the entry being edited; renaming is rejected when
 * another preset already uses the new name.
 */
export function saveCurvePreset(
  presets: readonly ValidatedCurvePreset[],
  preset: unknown,
  originalName: string | null = null,
): ValidatedCurvePreset[] {
  const valid = validateCurvePreset(preset);
  const index =
    originalName === null ? -1 : presets.findIndex((entry) => entry.name === originalName);
  if (originalName !== null && index < 0) {
    throw trajectoryError("presetGone");
  }
  if (presets.some((entry, position) => entry.name === valid.name && position !== index)) {
    throw trajectoryError("presetDuplicate");
  }
  const result = [...presets];
  if (index < 0) {
    result.push(valid);
  } else {
    result[index] = valid;
  }
  return result;
}

/** Remove every preset named `name`; absent names leave the list unchanged. */
export function deleteCurvePreset(
  presets: readonly ValidatedCurvePreset[],
  name: string,
): ValidatedCurvePreset[] {
  return presets.filter((entry) => entry.name !== name);
}

/** Clone a preset under a numbered name that does not collide with existing presets. */
export function copyCurvePreset(
  presets: readonly ValidatedCurvePreset[],
  preset: unknown,
): ValidatedCurvePreset {
  const valid = validateCurvePreset(preset);
  let name = valid.name;
  let index = 1;
  while (presets.some((entry) => entry.name === name)) {
    const suffix = t("model.trajectory.presetCopy", { index: index++ });
    name = valid.name.slice(0, 80 - suffix.length) + suffix;
  }
  return { ...valid, name };
}
