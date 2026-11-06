/** Validate the maintained internal documentation and its local links. */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DOCS_ROOT = join(ROOT, "docs");
const CJK = /[\p{Script=Han}]/u;
const EXTERNAL = /^(?:[a-z][a-z\d+.-]*:|\/\/)/iu;

/** Recursively collect Markdown files below a directory. */
function markdownFiles(directory) {
  if (!existsSync(directory)) {
    return [];
  }
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...markdownFiles(path));
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      files.push(path);
    }
  }
  return files;
}

/** Return the local path from a Markdown link, without its fragment. */
function localLink(rawTarget) {
  const target = rawTarget.trim().replace(/^<|>$/gu, "");
  if (!target || target.startsWith("#") || EXTERNAL.test(target)) {
    return null;
  }
  const path = target.split(/[?#]/u, 1)[0];
  return path ? decodeURIComponent(path) : null;
}

/** Check local links in one Markdown file. */
function checkLinks(file) {
  const source = readFileSync(file, "utf8");
  const failures = [];
  const pattern = /!?\[[^\]]*\]\(([^)]+)\)/gu;
  for (const match of source.matchAll(pattern)) {
    const target = localLink(match[1]);
    if (!target) {
      continue;
    }
    const resolved = resolve(dirname(file), target);
    if (!existsSync(resolved)) {
      failures.push(`${relative(ROOT, file)} -> ${target}`);
    }
  }
  return failures;
}

const files = markdownFiles(DOCS_ROOT);
const failures = [];
for (const file of files) {
  const name = relative(ROOT, file);
  const source = readFileSync(file, "utf8");
  if (!name.endsWith("-zh.md") && CJK.test(source)) {
    failures.push(`${name}: English internal documents must not contain Han characters`);
  }
  failures.push(...checkLinks(file));
}

const agentsDirectory = join(DOCS_ROOT, "agents");
if (existsSync(agentsDirectory) && readdirSync(agentsDirectory).length > 0) {
  failures.push("docs/agents: task coordination belongs in AGENTS.md or .scratch");
}
if (files.length === 0) {
  failures.push("docs: no maintained Markdown files found");
}

if (failures.length > 0) {
  console.error("Documentation check failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exitCode = 1;
} else {
  console.log(`Documentation check passed: ${files.length} internal Markdown files`);
}
