/** App-session prompts that invite a GitHub star and collect product feedback. */
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { editorPlaying } from "../../core/edit/state/publishedValues.ts";
import { PREFERENCE_SECTIONS, preferences } from "../../core/state/preferences.ts";
import { isRecord } from "../../core/utils/guards.ts";
import { openExternalUrl } from "../../core/platform/desktop/openExternal.ts";
import { HELP_SURVEY_URL } from "../../core/platform/desktop/helpLinks.ts";
import { t } from "../../i18n/index.ts";
import { requestChoice, showNotice } from "./modals/prompts.ts";
import { dueSessionPrompt, type SessionPromptKind } from "./sessionPromptState.ts";

const GITHUB_URL = "https://github.com/seacblue/rpe-redux";

const NEVER_REMIND_KEYS = Object.freeze({
  star: "session-prompt.github-star.never",
  feedback: "session-prompt.feedback.never",
});

type PromptChoice = "go" | "later" | "never";

const PROMPT_CHOICES: readonly PromptChoice[] = ["go", "later", "never"];

/** Returns the durable values section, treating malformed data as empty. */
function storedValues(): Record<string, unknown> {
  const values = preferences.read<unknown>(PREFERENCE_SECTIONS.values, null);
  return isRecord(values) ? values : {};
}

/** Whether the user permanently dismissed one session prompt. */
function neverRemind(kind: SessionPromptKind): boolean {
  return storedValues()[NEVER_REMIND_KEYS[kind]] === true;
}

/** Persists the user's lifetime opt-out without disturbing other value entries. */
function rememberNeverRemind(kind: SessionPromptKind): void {
  preferences.write(PREFERENCE_SECTIONS.values, {
    ...storedValues(),
    [NEVER_REMIND_KEYS[kind]]: true,
  });
}

/** Describes one session prompt without coupling the scheduler to its copy. */
function promptDefinition(kind: SessionPromptKind): {
  title: string;
  description: string;
  openLabel: string;
  url: string;
} {
  if (kind === "star") {
    return {
      title: t("chrome.sessionPrompt.star.title"),
      description: t("chrome.sessionPrompt.star.description"),
      openLabel: t("chrome.sessionPrompt.action.openGithub"),
      url: GITHUB_URL,
    };
  }
  return {
    title: t("chrome.sessionPrompt.feedback.title"),
    description: t("chrome.sessionPrompt.feedback.description"),
    openLabel: t("chrome.sessionPrompt.action.openSurvey"),
    url: HELP_SURVEY_URL,
  };
}

/** Opens one trusted destination and reports opener failures in the shared prompt surface. */
function openPromptDestination(kind: SessionPromptKind): void {
  const definition = promptDefinition(kind);
  void openExternalUrl(definition.url).catch(() => {
    showNotice({
      title: t("chrome.sessionPrompt.openFailed.title"),
      description: t("chrome.sessionPrompt.openFailed.description"),
    });
  });
}

/** Presents one session prompt and records only the lifetime opt-out choice. */
async function presentSessionPrompt(kind: SessionPromptKind): Promise<void> {
  const definition = promptDefinition(kind);
  const choice = await requestChoice({
    title: definition.title,
    description: definition.description,
    entries: PROMPT_CHOICES,
    label: (value) => {
      switch (value) {
        case "go":
          return definition.openLabel;
        case "later":
          return t("chrome.sessionPrompt.action.later");
        case "never":
          return t("chrome.sessionPrompt.action.never");
      }
    },
  });
  if (choice === "never") {
    rememberNeverRemind(kind);
  } else if (choice === "go") {
    openPromptDestination(kind);
  }
}

/** Coordinates one prompt per pause and one presentation per prompt per app session. */
export function SessionPrompts() {
  const playing = useSyncExternalStore(
    editorPlaying.subscribe,
    editorPlaying.get,
    editorPlaying.get,
  );
  const [startedAt] = useState(() => Date.now());
  const previousPlaying = useRef(playing);
  const shown = useRef<Record<SessionPromptKind, boolean>>({ star: false, feedback: false });
  const presenting = useRef(false);

  useEffect(() => {
    if (previousPlaying.current && !playing && !presenting.current) {
      const kind = dueSessionPrompt(Date.now() - startedAt, shown.current, neverRemind);
      if (kind) {
        shown.current[kind] = true;
        presenting.current = true;
        void presentSessionPrompt(kind).finally(() => {
          presenting.current = false;
        });
      }
    }
    previousPlaying.current = playing;
  }, [playing, startedAt]);

  // This component owns no visible DOM; the shared modal queue renders the prompt.
  return null;
}
