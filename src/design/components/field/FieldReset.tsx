/**
 * Compact per-field reset action.
 *
 * The field row reserves the leading slot; this control only paints an undo
 * affordance while the field differs from its default. The caller owns the
 * default value and the commit path, so chart fields and preference fields can
 * share one visual contract.
 */
import { useTranslation } from "../../../i18n/react.ts";
import { IconButton } from "../button/IconButton.tsx";

/** The only inspector fields allowed to expose a reset affordance. */
export type ResettableFieldKey =
  | "result-ghost"
  | "preview-line-only"
  | "loop-ab"
  | "show-grid"
  | "grid-distance"
  | "cut-density"
  | "fit"
  | "fit-precision"
  | "auto-approve-editor"
  | "auto-bitrate";

/** Reset one field to its default; hidden while the field already matches it. */
export function FieldReset({
  field,
  label,
  dirty,
  onReset,
  disabled = false,
}: {
  /** Stable semantic field id; the type is the reset allowlist. */
  field: ResettableFieldKey;
  /** Localized field name used in the accessible label. */
  label: string;
  /** Whether the current value differs from the field default. */
  dirty: boolean;
  onReset(): void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  if (!dirty) {
    return null;
  }
  return (
    <IconButton
      icon="undo"
      size={16}
      variant="ghost"
      className="redux-field-reset"
      label={t("common.action.resetField", { name: label })}
      title={t("common.action.resetHint")}
      disabled={disabled}
      onPointerDown={(event) => {
        // Reset must not pull focus out of the field it belongs to; the wheel
        // and keyboard edits keep their target.
        event.preventDefault();
      }}
      onClick={onReset}
    />
  );
}
