/** Verifies host-version ranges, GitHub links, and marketplace catalog rules. */
import assert from "node:assert/strict";
import test from "node:test";
import { isVersionRange, satisfiesVersionRange } from "../../../core/utils/version.ts";
import {
  manifestEngineRequirement,
  marketplaceSource,
  parseGitHubSource,
  parseMarketplaceCatalog,
  validateMarketplaceCatalog,
} from "../../../core/extensions/install.ts";
import { validateManifest } from "../../../core/extensions/extensionRuntimeSupport.ts";

const baseManifest = {
  kind: "extension",
  id: "test.install",
  name: "Install",
  version: "1.0.0",
  engines: { "rpe-redux": 1 },
  capabilities: ["scripts"],
  scripts: [{ id: "run", steps: [{ op: "notice", message: "hello" }] }],
};

test("semver ranges accept the forms Extension authors use", () => {
  assert.equal(satisfiesVersionRange("1.0.0-a1", ">=1.0.0-a1 <2.0.0"), true);
  assert.equal(satisfiesVersionRange("1.0.0-a1", ">=1.0.0"), false);
  assert.equal(satisfiesVersionRange("1.4.2", "^1.2.0"), true);
  assert.equal(satisfiesVersionRange("2.0.0", "^1.2.0"), false);
  assert.equal(satisfiesVersionRange("1.2.9", "~1.2.3"), true);
  assert.equal(satisfiesVersionRange("1.3.0", "~1.2.3"), false);
  assert.equal(satisfiesVersionRange("0.2.5", "^0.2.3"), true);
  assert.equal(satisfiesVersionRange("0.3.0", "^0.2.3"), false);
  assert.equal(satisfiesVersionRange("0.0.4", "^0.0.3"), false);
  assert.equal(satisfiesVersionRange("1.2.3", "1.x"), true);
  assert.equal(satisfiesVersionRange("2.0.0", "1.x"), false);
  assert.equal(satisfiesVersionRange("1.2.4", "1.2"), true);
  assert.equal(satisfiesVersionRange("1.3.0", "1.2"), false);
  assert.equal(satisfiesVersionRange("1.4.9", "1.2 - 1.4"), true);
  assert.equal(satisfiesVersionRange("1.5.0", "1.2 - 1.4"), false);
  assert.equal(satisfiesVersionRange("2.0.0", "^1.0.0 || ^2.0.0"), true);
  assert.equal(satisfiesVersionRange("1.5.0", ">=1.0.0 <2.0.0"), true);
  assert.equal(isVersionRange("*"), true);
  assert.equal(isVersionRange("nope"), false);
  assert.equal(satisfiesVersionRange("1.0.0", "nope"), false);
});

test("the legacy mod kind remains a valid manifest alias", () => {
  assert.equal(validateManifest({ ...baseManifest, kind: "mod" }, 1), null);
  assert.equal(validateManifest({ ...baseManifest, kind: "extension" }, 1), null);
});

test("extension collaboration scope defaults locally and validates peer requirements", () => {
  assert.equal(baseManifest.collaboration ?? "local", "local");
  assert.equal(validateManifest({ ...baseManifest, collaboration: "chart" }, 1), null);
  const shared = { ...baseManifest, collaboration: "shared-service" };
  assert.equal(validateManifest(shared, 1), null);
  assert.equal(shared.collaboration, "shared-service");
  assert.equal(
    validateManifest({ ...baseManifest, collaboration: "server" }, 1)?.code,
    "invalidCollaboration",
  );
});

test("a manifest string range is checked against the full host version", () => {
  const compatible = {
    ...baseManifest,
    engines: { "rpe-redux": ">=1.0.0-a1 <2.0.0" },
  };
  assert.equal(validateManifest(compatible, "1.0.0-a1"), null);

  const incompatible = {
    ...baseManifest,
    engines: { "rpe-redux": ">=2.0.0" },
  };
  assert.equal(validateManifest(incompatible, "1.0.0-a1")?.code, "incompatibleHostVersion");

  const malformed = {
    ...baseManifest,
    engines: { "rpe-redux": "not a range" },
  };
  assert.equal(validateManifest(malformed, "1.0.0-a1")?.code, "invalidHostVersionRange");

  assert.equal(validateManifest(baseManifest, "1.0.0-a1"), null);
  assert.equal(validateManifest(baseManifest, "2.0.0")?.code, "incompatibleHostVersion");
  assert.equal(manifestEngineRequirement(baseManifest), "1");
  assert.equal(manifestEngineRequirement(compatible), ">=1.0.0-a1 <2.0.0");
});

test("GitHub links normalize repository, ref, and package path", () => {
  const shorthand = parseGitHubSource("owner/repo");
  assert.equal(shorthand.owner, "owner");
  assert.equal(shorthand.repo, "repo");
  assert.equal(shorthand.ref, null);
  assert.equal(shorthand.path, null);
  assert.equal(shorthand.canonicalUrl, "https://github.com/owner/repo");

  const tree = parseGitHubSource("https://github.com/owner/repo/tree/main/extensions/demo");
  assert.equal(tree.ref, "main");
  assert.equal(tree.path, "extensions/demo");
  assert.equal(tree.canonicalUrl, "https://github.com/owner/repo/tree/main/extensions/demo");

  const blob = parseGitHubSource(
    "https://github.com/owner/repo/blob/v1.2.0/extensions/demo/manifest.json",
  );
  assert.equal(blob.ref, "v1.2.0");
  assert.equal(blob.path, "extensions/demo");

  const raw = parseGitHubSource(
    "https://raw.githubusercontent.com/owner/repo/v1.2.0/extensions/demo/manifest.json",
  );
  assert.equal(raw.ref, "v1.2.0");
  assert.equal(raw.path, "extensions/demo");

  const rawFile = parseGitHubSource(
    "https://raw.githubusercontent.com/owner/repo/v1.2.0/extensions/demo/index.js",
  );
  assert.equal(rawFile.path, "extensions/demo");

  const git = parseGitHubSource("https://github.com/owner/repo.git");
  assert.equal(git.repo, "repo");

  const bareHost = parseGitHubSource("github.com/owner/repo");
  assert.equal(bareHost.owner, "owner");
  assert.equal(bareHost.repo, "repo");

  assert.throws(
    () => parseGitHubSource("https://gitlab.com/owner/repo"),
    (error) => error.code === "unsupportedSource",
  );
  assert.throws(
    () => parseGitHubSource("https://github.com/owner/repo/tree/main/foo%5Cbar"),
    (error) => error.code === "invalidUrl",
  );
  assert.throws(
    () => parseGitHubSource(""),
    (error) => error.code === "invalidUrl",
  );
});

const catalog = {
  schemaVersion: 1,
  name: "Test marketplace",
  extensions: [
    {
      id: "test.install",
      name: "Install",
      author: "Author",
      description: "A package",
      source: "owner/repo",
      path: "extensions/demo",
      ref: "main",
      tags: ["notes", "notes"],
    },
  ],
};

test("marketplace catalogs validate and expose source overrides", () => {
  const parsed = parseMarketplaceCatalog(JSON.stringify(catalog));
  assert.equal(parsed.name, "Test marketplace");
  assert.equal(parsed.extensions[0].id, "test.install");
  assert.deepEqual(parsed.extensions[0].tags, ["notes"]);
  const source = marketplaceSource(parsed.extensions[0]);
  assert.equal(source.ref, "main");
  assert.equal(source.path, "extensions/demo");
  assert.equal(source.canonicalUrl, "https://github.com/owner/repo/tree/main/extensions/demo");

  const duplicated = {
    ...catalog,
    extensions: [catalog.extensions[0], catalog.extensions[0]],
  };
  assert.throws(
    () => validateMarketplaceCatalog(duplicated),
    (error) => error.code === "marketplaceSchema",
  );

  const badSource = {
    ...catalog,
    extensions: [{ ...catalog.extensions[0], source: "https://gitlab.com/owner/repo" }],
  };
  assert.throws(
    () => validateMarketplaceCatalog(badSource),
    (error) => error.code === "marketplaceEntry",
  );

  assert.throws(
    () => validateMarketplaceCatalog({ ...catalog, schemaVersion: 2 }),
    (error) => error.code === "marketplaceSchema",
  );
  assert.throws(
    () => parseMarketplaceCatalog("{"),
    (error) => error.code === "marketplaceInvalid",
  );
});
