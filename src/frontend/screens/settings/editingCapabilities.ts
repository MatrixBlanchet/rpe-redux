/**
 * Reads the optional editing-feature switches.
 *
 * React surfaces use the hook so a settings change repaints immediately. The
 * timeline's imperative layer selector uses `editingFeatureEnabled` for the same
 * stored values. Both answer only "may the user create/edit this capability?";
 * chart-presence checks live in `core/global/chart/optionalFeatures.ts` and keep
 * existing data visible even when a switch is off.
 */
import { values } from "../../../core/state/values.ts";
import {
  EDITING_FEATURE_KEYS,
  type EditingFeature,
} from "../../../core/settings/editingFeatureKeys.ts";
import { useSetting } from "./useSetting.ts";

export type { EditingFeature } from "../../../core/settings/editingFeatureKeys.ts";
export { EDITING_FEATURE_KEYS } from "../../../core/settings/editingFeatureKeys.ts";

/** Whether the user may create or edit `feature`, read outside React. */
export function editingFeatureEnabled(feature: EditingFeature): boolean {
  return values.byId.get<boolean>(EDITING_FEATURE_KEYS[feature]);
}

/** React read of the same capability switch. */
export function useEditingFeature(feature: EditingFeature): boolean {
  return useSetting(EDITING_FEATURE_KEYS[feature], true);
}
