/** Field drafts commit independently against the live chart when focus leaves a field. */
import { useEffect, useRef, useState } from "react";
import { chartWithMetadataDraft } from "../../../../../core/global/chart/editing/drafts.ts";
import { useTranslation } from "../../../../../i18n/react.ts";
import { MetadataFields } from "../../../editor/chartMetadata/MetadataFields.tsx";
import { MediaFields, type MediaKind } from "../../../editor/chartMetadata/MediaFields.tsx";
import { onboardingAnchorRef } from "../../../../onboarding/anchors.ts";
import {
  metadataFields,
  metadataValues,
  type MetadataField,
} from "../../../editor/chartMetadata/fields.ts";
import { useDocumentRuntime } from "../../../editor/workspace/runtime/providers/DocumentProvider.tsx";
import type { FormRequest } from "../../../editor/inspector/formRequest.ts";

/** Renders text and resource fields for one chart, committing each field on blur. */
export function MetadataPanelView({ session, chart }: FormRequest) {
  const { t } = useTranslation();
  const runtime = useDocumentRuntime();
  const [drafts, setDrafts] = useState<
    Partial<Record<MetadataField, { source: string; value: string }>>
  >({});
  const [busy, setBusy] = useState<MediaKind | null>(null);
  const [errors, setErrors] = useState<Partial<Record<MediaKind, string>>>({});
  const [error, setError] = useState("");
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const source = metadataValues(chart);
  const stale = metadataFields.filter(
    ({ key }) => drafts[key] && drafts[key]?.source !== source[key],
  );
  if (stale.length) {
    setDrafts((previous) => {
      const next = { ...previous };
      for (const { key } of stale) {
        delete next[key];
      }
      return next;
    });
  }
  const values = { ...source };
  for (const { key } of metadataFields) {
    const draft = drafts[key];
    if (draft?.source === source[key]) {
      values[key] = draft.value;
    }
  }
  const media = runtime?.metadataMedia.describe(session);
  /** Commits one changed metadata field, keeping it as a draft on failure. */
  function commit(field: MetadataField, value: string): void {
    const current = String(session.chart.META[field] ?? "");
    try {
      if (current !== value) {
        session.commitChart(
          t("editorPanels.inspector.form.metadata.title"),
          chartWithMetadataDraft(session.chart, { [field]: value }),
          session.selectionState(),
          undefined,
          { normalized: true },
        );
      }
      setDrafts((previous) => {
        const next = { ...previous };
        delete next[field];
        return next;
      });
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    }
  }
  /** Opens the media picker for one resource kind and reports failures inline. */
  async function pick(kind: MediaKind): Promise<void> {
    if (!runtime || busy) {
      return;
    }
    setBusy(kind);
    setErrors((previous) => ({ ...previous, [kind]: undefined }));
    try {
      await runtime.metadataMedia.pick(kind, session);
    } catch (reason) {
      if (alive.current) {
        setErrors((previous) => ({
          ...previous,
          [kind]: reason instanceof Error ? reason.message : String(reason),
        }));
      }
    } finally {
      if (alive.current) {
        setBusy(null);
      }
    }
  }
  return (
    <div className="metadata-panel-form">
      <section
        className="metadata-section metadata-section-fields"
        ref={onboardingAnchorRef("metadata-fields")}
      >
        <header className="metadata-section-heading">
          <h2>{t("editorPanels.metadata.metadataSection")}</h2>
        </header>
        <MetadataFields
          values={values}
          onChange={(field, value) =>
            setDrafts((previous) => ({ ...previous, [field]: { source: source[field], value } }))
          }
          onBlur={commit}
        />
      </section>
      <section
        className="metadata-section metadata-section-resources"
        ref={onboardingAnchorRef("metadata-resources")}
      >
        <header className="metadata-section-heading">
          <h2>{t("editorPanels.metadata.resourcesSection")}</h2>
        </header>
        <MediaFields
          songName={media?.songName ?? ""}
          backgroundName={media?.coverName ?? ""}
          song={media?.song ?? null}
          background={media?.cover ?? null}
          busy={busy}
          errors={errors}
          disabled={Boolean(busy)}
          onPick={(kind) => void pick(kind)}
        />
      </section>
      {error && (
        <p className="chart-metadata-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
