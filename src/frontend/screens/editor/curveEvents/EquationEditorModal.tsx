/**
 * Expanded editor for one curve equation field.
 *
 * The modal edits either x(t) or y(t), never both. It keeps the live draft,
 * inserts functions and variables at the caret, and uses the same token colors
 * and legend as the inline field.
 */
import { useEffect, useRef } from "react";
import { Button } from "../../../../design/components/button/Button.tsx";
import { Modal } from "../../../../design/components/modal/Modal.tsx";
import { t } from "../../../../i18n/index.ts";
import { EquationEditor } from "./EquationEditor.tsx";
import { COMMON_EQUATION_FUNCTIONS, EQUATION_VARIABLES } from "./equationSyntax.ts";

export type EquationAxis = "x" | "y";

/** Whether two adjacent equation characters need an explicit multiplication. */
function needsMultiplication(left: string | undefined, right: string | undefined): boolean {
  return Boolean(left && right && /[A-Za-z0-9_)]/.test(left) && /[A-Za-z0-9_(]/.test(right));
}

/** Props for the expanded single-equation editor modal. */
export interface EquationEditorModalProps {
  open: boolean;
  axis: EquationAxis;
  value: string;
  onChange(value: string): void;
  onClose(): void;
}

/** The enlarged equation surface with a function and variable palette. */
export function EquationEditorModal({
  open,
  axis,
  value,
  onChange,
  onClose,
}: EquationEditorModalProps) {
  const field = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    const node = field.current;
    if (node) {
      node.focus();
      node.setSelectionRange(node.value.length, node.value.length);
    }
  }, [open]);

  const insert = (text: string, functionCall: boolean) => {
    const target = field.current;
    const start = target?.selectionStart ?? value.length;
    const end = target?.selectionEnd ?? start;
    const call = functionCall ? `${text}()` : text;
    const prefix = needsMultiplication(value[start - 1], call[0]) ? "*" : "";
    const suffix = needsMultiplication(call[call.length - 1], value[end]) ? "*" : "";
    const insertion = `${prefix}${call}${suffix}`;
    const next = `${value.slice(0, start)}${insertion}${value.slice(end)}`;
    onChange(next);
    requestAnimationFrame(() => {
      const node = field.current;
      if (!node) {
        return;
      }
      node.focus();
      const caret = start + prefix.length + call.length - (functionCall ? 1 : 0);
      node.setSelectionRange(caret, caret);
    });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      label={t(
        axis === "x"
          ? "editorPanels.curvePreview.equationModal.titleX"
          : "editorPanels.curvePreview.equationModal.titleY",
      )}
      className="curve-equation-modal"
      actions={
        <>
          <Button type="button" variant="outlined" disabled={!value} onClick={() => onChange("")}>
            {t("editorPanels.curvePreview.equationModal.clear")}
          </Button>
          <Button type="button" variant="solid" onClick={onClose}>
            {t("editorPanels.curvePreview.equationModal.done")}
          </Button>
        </>
      }
    >
      <EquationEditor
        inputId={`curve-equation-modal-${axis}`}
        multiline
        ariaLabel={t(
          axis === "x"
            ? "editorPanels.curvePreview.equation.xLabel"
            : "editorPanels.curvePreview.equation.yLabel",
        )}
        value={value}
        placeholder={t(
          axis === "x"
            ? "editorPanels.curvePreview.equation.xPlaceholder"
            : "editorPanels.curvePreview.equation.yPlaceholder",
        )}
        onChange={onChange}
        inputRef={(node) => {
          field.current = node;
        }}
      />

      <section
        className="curve-equation-palette"
        aria-label={t("editorPanels.curvePreview.equationModal.palette")}
      >
        <div className="curve-equation-palette-head">
          {t("editorPanels.curvePreview.equationModal.functions")}
        </div>
        <div className="curve-equation-palette-list">
          {COMMON_EQUATION_FUNCTIONS.map((name) => (
            <Button
              key={name}
              type="button"
              variant="ghost"
              className="curve-equation-chip"
              title={`${name}()`}
              onClick={() => insert(name, true)}
            >
              {name}
            </Button>
          ))}
        </div>
        <div className="curve-equation-palette-head">
          {t("editorPanels.curvePreview.equationModal.variables")}
        </div>
        <div className="curve-equation-palette-list">
          {EQUATION_VARIABLES.map((name) => (
            <Button
              key={name}
              type="button"
              variant="ghost"
              className="curve-equation-chip"
              onClick={() => insert(name, false)}
            >
              {name}
            </Button>
          ))}
        </div>
      </section>
    </Modal>
  );
}
