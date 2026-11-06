/**
 * Dialogs for the asset library's name, rename, and image-edit prompts.
 *
 * The pending question is owned by `assetPrompts.ts`; this view renders it and
 * reports a rejected `submit` inside the dialog, so dismissing the request
 * closes it without leaving a half-applied edit.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { mediaType } from "../../../../../core/media/mime.ts";
import { FieldRow } from "../../../../../design/components/field/FieldRow.tsx";
import { Input } from "../../../../../design/components/input/Input.tsx";
import { Select } from "../../../../../design/components/select/Select.tsx";
import { SliderField } from "../../../../../design/components/slider/SliderField.tsx";
import { useTranslation } from "../../../../../i18n/react.ts";
import {
  PromptDialog,
  usePromptAction,
  useQueuedPrompt,
} from "../../../../overlays/modals/QueuedPrompt.tsx";
import {
  closeAssetPrompt,
  getAssetPrompt,
  subscribeAssetPrompt,
  type AssetEditPrompt,
  type AssetNamePrompt,
} from "./assetPrompts.ts";

/** Paints the source into the preview canvas with the transform the controls ask for. */
function drawPreview(
  source: HTMLImageElement | null,
  canvas: HTMLCanvasElement | null,
  rotation: HTMLSelectElement | null,
  flip: HTMLSelectElement | null,
  brightness: HTMLInputElement | null,
): void {
  if (!source?.naturalWidth || !canvas || !rotation || !flip || !brightness) {
    return;
  }
  const angle = Number(rotation.value);
  const quarter = angle % 180 !== 0;
  const width = quarter ? source.naturalHeight : source.naturalWidth;
  const height = quarter ? source.naturalWidth : source.naturalHeight;
  canvas.width = Math.min(900, width);
  canvas.height = Math.min(650, height);
  const context = canvas.getContext("2d");
  if (!context) {
    return;
  }
  context.save();
  context.translate(canvas.width / 2, canvas.height / 2);
  context.rotate((angle * Math.PI) / 180);
  const scale = Math.min(canvas.width / source.naturalWidth, canvas.height / source.naturalHeight);
  context.scale((flip.value === "x" ? -1 : 1) * scale, (flip.value === "y" ? -1 : 1) * scale);
  context.filter = `brightness(${brightness.value}%)`;
  context.drawImage(source, -source.naturalWidth / 2, -source.naturalHeight / 2);
  context.restore();
}

/**
 * Renders the asset library's next pending prompt as shared dialog content.
 *
 * A prompt asks about the panel rather than the document, so the dialog is
 * mounted by the library view and its question lives in `assetPrompts`.
 */
export function AssetDialogs() {
  const { request, open } = useQueuedPrompt(subscribeAssetPrompt, getAssetPrompt);
  if (!request) {
    return null;
  }
  return request.kind === "edit" ? (
    <AssetImageEditorDialog key={request.id} request={request} open={open} />
  ) : (
    <AssetNameDialog key={request.id} request={request} open={open} />
  );
}

/** Name prompt shared by folder creation and asset rename. */
function AssetNameDialog({ request, open }: { request: AssetNamePrompt; open: boolean }) {
  const { t } = useTranslation();
  const action = usePromptAction(closeAssetPrompt);
  const input = useRef<HTMLInputElement | null>(null);
  const apply = () => action.run(() => request.submit(input.current?.value ?? ""));
  return (
    <PromptDialog
      requestId={`asset:${request.id}`}
      open={open}
      onClose={closeAssetPrompt}
      label={request.title}
      description={request.description}
      className="redux-asset-dialog"
      error={action.error}
      pending={action.pending}
      submitLabel={t("common.action.apply")}
      cancelLabel={t("workspace.dialogs.dismiss")}
      onSubmit={apply}
    >
      <FieldRow
        layout="inline"
        className="modal-field"
        htmlFor={`asset-name-${request.id}`}
        label={request.label}
        control={
          <Input
            id={`asset-name-${request.id}`}
            ref={input}
            type="text"
            placeholder={request.placeholder}
            defaultValue={request.value}
            autoFocus
            onKeyDown={(event) => {
              // The shared dialog draws no form, so Enter is answered here: the
              // keyboard means "apply", exactly as the button does.
              if (event.key === "Enter") {
                event.preventDefault();
                apply();
              }
            }}
          />
        }
      />
    </PromptDialog>
  );
}

/**
 * Image editor prompt: rotation, flip, and brightness previewed on a canvas.
 *
 * The preview canvas lives in this dialog, and the decoded source is a one-off
 * object URL released as soon as the image loads, so it never enters the
 * library's URL cache.
 */
function AssetImageEditorDialog({ request, open }: { request: AssetEditPrompt; open: boolean }) {
  const { t } = useTranslation();
  const action = usePromptAction(closeAssetPrompt);
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const rotation = useRef<HTMLSelectElement | null>(null);
  const flip = useRef<HTMLSelectElement | null>(null);
  const brightness = useRef<HTMLInputElement | null>(null);
  const [brightnessValue, setBrightnessValue] = useState(100);
  const source = useRef<HTMLImageElement | null>(null);

  const draw = useCallback(() => {
    drawPreview(source.current, canvas.current, rotation.current, flip.current, brightness.current);
  }, []);

  useEffect(() => {
    const image = new Image();
    const url = URL.createObjectURL(
      new Blob([request.bytes.slice()], { type: mediaType(request.name) }),
    );
    source.current = image;
    // The URL is attached before the load listeners are, so a decode that lands
    // early still finds them: `draw()` only ever reads `source`, which is why the
    // URL can go back the moment the load finishes.
    image.onload = () => {
      URL.revokeObjectURL(url);
      draw();
    };
    image.onerror = () => URL.revokeObjectURL(url);
    image.src = url;
    return () => {
      URL.revokeObjectURL(url);
      source.current = null;
    };
  }, [draw, request.bytes, request.name]);

  const apply = () =>
    action.run(async () => {
      const target = canvas.current;
      if (!target) {
        return;
      }
      const blob = await new Promise<Blob | null>((resolve) => target.toBlob(resolve, "image/png"));
      if (!blob) {
        throw new Error(t("editorPanels.assetLibrary.edit.exportFailed"));
      }
      await request.submit(new Uint8Array(await blob.arrayBuffer()));
    });

  return (
    <PromptDialog
      requestId={`asset:${request.id}`}
      open={open}
      onClose={closeAssetPrompt}
      label={request.title}
      description={request.description}
      className="redux-asset-dialog"
      error={action.error}
      pending={action.pending}
      submitLabel={t("common.action.apply")}
      cancelLabel={t("workspace.dialogs.dismiss")}
      onSubmit={apply}
    >
      <canvas
        ref={(node) => {
          canvas.current = node;
          if (node && source.current?.complete) {
            draw();
          }
        }}
        className="asset-editor-canvas"
        aria-hidden="true"
      />
      <div className="asset-editor-controls">
        <label>
          <span className="redux-visually-hidden">
            {t("editorPanels.assetLibrary.edit.rotate", { degrees: 0 })}
          </span>
          <Select ref={rotation} defaultValue="0" onChange={draw}>
            {[0, 90, 180, 270].map((degrees) => (
              <option value={degrees} key={degrees}>
                {t("editorPanels.assetLibrary.edit.rotate", { degrees })}
              </option>
            ))}
          </Select>
        </label>
        <label>
          <span className="redux-visually-hidden">
            {t("editorPanels.assetLibrary.edit.flip.none")}
          </span>
          <Select ref={flip} defaultValue="none" onChange={draw}>
            <option value="none">{t("editorPanels.assetLibrary.edit.flip.none")}</option>
            <option value="x">{t("editorPanels.assetLibrary.edit.flip.horizontal")}</option>
            <option value="y">{t("editorPanels.assetLibrary.edit.flip.vertical")}</option>
          </Select>
        </label>
        <SliderField
          id="asset-brightness"
          inputRef={brightness}
          min={0}
          max={200}
          step={1}
          value={brightnessValue}
          unit="%"
          aria-label={t("editorPanels.assetLibrary.edit.brightness")}
          onChange={(event) => {
            setBrightnessValue(Number(event.currentTarget.value));
            draw();
          }}
          onInput={draw}
        />
      </div>
    </PromptDialog>
  );
}
