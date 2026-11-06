/** Session prompt timing keeps the one-hour/two-hour order and one-per-pause rule. */
import assert from "node:assert/strict";
import test from "node:test";
import {
  dueSessionPrompt,
  SESSION_PROMPT_DELAYS,
} from "../frontend/overlays/sessionPromptState.ts";

const noneSuppressed = () => false;
const shown = (overrides = {}) => ({ star: false, feedback: false, ...overrides });

test("the star prompt becomes due after one hour", () => {
  assert.equal(dueSessionPrompt(SESSION_PROMPT_DELAYS.star, shown(), noneSuppressed), "star");
  assert.equal(dueSessionPrompt(SESSION_PROMPT_DELAYS.star - 1, shown(), noneSuppressed), null);
});

test("the feedback prompt follows the star prompt after two hours", () => {
  assert.equal(
    dueSessionPrompt(SESSION_PROMPT_DELAYS.feedback, shown({ star: true }), noneSuppressed),
    "feedback",
  );
});

test("one pause presents only one prompt and permanent opt-outs are skipped", () => {
  assert.equal(dueSessionPrompt(SESSION_PROMPT_DELAYS.feedback, shown(), noneSuppressed), "star");
  assert.equal(
    dueSessionPrompt(SESSION_PROMPT_DELAYS.feedback, shown({ star: true }), () => true),
    null,
  );
  assert.equal(
    dueSessionPrompt(
      SESSION_PROMPT_DELAYS.feedback,
      shown({ star: true }),
      (kind) => kind === "feedback",
    ),
    null,
  );
});
