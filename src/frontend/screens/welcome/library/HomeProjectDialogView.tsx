/**
 * The fields in the home screen's project rename dialog.
 *
 * The view is controlled by the dialog that mounts it, which keeps the answer
 * current with what is on screen.
 */
import type { KeyboardEvent } from "react";
import { FieldRow } from "../../../../design/components/field/FieldRow.tsx";
import { Input } from "../../../../design/components/input/Input.tsx";
import { t } from "../../../../i18n/index.ts";

/** Props for the controlled rename dialog fields. */
interface HomeProjectDialogViewProps {
  /**
   * The field text. The dialog owns it rather than this view: the answer has to
   * be what is on screen when the footer's button runs, and a copy kept here
   * would be a second source for the same value.
   */
  name?: string;
  group?: string;
  onChange?(name: string, group: string): void;
  /** Enter applies, exactly as the footer's button does. */
  onEnter?(): void;
}

/** Fields in the rename dialog. */
export function HomeProjectDialogView({
  name = "",
  group = "",
  onChange,
  onEnter,
}: HomeProjectDialogViewProps) {
  /** Applies the dialog when Enter is pressed in either field. */
  const applyOnEnter = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      onEnter?.();
    }
  };
  return (
    <>
      <FieldRow
        layout="inline"
        className="modal-field"
        htmlFor="home-project-name"
        label={t("editor.home.field.nameLabel")}
        control={
          <Input
            id="home-project-name"
            value={name}
            onKeyDown={applyOnEnter}
            onChange={(event) => onChange?.(event.currentTarget.value, group)}
          />
        }
      />
      <FieldRow
        layout="inline"
        className="modal-field"
        htmlFor="home-project-group"
        label={t("editor.home.field.groupLabel")}
        control={
          <Input
            id="home-project-group"
            value={group}
            onKeyDown={applyOnEnter}
            onChange={(event) => onChange?.(name, event.currentTarget.value)}
          />
        }
      />
    </>
  );
}
