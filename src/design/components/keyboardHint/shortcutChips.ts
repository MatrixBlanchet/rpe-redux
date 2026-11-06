/**
 * Bindings as the key caps that draw them.
 *
 * This is the one place the shortcut model meets the design system: a value
 * becomes `KbdStroke` props here, and `MOD` is resolved into whichever modifier
 * this platform calls primary. `core` never learns what a chip looks like.
 */
import type { Shortcut } from "../../../core/shortcuts/types.ts";
import { formatKeyToken } from "../../../core/shortcuts/keys.ts";
import { isApplePlatform } from "../../../core/platform/environment.ts";
import type { KbdStroke } from "./Kbd.tsx";

/** Resolve shortcut bindings into per-platform key-cap props. */
export function shortcutChips(shortcuts: readonly Shortcut[]): KbdStroke[] {
  const apple = isApplePlatform();
  return shortcuts.map((shortcut) => {
    const modifiers = shortcut.modifiers ?? [];
    const mod = modifiers.includes("MOD");
    return {
      ctrl: modifiers.includes("CTRL") || (mod && !apple),
      alt: modifiers.includes("ALT"),
      shift: modifiers.includes("SHIFT"),
      meta: modifiers.includes("META") || (mod && apple),
      keyLabel: formatKeyToken(shortcut.key),
    };
  });
}
