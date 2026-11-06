/**
 * Exposes the configured custom background image as a CSS-usable object URL.
 *
 * The bytes live in application data rather than in the library service, so the
 * backdrop cannot reuse `projectAssetUrl`. The URL is revoked when the setting
 * changes or the owning surface unmounts.
 */
import { useEffect, useState } from "react";
import { isDesktop } from "../../core/platform/environment.ts";
import { mediaType } from "../../core/media/mime.ts";
import { COVER_BACKGROUND_KEYS } from "../../core/settings/features/coverBackground.ts";
import { toBlobPart } from "../../core/utils/bytes.ts";
import { readCustomBackground } from "../platform/desktop/customBackground.ts";
import { useSetting } from "../screens/settings/useSetting.ts";

/** The custom background as an object URL, or an empty string when absent. */
export function useCustomBackgroundUrl(): string {
  const reference = useSetting<string>(COVER_BACKGROUND_KEYS.customImage, "");
  const [preview, setPreview] = useState<{ reference: string; url: string } | null>(null);
  useEffect(() => {
    let active = true;
    let objectUrl = "";
    if (!reference.trim() || !isDesktop()) {
      return;
    }
    void readCustomBackground(reference)
      .then((bytes) => {
        if (!active) {
          return;
        }
        const type = mediaType(reference);
        objectUrl = URL.createObjectURL(
          new Blob([toBlobPart(bytes)], {
            type: type.startsWith("image/") ? type : "image/png",
          }),
        );
        setPreview({ reference, url: objectUrl });
      })
      .catch(() => {
        if (active) {
          setPreview({ reference, url: "" });
        }
      });
    return () => {
      active = false;
      if (objectUrl) {
        const oldUrl = objectUrl;
        window.setTimeout(() => URL.revokeObjectURL(oldUrl), 1000);
      }
    };
  }, [reference]);
  return preview?.reference === reference ? preview.url : "";
}
