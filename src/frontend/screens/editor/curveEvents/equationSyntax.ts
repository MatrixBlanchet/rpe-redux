/**
 * Display tokens for the curve equation editor.
 *
 * Evaluation is owned by `core/utils/batchScript.ts`; this module classifies
 * the same surface syntax so the editor can color functions, constants,
 * variables, operators, numbers, and unknown names without changing what is
 * stored in the draft.
 */
import {
  BATCH_EXPRESSION_CONSTANT_NAMES,
  BATCH_EXPRESSION_FUNCTION_NAMES,
} from "../../../../core/utils/batchScript.ts";

/** Token categories the equation editor colors. */
export type EquationTokenKind =
  | "space"
  | "number"
  | "function"
  | "constant"
  | "variable"
  | "operator"
  | "punctuation"
  | "invalid";

/** One source slice and the category used to color it. */
export interface EquationToken {
  text: string;
  kind: EquationTokenKind;
}

/** Common functions offered by the modal palette, in display order. */
export const COMMON_EQUATION_FUNCTIONS = Object.freeze([
  "sin",
  "cos",
  "tan",
  "asin",
  "acos",
  "atan",
  "sqrt",
  "abs",
  "pow",
  "min",
  "max",
  "clamp",
  "lerp",
  "ease",
  "floor",
  "ceil",
  "round",
  "ln",
  "log",
  "exp",
  "sign",
  "mod",
] as const);

/** Variables and constants offered by the modal palette. */
export const EQUATION_VARIABLES = Object.freeze(["t", "u", "theta", "pi", "e", "tau"] as const);

const FUNCTION_NAMES = new Set(BATCH_EXPRESSION_FUNCTION_NAMES.map((name) => name.toLowerCase()));
const CONSTANT_NAMES = new Set(BATCH_EXPRESSION_CONSTANT_NAMES.map((name) => name.toLowerCase()));
const VARIABLE_NAMES = new Set(["t", "u", "theta", "seed", "randomness", "θ"]);
const OPERATORS = new Set([
  "+",
  "-",
  "*",
  "/",
  "%",
  "^",
  "**",
  "&&",
  "||",
  "==",
  "!=",
  "<",
  ">",
  "<=",
  ">=",
  "!",
  "?",
  ":",
  "×",
  "·",
  "÷",
  "−",
  "–",
  "≤",
  "≥",
  "≠",
  "²",
  "³",
  "⁴",
]);
const PUNCTUATION = new Set(["(", ")", ","]);

const TOKEN_PATTERN =
  /^(?:\s+|(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?|[A-Za-z_][A-Za-z_0-9]*(?:\.[A-Za-z_][A-Za-z_0-9]*)?|\*\*|&&|\|\||==|!=|<=|>=|[+\-*/%^<>()!,?:]|[×·÷−–≤≥≠²³⁴√πθ])/i;

/** Classify an identifier by function, constant, variable, or unknown. */
function classifyIdentifier(text: string): EquationTokenKind {
  const keyword = text.toLowerCase();
  if (FUNCTION_NAMES.has(keyword)) {
    return "function";
  }
  if (CONSTANT_NAMES.has(keyword)) {
    return "constant";
  }
  if (VARIABLE_NAMES.has(text)) {
    return "variable";
  }
  return "invalid";
}

/** Split one equation string into display tokens, preserving every character. */
export function tokenizeEquation(source: string): EquationToken[] {
  const tokens: EquationToken[] = [];
  let offset = 0;
  while (offset < source.length) {
    const match = TOKEN_PATTERN.exec(source.slice(offset));
    if (!match) {
      tokens.push({ text: source[offset], kind: "invalid" });
      offset += 1;
      continue;
    }
    const text = match[0];
    offset += text.length;
    if (/^\s+$/.test(text)) {
      tokens.push({ text, kind: "space" });
    } else if (/^(\d|\.)/.test(text)) {
      tokens.push({ text, kind: "number" });
    } else if (/^[A-Za-z_]/.test(text)) {
      tokens.push({ text, kind: classifyIdentifier(text) });
    } else if (OPERATORS.has(text)) {
      tokens.push({ text, kind: "operator" });
    } else if (PUNCTUATION.has(text)) {
      tokens.push({ text, kind: "punctuation" });
    } else if (text === "π") {
      tokens.push({ text, kind: "constant" });
    } else if (text === "θ") {
      tokens.push({ text, kind: "variable" });
    } else if (text === "√") {
      tokens.push({ text, kind: "function" });
    } else if (/^[²³⁴]$/.test(text)) {
      tokens.push({ text, kind: "operator" });
    } else {
      tokens.push({ text, kind: "invalid" });
    }
  }
  return tokens;
}

/** Whether any token would not resolve in the current equation vocabulary. */
export function equationHasInvalidTokens(tokens: readonly EquationToken[]): boolean {
  return tokens.some((token) => token.kind === "invalid");
}
