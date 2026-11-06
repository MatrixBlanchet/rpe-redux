/**
 * Build modes for `npm run build`, kept out of the build script so the accepted
 * flags, their conflicts, and the help text can be unit-tested and read in one
 * place.
 *
 * The contract is deliberately small: one output mode (`--debug` or
 * `--portable`) plus one optional compiler profile (`--fast`). Anything else is
 * rejected rather than silently ignored.
 */

/** Flags that select the build output. At most one may be present. */
export const OUTPUT_FLAGS = Object.freeze(["--debug", "--portable"]);

/** The optional release compiler profile. */
export const PROFILE_FLAGS = Object.freeze(["--fast"]);

/** The help text printed by `npm run build -- --help`. */
export const BUILD_HELP = `Usage: npm run build -- [flags]

Build the desktop application. No flag produces the release installer and the
staged portable folder.

  --debug      Debug executable without an installer, for smoke tests.
  --portable   Staged portable folder without an installer.
  --fast       Thin LTO and parallel codegen; release-shaped, not for publishing.
  --help, -h   Show this help.

--debug cannot be combined with --portable or --fast.
`;

/**
 * Parse the arguments after `npm run build --`.
 *
 * @returns `{ help: true }` when help was requested, otherwise the selected
 * output mode and whether the fast release profile is active.
 * @throws when a flag is unknown or two output flags are combined.
 */
export function parseBuildFlags(argv) {
  const args = [...argv];
  if (args.includes("--help") || args.includes("-h")) {
    return { help: true };
  }

  const unknown = args.find(
    (argument) => !OUTPUT_FLAGS.includes(argument) && !PROFILE_FLAGS.includes(argument),
  );
  if (unknown) {
    throw new Error(`Unknown build flag: ${unknown}. Use --debug, --portable, --fast, or --help.`);
  }

  const outputs = OUTPUT_FLAGS.filter((flag) => args.includes(flag));
  if (outputs.length > 1) {
    throw new Error("--debug and --portable cannot be used together.");
  }
  const fast = args.includes("--fast");
  if (fast && outputs.includes("--debug")) {
    throw new Error("--debug and --fast cannot be used together.");
  }

  return {
    help: false,
    mode: outputs[0] === "--debug" ? "debug" : outputs[0] === "--portable" ? "portable" : "release",
    fast,
  };
}
