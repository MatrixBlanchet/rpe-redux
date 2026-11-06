/**
 * Runs the P0 smoke scenarios in grouped desktop sessions.
 *
 * Related journeys share one fresh session per product area. The group name
 * identifies the failing area, and each group starts from an isolated profile so
 * settings, extension fixtures, and input focus state do not leak between groups.
 *
 * Usage:
 *   npm run smoke                 run every group
 *   npm run smoke -- --scenario=settings
 *   npm run smoke -- --list
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { journeys } from "../src/test/e2e/journeyGroups.mjs";

const root = resolve(import.meta.dirname, "..");
const debugExecutable = join(
  root,
  "src-tauri",
  "target",
  "debug",
  process.platform === "win32" ? "rpe-redux.exe" : "rpe-redux",
);
const scenarios = Object.keys(journeys);
const args = process.argv.slice(2);

/** Read one `--name=value` argument, or `undefined` when it is absent. */
function argument(name) {
  const prefix = `${name}=`;
  return process.argv.find((entry) => entry.startsWith(prefix))?.slice(prefix.length);
}

if (args.includes("--help") || args.includes("-h")) {
  console.log("Smoke groups:\n" + scenarios.map((name) => `  ${name}`).join("\n"));
  console.log("\nUsage: npm run smoke [-- --scenario=<group>] [-- --list]");
  process.exit(0);
}
if (args.includes("--list")) {
  console.log(scenarios.join("\n"));
  process.exit(0);
}

const selected = argument("--scenario");
if (selected && !scenarios.includes(selected)) {
  console.error(`Unknown smoke group: ${selected}. Available: ${scenarios.join(", ")}`);
  process.exit(2);
}
if (!existsSync(debugExecutable)) {
  console.error(
    `Debug executable not found: ${debugExecutable}\nRun "npm run build -- --debug" first.`,
  );
  process.exit(2);
}

const failures = [];
for (const scenario of selected ? [selected] : scenarios) {
  console.log(`\n=== smoke:${scenario} ===`);
  const result = spawnSync(
    process.execPath,
    ["src/test/e2eJourneySmoke.mjs", `--scenario=${scenario}`],
    { cwd: root, stdio: "inherit" },
  );
  if (result.status !== 0) {
    failures.push(scenario);
  }
}

if (failures.length) {
  console.error(`\nFAIL smoke: ${failures.join(", ")}`);
  process.exitCode = 1;
} else {
  console.log(`\nPASS smoke: ${selected ? 1 : scenarios.length} session(s)`);
}
