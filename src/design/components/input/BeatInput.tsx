/**
 * Beat input primitive: a text field preconfigured with the chart beat grammar and
 * its localized hint. Parsing and validation remain with the chart's beat rules.
 */
import { forwardRef, type InputHTMLAttributes } from "react";
import { useTranslation } from "../../../i18n/react.ts";
import { Input } from "./Input.tsx";

/** A text input carrying the chart beat pattern and its localized hint. */
export const BeatInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function BeatInput(props, ref) {
    const { t } = useTranslation();
    return (
      <Input
        ref={ref}
        {...props}
        inputMode="text"
        pattern={String.raw`-?[0-9]+(:-?[0-9]+/[1-9][0-9]*)?|(\+|-)?[0-9]*\.[0-9]+`}
        tipDescription={t("design.beatInput.hint")}
      />
    );
  },
);
