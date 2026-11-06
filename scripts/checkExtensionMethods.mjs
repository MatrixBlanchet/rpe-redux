/**
 * Static consistency check for the Extension method registry.
 *
 * `gateExtensionApi` grants a fixed set of facade handles. The registry in
 * `src/core/extensions/methodRegistry.ts` has to describe exactly those
 * handles, every entry must name a capability from the runtime vocabulary, and
 * no entry may register the retired `host.patch` name or another universal
 * entry point.
 *
 * Usage:
 *   node scripts/checkExtensionMethods.mjs
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { isExtensionCapability } from "../src/core/extensions/capabilities.ts";
import { EXTENSION_METHODS, methodKey } from "../src/core/extensions/methodRegistry.ts";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const GATE_PATH = join(ROOT, "src", "core", "extensions", "capabilityGate.ts");
const ALLOW_PATTERN = /\ballow\(\s*"([^"]+)"/gu;

/** Read the handle names passed to the gate's `allow` helper. */
function allowedHandles() {
  const source = readFileSync(GATE_PATH, "utf8");
  return new Set([...source.matchAll(ALLOW_PATTERN)].map((match) => match[1]));
}

/** Report the differences between two handle sets. */
function describeDiff(expected, actual, expectedLabel, actualLabel) {
  const missing = [...expected].filter((handle) => !actual.has(handle)).sort();
  const extra = [...actual].filter((handle) => !expected.has(handle)).sort();
  return [
    ...missing.map((handle) => `missing from ${actualLabel}: ${handle}`),
    ...extra.map((handle) => `missing from ${expectedLabel}: ${handle}`),
  ];
}

/** Run every static check and exit non-zero on the first failing batch. */
function main() {
  const failures = [];
  const allowed = allowedHandles();
  const facadeEntries = EXTENSION_METHODS.filter((entry) => entry.handle !== "");
  const registered = new Set(facadeEntries.map((entry) => entry.handle));

  if (allowed.size === 0) {
    failures.push(`no allow("handle", ...) calls found in ${GATE_PATH}`);
  }
  failures.push(...describeDiff(allowed, registered, "capabilityGate.ts", "methodRegistry.ts"));

  const keys = new Set();
  for (const entry of EXTENSION_METHODS) {
    const key = methodKey(entry.handle, entry.method);
    if (keys.has(key)) {
      failures.push(`duplicate registration: ${key}`);
    }
    keys.add(key);
    if (!isExtensionCapability(entry.capability)) {
      failures.push(`unknown capability: ${key} -> ${entry.capability}`);
    }
    if (entry.capability === "host.patch") {
      failures.push(`retired capability registered: ${key}`);
    }
  }

  if (failures.length > 0) {
    console.error("Extension method registry check failed:");
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log(
    `Extension method registry covers ${allowed.size} facade handles ` +
      `(${facadeEntries.length} facade methods, ${EXTENSION_METHODS.length - facadeEntries.length} context methods).`,
  );
}

main();
