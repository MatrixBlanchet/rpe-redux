/**
 * Compiles the design stylesheet manifest without writing an artifact.
 *
 * The style-rule checker validates values; this gate validates that the Less
 * graph itself is well-formed before Vite or a desktop build reaches it.
 */
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import less from "less";

const root = resolve(import.meta.dirname, "..");
const entry = resolve(root, "src/design/styles/index.less");

try {
  const source = await readFile(entry, "utf8");
  await less.render(source, {
    filename: entry,
    javascriptEnabled: false,
  });
  console.log("PASS styles: Less manifest compiles");
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`FAIL styles: Less manifest does not compile\n${message}`);
  process.exitCode = 1;
}
