/** Pure state transitions for the optional keyboard-label overlay. */

/** How long a released key label remains visible before it is dropped. */
export const KEY_PRESS_LABEL_FADE_MS = 500;

/** The key currently shown, with its press and optional release timestamps. */
export interface KeyPressLabelState {
  readonly code: string;
  readonly label: string;
  readonly pressedAt: number;
  readonly releasedAt: number | null;
}

/** The key label currently shown, if any. */
export interface InputOverlayState {
  readonly key: KeyPressLabelState | null;
}

/** Which transient input overlays the settings enable. */
export interface InputOverlayEnabledState {
  readonly keyEnabled: boolean;
}

/** Creates the empty overlay state. */
export function createInputOverlayState(): InputOverlayState {
  return { key: null };
}

/** Records the pressed key, replacing the current one; empty keys keep the current state. */
export function pressKeyLabel(
  state: InputOverlayState,
  code: string,
  label: string,
  now: number,
): InputOverlayState {
  if (!code || !label) {
    return state;
  }
  return {
    ...state,
    key: { code, label, pressedAt: now, releasedAt: null },
  };
}

/** Marks the shown key released when it matches `code`; other keys are ignored. */
export function releaseKeyLabel(
  state: InputOverlayState,
  code: string,
  now: number,
): InputOverlayState {
  if (!state.key || state.key.code !== code || state.key.releasedAt !== null) {
    return state;
  }
  return { ...state, key: { ...state.key, releasedAt: now } };
}

/** Drops the label once it has faded, been released too long, or overlays are off. */
export function advanceInputOverlayState(
  state: InputOverlayState,
  now: number,
  enabled: InputOverlayEnabledState,
): InputOverlayState {
  const key =
    enabled.keyEnabled &&
    state.key &&
    (state.key.releasedAt === null || now - state.key.releasedAt <= KEY_PRESS_LABEL_FADE_MS)
      ? state.key
      : null;
  return { key };
}
