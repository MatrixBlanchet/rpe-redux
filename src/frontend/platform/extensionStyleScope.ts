/**
 * Owner scope for Extension-authored style sheets.
 *
 * This is the one transform that turns a package sheet into presentation that
 * belongs only to its own panel or overlay mount. It is pure so the boundary can
 * be tested without a DOM. A sheet that can close the `@scope` block would
 * escape into the host chrome, so the transform rejects unbalanced blocks,
 * re-scoping constructs, and global selectors that target the document itself.
 * At-rules whose names are document-global (`@keyframes`, `@font-face`,
 * `@property`, `@counter-style`, `@page`) are rejected as well: a global name
 * would collide with the host or another package after the `@scope` wrapper.
 */

/** Constructs a package sheet may not use anywhere in the transformed text. */
const FORBIDDEN_SHEET = /(?:@import|@namespace|@scope|:root|:host|url\s*\()/i;

/** Document-global at-rules whose names escape the owner scope. */
const FORBIDDEN_GLOBAL_AT_RULE =
  /@(?:(?:-\w+-)?keyframes|font-face|property|counter-style|page)(?![\w-])/i;

/** Type selectors that address the host document instead of a package mount. */
const GLOBAL_TYPE_SELECTOR = /(?:^|[>+~,\s(|&])(?:html|body)(?=$|[>+~,\s.#:[)\]&])/i;

/** Universal selector, except the `*=` attribute operator. */
const UNIVERSAL_SELECTOR = /(?:^|[>+~,\s(|&])\*(?!\s*=)/;

/** Allowed at-rules whose block holds declarations, never selectors. */
const DECLARATION_AT_RULES = new Set([
  "color-profile",
  "font-feature-values",
  "font-palette-values",
  "viewport",
  "-ms-viewport",
]);

/** Whether a block opens style rules, declarations, or a declaration at-rule. */
type BlockKind = "root" | "group" | "style" | "declarations";

/**
 * Wrap a package sheet in the owner scope the host mounts expose.
 *
 * Throws when the sheet can escape the scope: an unmatched `}`, an unterminated
 * string or comment, a re-scoping or document-global at-rule, or a selector that
 * targets the host document. Balanced rules such as `@media` remain valid, and
 * braces inside strings or comments are ignored.
 */
export function scopedExtensionCss(owner: string, cssText: string): string {
  validateSheet(cssText);
  return `@scope ([data-redux-extension-scope=${JSON.stringify(owner)}]) {\n${cssText}\n}`;
}

/** Validates brace balance, forbidden constructs, and every style-rule prelude. */
function validateSheet(cssText: string): void {
  let depth = 0;
  let quote = "";
  let comment = false;
  let bare = "";
  for (let index = 0; index < cssText.length; index += 1) {
    const character = cssText[index];
    const next = cssText[index + 1];
    if (comment) {
      if (character === "*" && next === "/") {
        comment = false;
        index += 1;
      }
      bare += " ";
      continue;
    }
    if (quote) {
      if (character === "\\") {
        index += 1;
      } else if (character === quote) {
        quote = "";
      }
      bare += " ";
      continue;
    }
    if (character === "/" && next === "*") {
      comment = true;
      bare += " ";
      index += 1;
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
      bare += " ";
      continue;
    }
    if (character === "{") {
      depth += 1;
    } else if (character === "}") {
      depth -= 1;
      if (depth < 0) {
        throw new TypeError("Extension style sheet closes its owner scope");
      }
    }
    bare += character;
  }
  if (quote) {
    throw new TypeError("Extension style sheet has an unterminated string");
  }
  if (comment) {
    throw new TypeError("Extension style sheet has an unterminated comment");
  }
  if (depth !== 0) {
    throw new TypeError("Extension style sheet has unbalanced braces");
  }
  if (FORBIDDEN_SHEET.test(bare)) {
    throw new TypeError("Extension style sheet uses a forbidden construct");
  }
  if (FORBIDDEN_GLOBAL_AT_RULE.test(bare)) {
    throw new TypeError("Extension style sheet uses a document-global at-rule");
  }
  validateSelectors(bare);
}

/**
 * Walks rule blocks and rejects global selectors in every selector prelude.
 *
 * Declaration blocks and allowed descriptor at-rules are skipped, so a
 * property value such as `font-family: body` is not mistaken for a selector.
 */
function validateSelectors(bare: string): void {
  const blocks: BlockKind[] = ["root"];
  let preludeStart = 0;
  for (let index = 0; index < bare.length; index += 1) {
    const character = bare[index];
    if (character === ";") {
      preludeStart = index + 1;
      continue;
    }
    if (character === "}") {
      if (blocks.length > 1) {
        blocks.pop();
      }
      preludeStart = index + 1;
      continue;
    }
    if (character !== "{") {
      continue;
    }
    const prelude = bare.slice(preludeStart, index).trim();
    if (prelude.startsWith("@")) {
      const name = /^@([\w-]+)/.exec(prelude)?.[1]?.toLowerCase() ?? "";
      blocks.push(DECLARATION_AT_RULES.has(name) ? "declarations" : "group");
    } else {
      if (blocks.at(-1) !== "declarations") {
        validateSelector(prelude);
      }
      blocks.push("style");
    }
    preludeStart = index + 1;
  }
}

/** Rejects a selector list that reaches the document root or matches everything. */
function validateSelector(selector: string): void {
  if (GLOBAL_TYPE_SELECTOR.test(selector) || UNIVERSAL_SELECTOR.test(selector)) {
    throw new TypeError("Extension style sheet uses a forbidden global selector");
  }
}
