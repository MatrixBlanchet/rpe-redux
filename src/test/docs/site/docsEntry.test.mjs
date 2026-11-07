/** The Help page's extension-docs row: URL allowlist and opener seam. */
import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_SERVER_ORIGIN } from "../../../core/global/library/client.ts";
import {
  docsSiteUrl,
  isAllowedDocsUrl,
  openDocsSite,
  setDocsOpenerForTests,
} from "../../../core/platform/desktop/docsSite.ts";

test("the docs URL is the default service origin plus /docs/", () => {
  assert.equal(docsSiteUrl(), `${DEFAULT_SERVER_ORIGIN}/docs/`);
});

test("loopback docs URLs on the service port are accepted", () => {
  for (const url of [
    "http://127.0.0.1:47821/docs/",
    "http://127.0.0.1:47821/docs",
    "http://127.0.0.1:47821/docs/#/page/x",
    "http://127.0.0.1:47821/docs/guide/extensions.html",
  ]) {
    assert.equal(isAllowedDocsUrl(url), true, url);
  }
});

test("non-docs protocols, hosts, ports, and paths are rejected", () => {
  for (const url of [
    "https://example.com/docs/",
    "https://127.0.0.1:47821/docs/",
    "http://localhost:47821/docs/",
    "http://127.0.0.1:47822/docs/",
    "http://127.0.0.1:47821/apix",
    "http://127.0.0.1:47821/docs-evil",
    "http://127.0.0.1:47821/docs/../apix",
    "http://user@127.0.0.1:47821/docs/",
    "javascript:alert(1)",
    "file:///C:/docs/index.html",
    "",
  ]) {
    assert.equal(isAllowedDocsUrl(url), false, url);
  }
});

test("openDocsSite hands the exact docs URL to the injected opener", async () => {
  const received = [];
  setDocsOpenerForTests(async (url) => {
    received.push(url);
  });
  globalThis.__TAURI_INTERNALS__ = {};
  try {
    await openDocsSite();
  } finally {
    delete globalThis.__TAURI_INTERNALS__;
    setDocsOpenerForTests(null);
  }
  assert.deepEqual(received, [`${DEFAULT_SERVER_ORIGIN}/docs/`]);
});

test("openDocsSite wraps an opener failure so the row can report it", async () => {
  setDocsOpenerForTests(async () => {
    throw new Error("scope denied");
  });
  globalThis.__TAURI_INTERNALS__ = {};
  try {
    await assert.rejects(openDocsSite(), /The system opener failed: scope denied/u);
  } finally {
    delete globalThis.__TAURI_INTERNALS__;
    setDocsOpenerForTests(null);
  }
});
