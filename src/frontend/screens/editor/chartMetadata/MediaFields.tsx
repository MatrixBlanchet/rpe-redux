/**
 * Resource cards for the metadata page.
 *
 * The background and audio resources read as two distinct files, not one large
 * waveform preview: each card names the selected file and owns one picker. Both
 * cards share the same footer structure, so the file name and its picker sit in
 * the same place regardless of whether the card also shows a preview.
 */
import { useEffect, useMemo } from "react";
import { Button } from "../../../../design/components/button/Button.tsx";
import { IconButton } from "../../../../design/components/button/IconButton.tsx";
import { AsyncImage } from "../../../../design/components/image/AsyncImage.tsx";
import { Icon } from "../../../../design/components/icon/Icon.tsx";
import { Spinner } from "../../../../design/components/spinner/Spinner.tsx";
import { useTranslation } from "../../../../i18n/react.ts";
import { toBlobPart } from "../../../../core/utils/bytes.ts";

/** Which media card a picker updates. */
export type MediaKind = "song" | "background";
/** A cover image as packaged bytes or an existing URI. */
export interface CoverSource {
  bytes?: Uint8Array;
  uri?: string;
  type?: string;
}

/** Object URL for in-memory cover bytes, revoked on change; falls back to `uri`. */
function useCoverUrl(source: CoverSource | null): string | undefined {
  const bytes = source?.bytes;
  const type = source?.type;
  const url = useMemo(
    () => (bytes ? URL.createObjectURL(new Blob([toBlobPart(bytes)], { type })) : undefined),
    [bytes, type],
  );
  useEffect(
    () => () => {
      if (url) {
        URL.revokeObjectURL(url);
      }
    },
    [url],
  );
  return url ?? source?.uri;
}

/** Background and audio cards for the metadata page. */
export function MediaFields({
  songName,
  backgroundName,
  song,
  background,
  busy,
  errors,
  disabled = false,
  onPick,
}: {
  songName: string;
  backgroundName: string;
  song?: CoverSource | null;
  background: CoverSource | null;
  busy?: MediaKind | null;
  errors?: Partial<Record<MediaKind, string>>;
  disabled?: boolean;
  onPick(kind: MediaKind): void;
}) {
  const { t } = useTranslation();
  const backgroundUrl = useCoverUrl(background);
  const anyBusy = Boolean(busy);
  return (
    <div className="metadata-resources">
      <section
        className="metadata-resource-card metadata-resource-visual"
        aria-label={t("editorPanels.metadata.background")}
      >
        <Button
          variant="plain"
          className="metadata-resource-image"
          aria-label={t("editorPanels.metadata.selectBackground")}
          aria-busy={busy === "background"}
          aria-invalid={Boolean(errors?.background)}
          disabled={disabled || busy === "background"}
          data-tip-title={t("editorPanels.metadata.selectBackground")}
          onClick={() => onPick("background")}
        >
          <AsyncImage
            src={backgroundUrl}
            fallback={
              busy === "background" ? null : <Icon name="image" size={28} aria-hidden="true" />
            }
          />
          {busy === "background" && (
            <span className="metadata-resource-busy">
              <Spinner label={t("editorPanels.metadata.selectBackground")} />
            </span>
          )}
        </Button>
        <div className="metadata-resource-footer">
          <div className="metadata-resource-copy">
            <span className="metadata-resource-label">{t("editorPanels.metadata.background")}</span>
            <strong className={backgroundName ? "" : "is-empty"}>
              {backgroundName || t("editorPanels.metadata.notSelected")}
            </strong>
            {errors?.background && (
              <small className="metadata-resource-error" role="alert">
                {errors.background}
              </small>
            )}
          </div>
          <IconButton
            icon="open"
            size={18}
            label={t("editorPanels.metadata.selectBackground")}
            className="metadata-resource-pick"
            disabled={disabled || anyBusy}
            onClick={() => onPick("background")}
          />
        </div>
      </section>

      <section
        className="metadata-resource-card metadata-resource-audio"
        aria-label={t("editorPanels.metadata.audioTrack")}
      >
        <div className="metadata-resource-footer">
          <div className="metadata-resource-copy">
            <span className="metadata-resource-label">{t("editorPanels.metadata.audioTrack")}</span>
            <strong className={songName ? "" : "is-empty"}>
              {songName || t("editorPanels.metadata.notSelected")}
            </strong>
            {errors?.song && (
              <small className="metadata-resource-error" role="alert">
                {errors.song}
              </small>
            )}
          </div>
          <IconButton
            icon="open"
            size={18}
            label={t("editorPanels.metadata.selectAudio")}
            className="metadata-resource-pick"
            disabled={disabled || anyBusy}
            onClick={() => onPick("song")}
          />
        </div>
      </section>
    </div>
  );
}
