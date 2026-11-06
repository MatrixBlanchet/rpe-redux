/**
 * Extension style sheets stay inside the package's own mounted surfaces.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { extensionRuntime } from "../../../core/extensions/extensionRuntime.ts";
import { installExtensionStyleHost } from "../../../frontend/platform/extensionStyleHost.ts";
import { scopedExtensionCss } from "../../../frontend/platform/extensionStyleScope.ts";

test("extension CSS is wrapped in the owner's mount scope", () => {
  const css = ".card { color: var(--accent); }";
  const scoped = scopedExtensionCss("builtin.official", css);
  assert.match(scoped, /^@scope \(\[data-redux-extension-scope="builtin\.official"\]\) \{/);
  assert.ok(scoped.includes(css));
  assert.match(scoped, /\}$/);
});

test("the scope selector is quoted so an owner cannot break the at-rule", () => {
  const scoped = scopedExtensionCss('bad"owner', ".card { color: red; }");
  assert.match(scoped, /data-redux-extension-scope="bad\\"owner"/);
});

test("a closing brace cannot end the owner scope early", () => {
  assert.throws(
    () =>
      scopedExtensionCss(
        "builtin.official",
        ".card { color: red; } } .titlebar { display: none; }",
      ),
    /closes its owner scope/,
  );
});

test("unbalanced blocks and unterminated tokens are rejected", () => {
  assert.throws(() => scopedExtensionCss("owner", ".card { color: red;"), /unbalanced braces/);
  assert.throws(() => scopedExtensionCss("owner", '.card { content: "abc;'), /unterminated string/);
  assert.throws(
    () => scopedExtensionCss("owner", ".card { color: red; } /* note"),
    /unterminated comment/,
  );
});

test("constructs that load or re-scope host presentation are rejected", () => {
  for (const css of [
    "@import url(https://example.test/host.css);",
    ".card { background: url(https://example.test/pixel); }",
    ":root { --accent: red; }",
    ":host { display: none; }",
    "@scope (.titlebar) { * { display: none; } }",
  ]) {
    assert.throws(() => scopedExtensionCss("owner", css), /forbidden construct/, css);
  }
});

test("global selectors that reach the document are rejected", () => {
  for (const css of [
    "html { display: none; }",
    "body { display: none; }",
    ".card, body { display: none; }",
    "html.dark { display: none; }",
    "body[data-theme] { display: none; }",
    ":is(body) { display: none; }",
    "* { display: none; }",
    ".card > * { display: none; }",
  ]) {
    assert.throws(() => scopedExtensionCss("owner", css), /forbidden global selector/, css);
  }
});

test("nested scope at-rules are rejected at any depth", () => {
  assert.throws(
    () =>
      scopedExtensionCss(
        "owner",
        "@media (min-width: 1px) { @scope (.titlebar) { * { display: none; } } }",
      ),
    /forbidden construct/,
  );
});

test("scoped selectors and declaration values that mention document words stay valid", () => {
  const css = [
    ".body { color: red; }",
    "#body { color: red; }",
    "[data-body] { color: red; }",
    ":not(.body) { color: red; }",
    ".card { font-family: body; }",
    '.card::after { content: "@font-face"; }',
    "/* @keyframes stays text here */",
    "@media (min-width: 10px) { .card { color: red; } }",
    "@font-feature-values Body { @styleset { body: 1; } }",
  ].join("\n");
  const scoped = scopedExtensionCss("owner", css);
  assert.ok(scoped.includes(css));
  assert.match(scoped, /\}$/);
});

test("document-global at-rules are rejected", () => {
  for (const css of [
    "@keyframes spin { from { opacity: 0; } to { opacity: 1; } }",
    "@-webkit-keyframes spin { from { opacity: 0; } }",
    "@-moz-keyframes spin { from { opacity: 0; } }",
    "@font-face { font-family: Evil; src: local('Arial'); }",
    "@property --evil { syntax: '*'; inherits: false; initial-value: red; }",
    "@counter-style evil { system: cyclic; symbols: '*'; }",
    "@page { margin: 1cm; }",
    "@media (min-width: 1px) { @keyframes spin { from { opacity: 0; } } }",
  ]) {
    assert.throws(() => scopedExtensionCss("owner", css), /document-global at-rule/, css);
  }
});

test("the host drops a rejected sheet and reports the failure", () => {
  const originalSetStyleHost = extensionRuntime.setStyleHost;
  const originalConsoleError = console.error;
  const reports = [];
  let host = null;
  extensionRuntime.setStyleHost = (value) => {
    host = value;
  };
  console.error = (...args) => {
    reports.push(args);
  };
  try {
    const uninstall = installExtensionStyleHost();
    assert.ok(host, "the host did not receive a style sink");
    assert.throws(
      () => host.add(".card { color: red; } } .titlebar { display: none; }", "owner"),
      /closes its owner scope/,
    );
    assert.equal(reports.length, 1);
    uninstall();
    assert.equal(host, null);
  } finally {
    extensionRuntime.setStyleHost = originalSetStyleHost;
    console.error = originalConsoleError;
  }
});

test("braces inside strings and comments do not escape the scope", () => {
  const css = '.card::after { content: "}"; } /* } */ .card { color: red; }';
  const scoped = scopedExtensionCss("owner", css);
  assert.ok(scoped.includes(css));
  assert.match(scoped, /\}$/);
});
