/**
 * A one-slot bridge so the update store can ask for the changelog without
 * importing the React surface. The Help action registers the real opener when
 * the shell starts; the store only calls it after a completed update.
 */
/** The current opener, or null before the Help surface registers. */
let launch: (() => void) | null = null;
/** A request made before an opener existed. */
let pending = false;

/** Register the changelog opener; returns the disposer. */
export function bindChangelogLauncher(opener: () => void): () => void {
  launch = opener;
  if (pending) {
    pending = false;
    opener();
  }
  return () => {
    if (launch === opener) {
      launch = null;
    }
  };
}

/** Ask for the changelog now, or as soon as an opener is registered. */
export function requestChangelog(): void {
  if (launch) {
    launch();
  } else {
    pending = true;
  }
}
