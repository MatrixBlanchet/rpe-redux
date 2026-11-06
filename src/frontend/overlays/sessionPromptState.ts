/** Pure timing and ordering rules for the app-session prompts. */

export const SESSION_PROMPT_DELAYS = Object.freeze({
  star: 60 * 60 * 1000,
  feedback: 2 * 60 * 60 * 1000,
});

export type SessionPromptKind = keyof typeof SESSION_PROMPT_DELAYS;

/** Selects the first due prompt, showing at most one prompt for each pause. */
export function dueSessionPrompt(
  elapsedMs: number,
  shown: Readonly<Record<SessionPromptKind, boolean>>,
  neverRemind: (kind: SessionPromptKind) => boolean,
): SessionPromptKind | null {
  if (elapsedMs >= SESSION_PROMPT_DELAYS.star && !shown.star && !neverRemind("star")) {
    return "star";
  }
  if (elapsedMs >= SESSION_PROMPT_DELAYS.feedback && !shown.feedback && !neverRemind("feedback")) {
    return "feedback";
  }
  return null;
}
