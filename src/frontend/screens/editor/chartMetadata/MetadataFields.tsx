/** One field layout with caller-owned draft and commit semantics. */
import { useRef } from "react";
import { FieldRow } from "../../../../design/components/field/FieldRow.tsx";
import { Input } from "../../../../design/components/input/Input.tsx";
import { useTranslation } from "../../../../i18n/react.ts";
import { onboardingAnchorRef } from "../../../onboarding/anchors.ts";
import { metadataFields, type MetadataField, type MetadataValues } from "./fields.ts";

/** Render the metadata fields; the caller owns the draft values and commit timing. */
export function MetadataFields({
  values,
  onChange,
  onBlur,
  disabled = false,
  required = false,
}: {
  values: MetadataValues;
  onChange(field: MetadataField, value: string): void;
  onBlur?(field: MetadataField, value: string): void;
  disabled?: boolean;
  required?: boolean;
}) {
  const { t } = useTranslation();
  // Track IME composition per field so a blur during composition commits after
  // the composed text arrives.
  const composing = useRef(new Set<MetadataField>());
  const blurred = useRef(new Set<MetadataField>());
  return (
    <div className="chart-metadata-fields">
      {metadataFields.map(({ key, label }) => {
        const title = t(label);
        return (
          <FieldRow
            key={key}
            label={title}
            disabled={disabled}
            control={(id) => (
              <Input
                ref={onboardingAnchorRef(`metadata-field-${key}`)}
                id={id}
                name={key}
                value={values[key]}
                aria-required={required || undefined}
                disabled={disabled}
                autoComplete="off"
                onChange={(event) => onChange(key, event.currentTarget.value)}
                onCompositionStart={() => composing.current.add(key)}
                onCompositionEnd={(event) => {
                  composing.current.delete(key);
                  const value = event.currentTarget.value;
                  onChange(key, value);
                  if (blurred.current.delete(key)) {
                    onBlur?.(key, value);
                  }
                }}
                onBlur={(event) => {
                  if (composing.current.has(key)) {
                    blurred.current.add(key);
                  } else {
                    onBlur?.(key, event.currentTarget.value);
                  }
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.nativeEvent.isComposing) {
                    event.preventDefault();
                    event.currentTarget.blur();
                  }
                }}
              />
            )}
          />
        );
      })}
    </div>
  );
}
