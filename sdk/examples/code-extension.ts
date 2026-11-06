/**
 * SDK example in TypeScript: declares a script definition and a sandbox
 * activation against the published type surface, so authors have a compile
 * target for the same shape the host loads at runtime.
 */

import type {
  ExtensionScriptDefinition,
  TrustedExtensionContext,
  TrustedExtensionDefinition,
} from "@rpe-redux/extension-sdk";

const script: ExtensionScriptDefinition = {
  id: "hello",
  label: "Say hello",
  description: "Shows one notice; it changes no chart data.",
  steps: [{ op: "notice", message: { key: "notice.body" } }],
};

/** A trusted extension that registers one notice-only script. */
const definition: TrustedExtensionDefinition = {
  manifest: {
    id: "example.hello",
    name: "hello",
    version: "1.0.0",
    engines: { "rpe-redux": 1 },
    entry: "index.js",
    capabilities: ["scripts", "events"],
    author: "Example Author",
    license: "MIT",
    sourceUrl: "https://example.com/hello",
  },
  activate(context: TrustedExtensionContext) {
    context.events.on("document:opened", () => {
      // A host event; nothing here can outlive the extension scope.
    });
    context.scripts.register(script);
  },
};

export default definition;
