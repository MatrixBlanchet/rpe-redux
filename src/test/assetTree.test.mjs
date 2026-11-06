/** The extracted asset-tree builder keeps folder, file, and selection rules. */
import assert from "node:assert/strict";
import test from "node:test";
import { buildAssetSnapshot } from "../frontend/screens/global/sections/assets/assetTree.ts";
import { assetEntries } from "../frontend/screens/global/sections/assets/assetLibraryModel.ts";

const image = (name) => [name, new Uint8Array([1, 2, 3])];
const audio = (name) => [name, new Uint8Array([4, 5])];

const assets = new Map([
  image("cover.png"),
  image("bg/back.png"),
  audio("bg/theme.mp3"),
  ["readme.txt", new Uint8Array([9])],
]);

/** Build with a cached URL scheme so the test can assert cache behavior. */
async function build(selectedFolder = "", selected = null) {
  const created = new Map();
  const cache = new Map();
  const result = await buildAssetSnapshot({
    assets,
    entries: assetEntries(assets),
    folders: new Set(["", "bg"]),
    selected,
    selectedFolder,
    defaultFolder: (folders) => (folders.has("") ? "" : ([...folders][0] ?? "")),
    urlFor: (name, bytes) => {
      const cached = cache.get(name);
      if (cached && cached.bytes === bytes) {
        return cached.url;
      }
      created.set(name, (created.get(name) ?? 0) + 1);
      const url = `url:${name}:${created.get(name)}`;
      cache.set(name, { bytes, url });
      return url;
    },
    isCurrent: () => true,
  });
  assert.ok(result);
  return { ...result, created };
}

test("the tree separates root files from folder contents", async () => {
  const { snapshot } = await build();
  assert.equal(snapshot.assetCount, 3);
  assert.equal(snapshot.empty, false);
  assert.equal(snapshot.blank, false);
  assert.equal(snapshot.rootVisible, true);
  assert.deepEqual(
    snapshot.files.map((file) => file.name),
    ["cover.png"],
  );
  assert.equal(snapshot.folders.length, 1);
  assert.equal(snapshot.folders[0].path, "bg");
  assert.equal(snapshot.folders[0].count, 2);
  assert.deepEqual(
    snapshot.folders[0].files.map((file) => file.name),
    ["bg/back.png", "bg/theme.mp3"],
  );
  assert.equal(snapshot.folders[0].files[0].kind, "image");
  assert.equal(snapshot.folders[0].files[1].kind, "audio");
});

test("a deleted folder selection falls back to the default root", async () => {
  const { snapshot, selectedFolder } = await build("deleted");
  assert.equal(selectedFolder, "");
  assert.equal(snapshot.selectedFolder, "");
  assert.equal(snapshot.selectedFolderExists, true);
  // Only assets directly at the root count toward the root folder.
  assert.equal(snapshot.selectedFolderCount, 1);
});

test("a selected asset reuses one URL entry", async () => {
  const { snapshot, created } = await build("bg", "bg/back.png");
  assert.equal(snapshot.selected?.name, "bg/back.png");
  assert.equal(snapshot.selected?.url, "url:bg/back.png:1");
  assert.equal(created.get("bg/back.png"), 1);
  assert.equal(snapshot.selectedFolderCount, 2);
});

test("a replaced build reports null instead of a partial snapshot", async () => {
  let current = false;
  const result = await buildAssetSnapshot({
    assets,
    entries: Array.from({ length: 30 }, (_, index) => image(`bulk/${index}.png`)),
    folders: new Set(["bulk"]),
    selected: null,
    selectedFolder: "bulk",
    defaultFolder: () => "bulk",
    urlFor: (name) => `url:${name}`,
    isCurrent: () => current,
  });
  assert.equal(result, null);
  current = true;
});
