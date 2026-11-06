// @ts-check
/**
 * Plain JavaScript is a supported authoring language: the SDK is types only, so
 * `// @ts-check` plus JSDoc gives the same editor feedback without a build step.
 *
 * @typedef {import("@rpe-redux/extension-sdk").TrustedExtensionDefinition} TrustedExtensionDefinition
 * @typedef {import("@rpe-redux/extension-sdk").TrustedExtensionContext} TrustedExtensionContext
 */

/** @type {TrustedExtensionDefinition} */
const definition = {
  manifest: {
    id: "example.plain-js",
    name: "plain-js",
    version: "1.0.0",
    engines: { "rpe-redux": 1 },
    entry: "index.js",
    capabilities: ["scripts"],
  },
  /** @param {TrustedExtensionContext} context */
  activate(context) {
    context.scripts.register({
      id: "plain",
      label: "Plain JS",
      steps: [{ op: "notice", message: "Registered from plain JavaScript." }],
    });
  },
};

export default definition;
