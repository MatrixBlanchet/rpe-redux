/**
 * External-resource policy UX: missing-resource notices and failed open/save
 * messages explain that files outside the chart folder are denied by default.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { setLanguage, t } from "../i18n/index.ts";
import { localizeOpenError, localizeSaveError } from "../core/platform/desktop/documentStore.ts";

test("unsafe_save_asset_path tells the author to copy external files into the folder", () => {
  setLanguage("en");
  const failure = localizeSaveError(new Error("unsafe_save_asset_path"));
  assert.equal(failure.code, "unsafe_save_asset_path");
  assert.match(failure.message, /outside its folder/i);
  assert.match(failure.message, /Copy external resources into the chart folder/i);

  setLanguage("zh");
  const chinese = localizeSaveError("unsafe_save_asset_path");
  assert.equal(chinese.code, "unsafe_save_asset_path");
  assert.match(chinese.message, /文档目录外/);
  assert.match(chinese.message, /复制到谱面目录/);

  setLanguage("en");
});

test("missing image and music notices mention the external-file policy", () => {
  setLanguage("en");
  assert.match(
    t("system.image.missing", { name: "bg.png" }),
    /external files are not loaded by default/i,
  );
  assert.match(
    t("editor.app.status.musicMissing", { name: "song.ogg" }),
    /outside the chart folder are not loaded by default/i,
  );

  setLanguage("zh");
  assert.match(t("system.image.missing", { name: "bg.png" }), /外部文件默认不会加载/);
  assert.match(t("editor.app.status.musicMissing", { name: "song.ogg" }), /文档目录外/);

  setLanguage("en");
});

test("failed opens append the policy hint without repeating it", () => {
  setLanguage("en");
  const failure = localizeOpenError(new Error("The chart format is invalid."));
  assert.match(failure.message, /^The chart format is invalid\./);
  assert.match(failure.message, /External files are not loaded by default/);
  assert.equal(localizeOpenError(failure).message, failure.message);
});

test("a superseded open keeps its AbortError identity", () => {
  const abort = Object.assign(new Error("cancelled"), { name: "AbortError" });
  assert.equal(localizeOpenError(abort), abort);
});
