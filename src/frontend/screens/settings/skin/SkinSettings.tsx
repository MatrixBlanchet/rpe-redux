/**
 * The note-skin page of the settings window.
 *
 * Bundled and imported skins are listed with their note, event, judgeline, and
 * particle assets, and the chosen one is previewed before it is applied. A skin
 * switch replaces every preview with a skeleton; each texture and sound then
 * leaves its skeleton on its own once the browser has decoded it.
 */
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode,
} from "react";
import { Select } from "../../../../design/components/select/Select.tsx";
import { InlineAlert } from "../../../../design/components/alert/InlineAlert.tsx";
import { Card } from "../../../../design/components/card/Card.tsx";
import { Section } from "../../../../design/components/section/Section.tsx";
import { FieldRow } from "../../../../design/components/field/FieldRow.tsx";
import { Button } from "../../../../design/components/button/Button.tsx";
import { Icon } from "../../../../design/components/icon/Icon.tsx";
import { AsyncImage } from "../../../../design/components/image/AsyncImage.tsx";
import {
  DEFAULT_NOTE_SKIN,
  EXTERNAL_NOTE_SKIN_PREFIX,
  loadNoteSkin,
  selectNoteSkin,
  type LoadedNoteSkin,
} from "../../../../core/media/noteSkins.ts";
import {
  externalNoteSkins,
  refreshExternalNoteSkins,
  subscribeExternalNoteSkins,
} from "../../../../core/platform/desktop/noteSkinPackages.ts";
import { mediaType } from "../../../../core/media/mime.ts";
import { useTranslation } from "../../../../i18n/react.ts";
import { registerSettingsPage } from "../settingsContributions.ts";
import { toBlobPart } from "../../../../core/utils/bytes.ts";
import { NOTE_TEXTURES } from "../../../../core/media/noteSkin.ts";
import { useActiveNoteSkin } from "./useActiveNoteSkin.ts";
import { bundledNoteSkinName } from "../../../platform/noteSkinBridge.ts";
import { packageName, type PackageName } from "../../../../core/utils/packageName.ts";

type PreviewAsset = {
  name: string;
  url: string | null;
};
type SkinPreviewState = {
  notes: PreviewAsset[];
  event: PreviewAsset;
  judgeline: PreviewAsset;
  particles: PreviewAsset[];
  sounds: PreviewAsset[];
};
/**
 * One load attempt, as one state value.
 *
 * The effect publishes the finished attempt, not four separate fields, so a
 * loaded skin reaches the page in a single render and a failed one does not
 * leave the previous counter row behind. `key` ties the result to the skin the
 * page asked for, so a stale result is ignored instead of painting under a
 * newly selected skin.
 */
type SkinLoad =
  | { status: "error"; key: string; message: string }
  | {
      status: "ready";
      key: string;
      previews: SkinPreviewState;
    };

/** Identifies one selection attempt: a skin id plus an external package revision. */
function skinLoadKey(id: string, fingerprint: string): string {
  return `${id}\u0000${fingerprint}`;
}

/** Placeholder counts for the page-level skeleton while the skin pack loads. */
const NOTE_SKELETON_COUNT = NOTE_TEXTURES.filter((name) => name !== "event_bar").length;
/** How long a finished sound keeps its fill before the empty fill is dropped. */
const SOUND_END_HOLD_MS = 350;
/** Skin sounds that are neither previewed nor played. */
const HIDDEN_SKIN_SOUNDS: ReadonlySet<string> = new Set(["hold", "high"]);

/** Build preview URLs for every note, event, judgeline, particle, and sound asset. */
function createPreviewAssets(pack: LoadedNoteSkin): {
  previews: SkinPreviewState;
  urls: string[];
} {
  const urls: string[] = [];
  /** Resolve one manifest file into an asset and one object URL to revoke later. */
  const asset = (name: string, file: string | undefined): PreviewAsset => {
    if (!file) {
      return { name, url: null };
    }
    const bytes = pack.files.get(file);
    if (!bytes) {
      return { name, url: null };
    }
    const url = URL.createObjectURL(new Blob([toBlobPart(bytes)], { type: mediaType(file) }));
    urls.push(url);
    return { name, url };
  };
  // `event_bar` has its own section, so it is not one of the note tiles.
  const notes = NOTE_TEXTURES.filter((name) => name !== "event_bar").map((name) =>
    asset(name, pack.manifest.notes[name]?.file),
  );
  const particles = Object.entries(pack.manifest.particles ?? {})
    .sort((left, right) => {
      const number = (name: string) => Number(name.match(/(\d+)$/)?.[1] ?? Number.MAX_SAFE_INTEGER);
      return number(left[0]) - number(right[0]);
    })
    .map(([name, file]) => asset(name, file));
  const sounds = Object.entries(pack.manifest.audio ?? {})
    .filter(([name]) => !HIDDEN_SKIN_SOUNDS.has(name))
    .map(([name, file]) => asset(name, file));
  return {
    previews: {
      notes,
      event: asset("event_bar", pack.manifest.events.event_bar?.file),
      judgeline: asset("line", pack.manifest.judgeline?.line.file),
      particles,
      sounds,
    },
    urls,
  };
}

/** One titled block of skin asset previews. */
function PreviewSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Section title={title} separated={false} className="redux-skin-preview-section">
      {children}
    </Section>
  );
}

/** Skeleton tiles shown while a skin pack decodes. */
function LoadingTiles({
  count,
  rowClassName,
  tileClassName,
}: {
  count: number;
  rowClassName: string;
  tileClassName: string;
}) {
  return (
    <div className={rowClassName}>
      {Array.from({ length: count }, (_, index) => (
        <span className={tileClassName} key={index} aria-hidden="true">
          <span className="redux-image-skeleton" />
        </span>
      ))}
    </div>
  );
}

/** Placeholder text for an asset the pack does not provide. */
function Missing({ label, name }: { label: string; name?: string }) {
  return (
    <span className="redux-skin-missing">
      {label}
      {name ? ` · ${name}` : ""}
    </span>
  );
}

/**
 * One hit-sound button. The whole row toggles playback, the text stays on the
 * left, and the play/pause glyph stays on the right. While the sound plays, a
 * pseudo-element paints the progress fill from the left; requestAnimationFrame
 * keeps that fill smooth without re-rendering the page around it.
 */
function SoundPreview({
  asset,
  playLabel,
  pauseLabel,
  missingLabel,
}: {
  asset: PreviewAsset;
  playLabel: string;
  pauseLabel: string;
  missingLabel: string;
}) {
  const audio = useRef<HTMLAudioElement>(null);
  const endTimer = useRef(0);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [finished, setFinished] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!playing) {
      return undefined;
    }
    let frame = window.requestAnimationFrame(function tick() {
      const element = audio.current;
      if (element && Number.isFinite(element.duration) && element.duration > 0) {
        setProgress(Math.min(1, element.currentTime / element.duration));
      }
      frame = window.requestAnimationFrame(tick);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [playing]);

  useEffect(
    () => () => {
      if (endTimer.current) {
        window.clearTimeout(endTimer.current);
      }
    },
    [],
  );

  if (failed) {
    return <Missing label={missingLabel} name={asset.name} />;
  }

  /** Start or pause the clip and reset the progress fill. */
  const toggle = () => {
    const element = audio.current;
    if (!element || !ready) {
      return;
    }
    if (element.paused) {
      if (endTimer.current) {
        window.clearTimeout(endTimer.current);
        endTimer.current = 0;
      }
      setFinished(false);
      setProgress(0);
      setPlaying(true);
      void element.play().catch(() => {
        setPlaying(false);
        setProgress(0);
      });
    } else {
      element.pause();
      setPlaying(false);
      setFinished(false);
      setProgress(0);
    }
  };

  /** Show the completed fill briefly, then fade it back to the resting surface. */
  const handleEnded = () => {
    setPlaying(false);
    // Hold the finished fill for a moment so the eye registers the completed
    // pass; the CSS fade starts immediately and the timer drops the empty fill.
    setProgress(1);
    setFinished(true);
    if (endTimer.current) {
      window.clearTimeout(endTimer.current);
    }
    endTimer.current = window.setTimeout(() => {
      endTimer.current = 0;
      setFinished(false);
      setProgress(0);
    }, SOUND_END_HOLD_MS);
  };

  const label = playing ? pauseLabel : playLabel;
  const fill = `${progress * 100}%`;
  return (
    <div className="redux-skin-sound-player">
      <audio
        ref={audio}
        preload="metadata"
        src={asset.url ?? undefined}
        onLoadedMetadata={() => setReady(true)}
        onCanPlay={() => setReady(true)}
        onEnded={handleEnded}
        onError={() => setFailed(true)}
      />
      <Button
        variant="plain"
        className={`redux-skin-sound${playing ? " is-playing" : ""}${
          finished ? " is-finished" : ""
        }`}
        style={{ "--redux-skin-sound-progress": fill } as CSSProperties}
        disabled={!ready}
        onClick={toggle}
      >
        <span className="redux-skin-sound-name">{asset.name}</span>
        <span className="redux-skin-sound-icon">
          <Icon name={playing ? "previewPause" : "playbackPlay"} size={16} />
        </span>
        <span className="redux-visually-hidden">{label}</span>
        {!ready && <span className="redux-image-skeleton" aria-hidden="true" />}
      </Button>
    </div>
  );
}

/** The note-skin picker with a full asset preview of the selected package. */
export function SkinSettings() {
  const { t, language } = useTranslation();
  const active = useActiveNoteSkin();
  const [bundledName, setBundledName] = useState<PackageName>("Redux Default");
  // Read the bundled package name from the host bridge once.
  useEffect(() => {
    let mounted = true;
    void bundledNoteSkinName().then((name) => {
      if (mounted) {
        setBundledName(name);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);
  const external = useSyncExternalStore(
    subscribeExternalNoteSkins,
    externalNoteSkins,
    externalNoteSkins,
  );
  const previewUrls = useRef<string[]>([]);
  const [load, setLoad] = useState<SkinLoad | null>(null);
  const [scanned, setScanned] = useState(false);
  const contentRevision = useRef(0);
  const alive = useRef(true);
  // Rescan external packages on mount and mark the scan as finished.
  useEffect(() => {
    let mounted = true;
    void refreshExternalNoteSkins().finally(() => {
      if (mounted) {
        setScanned(true);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);
  const activeExternal = external.find(
    (skin) => `${EXTERNAL_NOTE_SKIN_PREFIX}${skin.id}` === active,
  );
  const missingId =
    scanned && active.startsWith(EXTERNAL_NOTE_SKIN_PREFIX) && !activeExternal
      ? active.slice(EXTERNAL_NOTE_SKIN_PREFIX.length)
      : "";
  // A changed fingerprint means the active external package was edited on disk.
  const externalFingerprint = activeExternal?.fingerprint ?? "";
  // The result is tied to the selection that asked for it. Deriving the visible
  // state from this key makes a new selection start in its skeleton state in
  // the same render, before the load effect has a chance to run.
  const loadKey = skinLoadKey(active, externalFingerprint);
  const current = load?.key === loadKey ? load : null;
  const ready = current?.status === "ready" ? current : null;
  const failure = current?.status === "error" ? current : null;
  const loading = current === null;
  // Load the selected skin and replace its preview URLs on success.
  // The catalog translator is stable; the messages it builds read the current
  // language when they fire, so a language switch does not need a reload.
  useEffect(() => {
    alive.current = true;
    const revision = ++contentRevision.current;
    const key = skinLoadKey(active, externalFingerprint);
    loadNoteSkin(active)
      .then((value) => {
        const next = createPreviewAssets(value);
        if (!alive.current || revision !== contentRevision.current) {
          next.urls.forEach((url) => URL.revokeObjectURL(url));
          return;
        }
        previewUrls.current.forEach((url) => URL.revokeObjectURL(url));
        previewUrls.current = next.urls;
        setLoad({
          status: "ready",
          key,
          previews: next.previews,
        });
      })
      .catch((cause) => {
        if (alive.current && revision === contentRevision.current) {
          previewUrls.current.forEach((url) => URL.revokeObjectURL(url));
          previewUrls.current = [];
          setLoad({
            status: "error",
            key,
            message: t("settings.skin.error.list", { message: String(cause) }),
          });
        }
      });
    return () => {
      alive.current = false;
      contentRevision.current += 1;
      previewUrls.current.forEach((url) => URL.revokeObjectURL(url));
      previewUrls.current = [];
    };
  }, [active, externalFingerprint, t]);

  const total = ready
    ? ready.previews.notes.length +
      ready.previews.particles.length +
      (ready.previews.event.url ? 1 : 0) +
      (ready.previews.judgeline.url ? 1 : 0) +
      ready.previews.sounds.length
    : 0;
  return (
    <div className="redux-skin">
      <section className="redux-skin-current">
        <FieldRow
          className="redux-setting"
          data-setting="note-skin"
          htmlFor="note-skin-select"
          label={t("settings.skin.field.label")}
          control={
            <Select
              id="note-skin-select"
              value={active}
              onChange={(event) => void selectNoteSkin(event.target.value)}
            >
              <option value={DEFAULT_NOTE_SKIN}>{packageName(bundledName, language)}</option>
              {external.map((skin) => (
                <option key={skin.id} value={`${EXTERNAL_NOTE_SKIN_PREFIX}${skin.id}`}>
                  {packageName(skin.name, language)}
                </option>
              ))}
              {missingId && (
                <option value={active}>
                  {t("settings.skin.option.missing", { id: missingId })}
                </option>
              )}
            </Select>
          }
        />
      </section>

      {missingId && (
        <InlineAlert tone="warning" className="redux-skin-warning">
          {t("settings.skin.warning.missingActive", { id: missingId })}
        </InlineAlert>
      )}

      {failure && !missingId && (
        <InlineAlert className="redux-skin-error">{failure.message}</InlineAlert>
      )}

      {ready && total === 0 && (
        <p className="redux-skin-empty">{t("settings.skin.preview.empty")}</p>
      )}

      {loading && (
        <div className="redux-skin-previews" aria-busy="true">
          <span className="redux-visually-hidden">{t("settings.skin.preview.loading")}</span>
          <PreviewSection title={t("settings.skin.preview.notes")}>
            <LoadingTiles
              count={NOTE_SKELETON_COUNT}
              rowClassName="redux-skin-preview-grid"
              tileClassName="redux-skin-loading redux-skin-loading-tile"
            />
          </PreviewSection>
          <div className="redux-skin-preview-pair">
            <PreviewSection title={t("settings.skin.preview.event")}>
              <span className="redux-skin-loading redux-skin-loading-bar" aria-hidden="true">
                <span className="redux-image-skeleton" />
              </span>
            </PreviewSection>
            <PreviewSection title={t("settings.skin.preview.judgeline")}>
              <span className="redux-skin-loading redux-skin-loading-bar" aria-hidden="true">
                <span className="redux-image-skeleton" />
              </span>
            </PreviewSection>
          </div>
          <PreviewSection title={t("settings.skin.preview.particles")}>
            <span className="redux-skin-loading redux-skin-loading-bar" aria-hidden="true">
              <span className="redux-image-skeleton" />
            </span>
          </PreviewSection>
          <PreviewSection title={t("settings.skin.preview.sounds")}>
            <span className="redux-skin-loading redux-skin-loading-bar" aria-hidden="true">
              <span className="redux-image-skeleton" />
            </span>
          </PreviewSection>
        </div>
      )}

      {ready && (
        <div className="redux-skin-previews">
          <PreviewSection title={t("settings.skin.preview.notes")}>
            <div className="redux-skin-preview-grid">
              {ready.previews.notes.map((asset) => (
                <Card
                  as="figure"
                  tone="control"
                  className="redux-skin-preview-asset"
                  key={asset.name}
                >
                  <div className="redux-skin-preview-media">
                    {asset.url ? (
                      <AsyncImage
                        src={asset.url}
                        alt={asset.name}
                        decoding="async"
                        fallback={<Missing label={t("settings.skin.preview.missing")} />}
                      />
                    ) : (
                      <Missing label={t("settings.skin.preview.missing")} />
                    )}
                  </div>
                  <figcaption>{asset.name}</figcaption>
                </Card>
              ))}
            </div>
          </PreviewSection>
          <div className="redux-skin-preview-pair">
            <PreviewSection title={t("settings.skin.preview.event")}>
              {ready.previews.event.url ? (
                <figure className="redux-skin-bar-preview" data-asset={ready.previews.event.name}>
                  <div className="redux-skin-bar-media">
                    <AsyncImage
                      src={ready.previews.event.url}
                      alt={ready.previews.event.name}
                      decoding="async"
                      fallback={<Missing label={t("settings.skin.preview.missing")} />}
                    />
                  </div>
                  <figcaption>{ready.previews.event.name}</figcaption>
                </figure>
              ) : (
                <Missing
                  label={t("settings.skin.preview.missing")}
                  name={ready.previews.event.name}
                />
              )}
            </PreviewSection>
            <PreviewSection title={t("settings.skin.preview.judgeline")}>
              {ready.previews.judgeline.url ? (
                <figure
                  className="redux-skin-bar-preview"
                  data-asset={ready.previews.judgeline.name}
                >
                  <div className="redux-skin-bar-media">
                    <AsyncImage
                      src={ready.previews.judgeline.url}
                      alt={ready.previews.judgeline.name}
                      decoding="async"
                      fallback={<Missing label={t("settings.skin.preview.missing")} />}
                    />
                  </div>
                  <figcaption>{ready.previews.judgeline.name}</figcaption>
                </figure>
              ) : (
                <Missing
                  label={t("settings.skin.preview.missing")}
                  name={ready.previews.judgeline.name}
                />
              )}
            </PreviewSection>
          </div>
          <PreviewSection title={t("settings.skin.preview.particles")}>
            {ready.previews.particles.length ? (
              <div className="redux-skin-particle-list">
                {ready.previews.particles.map((asset) => (
                  <Card
                    as="figure"
                    tone="control"
                    className="redux-skin-preview-asset"
                    key={asset.name}
                  >
                    <div className="redux-skin-preview-media">
                      {asset.url ? (
                        <AsyncImage
                          src={asset.url}
                          alt={asset.name}
                          decoding="async"
                          fallback={<Missing label={t("settings.skin.preview.missing")} />}
                        />
                      ) : null}
                    </div>
                    <figcaption>{asset.name}</figcaption>
                  </Card>
                ))}
              </div>
            ) : (
              <Missing label={t("settings.skin.preview.empty")} />
            )}
          </PreviewSection>
          <PreviewSection title={t("settings.skin.preview.sounds")}>
            {ready.previews.sounds.length ? (
              <div className="redux-skin-sounds">
                {ready.previews.sounds.map((asset) =>
                  asset.url ? (
                    <SoundPreview
                      key={`${asset.name}:${asset.url}`}
                      asset={asset}
                      playLabel={t("settings.skin.preview.play")}
                      pauseLabel={t("settings.skin.preview.pause")}
                      missingLabel={t("settings.skin.preview.missing")}
                    />
                  ) : (
                    <Missing
                      key={asset.name}
                      label={t("settings.skin.preview.missing")}
                      name={asset.name}
                    />
                  ),
                )}
              </div>
            ) : (
              <Missing label={t("settings.skin.preview.empty")} />
            )}
          </PreviewSection>
        </div>
      )}
    </div>
  );
}

registerSettingsPage("appearance.skin", {
  keywords: "settings.search.skinKeywords",
  component: SkinSettings,
});
