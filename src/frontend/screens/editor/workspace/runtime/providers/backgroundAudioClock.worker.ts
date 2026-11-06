/** Signals the editor's audio scheduler while the document is hidden. */
const clock = self as unknown as {
  onmessage: ((event: MessageEvent<boolean>) => void) | null;
  postMessage(message: string): void;
};
let timer: ReturnType<typeof setInterval> | null = null;
clock.onmessage = ({ data }) => {
  if (timer !== null) {
    clearInterval(timer);
    timer = null;
  }
  if (data) {
    timer = setInterval(() => clock.postMessage("tick"), 50);
  }
};
