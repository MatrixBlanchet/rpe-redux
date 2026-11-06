/**
 * Chooses when the note-source notice appears for a hovered note and which
 * texture source it reports.
 *
 * The notice itself is a row in the shared toast stack; this controller owns
 * only the hover delay and dismissal policy.
 */
import { showStickyToast, type ToastHandle } from "../../../../../../design/patterns/ToastHost.tsx";

/** Identifies the hovered note by its line and index. */
export interface NoteHoverEntry {
  lineIndex: number;
  index: number;
}

/** Owns the delayed note-source hover policy and publishes one shared toast. */
export class NoteSourceToastController {
  private timer: ReturnType<typeof setTimeout> | undefined;
  private key: string | null = null;
  private toast: ToastHandle | null = null;
  private readonly options: {
    enabled(): boolean;
    atHome(): boolean;
    multiLineActive(): boolean;
    lineExists(lineIndex: number): boolean;
    textForLine(lineIndex: number): string;
    invalidate(): void;
  };

  /** Stores the policy callbacks the hover flow reads. */
  constructor(options: NoteSourceToastController["options"]) {
    this.options = options;
  }

  /** Cancels the pending delay and dismisses any visible notice. */
  clear(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
    this.key = null;
    if (this.toast) {
      this.toast.dismiss();
      this.toast = null;
    }
  }

  /** Dismisses the notice from the UI and requests a repaint. */
  dismiss = (): void => {
    this.clear();
    this.options.invalidate();
  };

  /** Arms the delayed notice for a hovered note, or clears it when the note is not eligible. */
  hover(entry: NoteHoverEntry | null | undefined): void {
    clearTimeout(this.timer);
    this.timer = undefined;
    if (
      !this.options.enabled() ||
      !entry ||
      this.options.atHome() ||
      this.options.multiLineActive()
    ) {
      this.clear();
      return;
    }

    const key = `${entry.lineIndex}:${entry.index}`;
    if (key === this.key && this.toast) {
      return;
    }
    this.key = key;
    this.clear();
    this.key = key;
    this.timer = setTimeout(() => {
      if (this.key !== key) {
        return;
      }
      if (!this.options.lineExists(entry.lineIndex)) {
        return;
      }
      this.toast = showStickyToast({
        message: this.options.textForLine(entry.lineIndex),
        level: "info",
        duration: 0,
        onDismiss: (id) => {
          if (this.toast?.id === id) {
            this.toast = null;
          }
        },
      });
    }, 1000);
  }

  /** Releases the timer and notice without notifying the host. */
  dispose(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
    this.key = null;
    if (this.toast) {
      this.toast.dismiss();
      this.toast = null;
    }
  }
}
