/**
 * Public SDK example: two package definitions compose through provider data,
 * a namespaced hook, and a versioned design slot without sharing host objects.
 */
import type { TrustedExtensionContext, TrustedExtensionDefinition } from "@rpe-redux/extension-sdk";

/** The provider package publishes a bounded snapshot and a hook. */
export const providerDefinition: TrustedExtensionDefinition = {
  manifest: {
    id: "example.summary-provider",
    name: "Summary provider",
    version: "1.0.0",
    engines: { "rpe-redux": 1 },
    entry: "index.js",
    capabilities: ["services", "hooks", "ui.panel"],
  },
  async activate(context: TrustedExtensionContext) {
    context.services.provideData({
      id: "example.summary",
      version: "1.0.0",
      initial: { count: 0 },
    });
    await context.services.updateData("example.summary", { count: 1 });
    context.hooks.register(
      "example.summary-provider:decorate",
      (payload) => ({ ...payload, source: "summary-provider" }),
      { fields: { label: { type: "string", required: true }, source: { type: "string" } } },
    );
    context.ui.registerDesignPanel({
      id: "summary-provider-status",
      slot: "inspector.panel",
      component: {
        type: "text",
        version: 1,
        props: { id: "status", text: "Provider active", tone: "muted" },
      },
    });
  },
};

/** The consumer package recomputes only when the provider epoch changes. */
export const consumerDefinition: TrustedExtensionDefinition = {
  manifest: {
    id: "example.summary-consumer",
    name: "Summary consumer",
    version: "1.0.0",
    engines: { "rpe-redux": 1 },
    entry: "index.js",
    capabilities: ["services", "hooks"],
  },
  async activate(context: TrustedExtensionContext) {
    const current = await context.services.readData<{ count: number }>("example.summary", "1.0.0");
    if (current) {
      await recompute(context, current.epoch, current.value.count);
    }
    context.services.onDataChange<{ count: number }>("example.summary", (next) => {
      if (next) {
        void recompute(context, next.epoch, next.value.count);
      }
    });
    await context.hooks.invoke("example.summary-provider:decorate", { label: "Count" });
  },
};

/** A consumer recomputation captures the epoch it used for its result. */
async function recompute(context: TrustedExtensionContext, epoch: number, count: number) {
  await context.hooks.invoke("example.summary-provider:decorate", {
    label: `Count: ${count} (epoch ${epoch})`,
  });
}
