/**
 * The React binding.
 *
 * A component that renders text calls `useTranslation()`, which subscribes it to
 * the language store: switching language repaints the React shell without a
 * reload, while the imperative editor is notified through the same subscription
 * and re-applies the labels it owns.
 *
 * This module adapts the translation store to React; the rest of `i18n/`
 * remains independent of the rendering framework.
 */
import { useMemo, useSyncExternalStore } from "react";
import { getLanguage, onLanguageChange, plural, t, tRaw } from "./index.ts";
import type { Language } from "./locale.ts";
import type { MessageKey, MessageParams } from "./index.ts";

export interface Translator {
  /** The language these strings are rendered in. */
  language: Language;
  t: (key: MessageKey, params?: MessageParams) => string;
  /** `t()` for a key assembled at runtime; see `index.ts`. */
  tRaw: (key: string, params?: MessageParams) => string;
  /** `one`/`other` selection for a countable noun. */
  plural: (base: string, count: number, params?: MessageParams) => string;
}

const subscribe = (listener: () => void) => onLanguageChange(listener);
const snapshot = () => getLanguage();

/**
 * Re-renders the calling component when the language changes.
 *
 * Components that only *pass* translated strings down can call this and stay
 * dumb; components that also render text use `useTranslation`.
 */
export function useLanguage(): Language {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

/** Translator bound to the active language; re-renders when the language changes. */
export function useTranslation(): Translator {
  const language = useLanguage();
  return useMemo(() => ({ language, t, tRaw, plural }), [language]);
}
