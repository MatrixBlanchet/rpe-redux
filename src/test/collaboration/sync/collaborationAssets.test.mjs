/** Checks resource collection, names, MIME, and magic validation for room assets. */
import assert from "node:assert/strict";
import test from "node:test";
import {
  chartAssetNames,
  isAllowedAssetMime,
  matchesAssetMagic,
  mimeForAsset,
  sanitizeAssetName,
} from "../../../core/collaboration/assets.ts";

test("chart resource names include metadata, line textures, and note hit sounds", () => {
  const names = chartAssetNames({
    META: { song: "audio/song.mp3", background: "cover.png", illustration: "cover.png" },
    judgeLineList: [
      {
        Texture: "line.png",
        attachUI: "ui/skin.png",
        notes: [{ hitSound: "hit.wav" }, { hitsound: "hit.wav" }, { hitSound: "hit-2.wav" }],
      },
    ],
  });
  assert.deepEqual(
    [...names].sort(),
    ["audio/song.mp3", "cover.png", "hit-2.wav", "hit.wav", "line.png", "ui/skin.png"].sort(),
  );
});

test("unsafe names and unknown MIME types are rejected", () => {
  assert.equal(sanitizeAssetName("../escape.png"), null);
  assert.equal(sanitizeAssetName("/absolute.png"), null);
  assert.equal(sanitizeAssetName("C:\\absolute.png"), null);
  assert.equal(sanitizeAssetName("folder\\cover.png"), "folder/cover.png");
  assert.equal(sanitizeAssetName("cover\u0000.png"), null);
  assert.equal(mimeForAsset("cover.PNG"), "image/png");
  assert.equal(isAllowedAssetMime("image/png"), true);
  assert.equal(isAllowedAssetMime("text/html"), false);
});

test("magic checks reject a script disguised as an image", () => {
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const html = new TextEncoder().encode("<script>alert(1)</script>");
  assert.equal(matchesAssetMagic("image/png", png), true);
  assert.equal(matchesAssetMagic("image/png", html), false);
  assert.equal(matchesAssetMagic("application/octet-stream", html), true);
});
