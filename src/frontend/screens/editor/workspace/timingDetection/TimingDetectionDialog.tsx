/**
 * The timing detector's body: one fixed BPM, its confidence, and an editable
 * BPM/offset pair.
 *
 * The detector always answers with a fixed BPM, so the dialog never offers a
 * second timing model. A low confidence keeps the answer visible but adds a
 * warning: the author can still accept it or correct the two fields by hand.
 */
import { Button } from "../../../../../design/components/button/Button.tsx";
import { IconButton } from "../../../../../design/components/button/IconButton.tsx";
import { InlineAlert } from "../../../../../design/components/alert/InlineAlert.tsx";
import { FieldRow } from "../../../../../design/components/field/FieldRow.tsx";
import { Input } from "../../../../../design/components/input/Input.tsx";
import { Icon } from "../../../../../design/components/icon/Icon.tsx";
import { Progress } from "../../../../../design/components/progress/Progress.tsx";
import { useTranslation } from "../../../../../i18n/react.ts";
import type { BeatDetectionResult } from "../../../../../core/media/beatDetection.ts";
import { confidencePercent, isLowConfidence } from "./timingDetectionModel.ts";

/** What the host knows before the first result exists. */
export type TimingDetectionStatus = "loading" | "ready" | "no-audio" | "error";

/** The detector dialog body. */
export function TimingDetectionDialog({
  status,
  result,
  error,
  bpm,
  offset,
  onBpm,
  onOffset,
  onPickAudio,
  onRetry,
}: {
  status: TimingDetectionStatus;
  result: BeatDetectionResult | null;
  error: string;
  bpm: string;
  offset: string;
  onBpm(value: string): void;
  onOffset(value: string): void;
  onPickAudio(): void;
  onRetry(): void;
}) {
  const { t } = useTranslation();

  if (status === "loading") {
    return (
      <div className="timing-detection-loading" role="status">
        <Icon name="bpm" size={28} />
        <strong>{t("editorPanels.timingDetection.analyzing")}</strong>
        <span>{t("editorPanels.timingDetection.analyzingHint")}</span>
      </div>
    );
  }

  if (status === "no-audio") {
    return (
      <div className="timing-detection-empty">
        <InlineAlert tone="info" title={t("editorPanels.timingDetection.noAudioTitle")}>
          {t("editorPanels.timingDetection.noAudioBody")}
        </InlineAlert>
        <div className="timing-detection-empty-actions">
          <Button variant="outlined" onClick={onPickAudio}>
            <Icon name="music" size={16} />
            {t("editorPanels.timingDetection.pickAudio")}
          </Button>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="timing-detection-empty">
        <InlineAlert tone="danger" title={t("editorPanels.timingDetection.errorTitle")}>
          {error || t("editorPanels.timingDetection.errorBody")}
        </InlineAlert>
        <div className="timing-detection-empty-actions">
          <Button variant="outlined" onClick={onRetry}>
            <Icon name="refresh" size={16} />
            {t("editorPanels.timingDetection.retry")}
          </Button>
        </div>
      </div>
    );
  }

  if (!result) {
    return null;
  }
  const numericBpm = Number(bpm);
  const numericOffset = Number(offset);
  const displayBpm = numericBpm > 0 && Number.isFinite(numericBpm) ? numericBpm : result.bpm;
  const displayOffset = Number.isFinite(numericOffset) ? numericOffset : result.offsetMs;
  const confidence = confidencePercent(result.confidence);
  const confidenceText = t("editorPanels.timingDetection.confidence", { value: confidence });
  return (
    <div className="timing-detection">
      <div className="timing-detection-confidence">
        <strong>{confidenceText}</strong>
        <Progress
          value={result.confidence}
          label={t("editorPanels.timingDetection.confidenceLabel")}
          valueText={confidenceText}
          size="compact"
        />
      </div>

      {isLowConfidence(result.confidence) && (
        <InlineAlert tone="warning" title={t("editorPanels.timingDetection.lowConfidenceTitle")}>
          {t("editorPanels.timingDetection.lowConfidenceBody")}
        </InlineAlert>
      )}

      <div className="timing-detection-manual">
        <FieldRow
          layout="inline"
          density="compact"
          label={t("editorPanels.timingDetection.bpm")}
          control={(id) => (
            <div className="timing-detection-nudge">
              <IconButton
                icon="minus"
                size={14}
                label={t("editorPanels.timingDetection.bpmDown")}
                onClick={() => onBpm(String(Math.max(1, displayBpm - 0.1)))}
              />
              <Input
                id={id}
                type="number"
                step="any"
                value={bpm}
                textAlign="center"
                onChange={(event) => onBpm(event.currentTarget.value)}
              />
              <IconButton
                icon="plus"
                size={14}
                label={t("editorPanels.timingDetection.bpmUp")}
                onClick={() => onBpm(String(displayBpm + 0.1))}
              />
            </div>
          )}
        />
        <FieldRow
          layout="inline"
          density="compact"
          label={t("editorPanels.timingDetection.offset")}
          control={(id) => (
            <div className="timing-detection-nudge">
              <IconButton
                icon="minus"
                size={14}
                label={t("editorPanels.timingDetection.offsetDown")}
                onClick={() => onOffset(String(displayOffset - 1))}
              />
              <Input
                id={id}
                type="number"
                step="any"
                value={offset}
                textAlign="center"
                onChange={(event) => onOffset(event.currentTarget.value)}
              />
              <IconButton
                icon="plus"
                size={14}
                label={t("editorPanels.timingDetection.offsetUp")}
                onClick={() => onOffset(String(displayOffset + 1))}
              />
            </div>
          )}
        />
      </div>

      {error && <InlineAlert tone="danger">{error}</InlineAlert>}
    </div>
  );
}
