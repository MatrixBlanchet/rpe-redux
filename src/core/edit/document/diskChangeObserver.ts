/**
 * Turns native filesystem notifications into debounced document observations.
 *
 * The observer only probes content and reports a changed snapshot to the
 * document coordinator; it never reloads a chart, and an observation that
 * belongs to an older document generation is discarded as stale.
 */
import type {
  ChangeResult,
  DocumentChangeCoordinator,
  DocumentCoordinationState,
} from "./changeCoordinator.ts";

/** The native or test-owned source of filesystem activity for one document. */
export interface DiskChangeEventSource {
  subscribe(listener: () => void): (() => void) | Promise<() => void>;
}

/** Reads the content fingerprint for the document currently being watched. */
export type DiskProbe = () => Promise<string | null>;

export type DiskObservation =
  | {
      readonly status: "unchanged" | "self-write" | "external-pending" | "conflict" | "deferred";
      readonly snapshot: string | null;
      readonly state: DocumentCoordinationState;
      readonly result?: ChangeResult<void>;
    }
  | {
      readonly status: "probe-failed";
      readonly error: unknown;
      readonly state: DocumentCoordinationState;
    }
  | {
      readonly status: "stale";
      readonly requestedGeneration: number;
      readonly currentGeneration: number;
      readonly state: DocumentCoordinationState;
    };

export interface DiskChangeObserverOptions {
  readonly coordinator: Pick<DocumentChangeCoordinator, "snapshot" | "subscribe" | "observeDisk">;
  readonly events: DiskChangeEventSource;
  readonly probe: DiskProbe;
  readonly debounceMs?: number;
  readonly onObservation?: (observation: DiskObservation) => void;
}

const DEFAULT_DEBOUNCE_MS = 180;

/**
 * Turns noisy native filesystem events into serialized document observations.
 *
 * The observer never reloads a document. It only probes the on-disk content and
 * admits a changed snapshot through the document coordinator, leaving the
 * owning document flow to decide whether and how to reload it.
 */
export function createDiskChangeObserver(options: DiskChangeObserverOptions) {
  const debounceMs = Math.max(0, options.debounceMs ?? DEFAULT_DEBOUNCE_MS);
  const selfWrites = new Set<string | null>();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let unsubscribe: (() => void) | undefined;
  let coordinatorUnsubscribe: (() => void) | undefined;
  let startPromise: Promise<void> | undefined;
  let scanPromise: Promise<DiskObservation> | undefined;
  let scanAgain = false;
  let deferredScan = false;
  let disposed = false;

  /** Reports an observation unless the observer is disposed. */
  const publish = (observation: DiskObservation): DiskObservation => {
    if (!disposed) {
      options.onObservation?.(observation);
    }
    return observation;
  };

  /** Probes disk content and classifies it against the coordinator state. */
  const scan = async (): Promise<DiskObservation> => {
    const before = options.coordinator.snapshot();
    if (before.operation === "saving") {
      deferredScan = true;
      return {
        status: "deferred",
        snapshot: null,
        state: before,
      };
    }
    let snapshot: string | null;
    try {
      snapshot = await options.probe();
    } catch (error) {
      return publish({ status: "probe-failed", error, state: options.coordinator.snapshot() });
    }

    const current = options.coordinator.snapshot();
    if (current.revisions.generation !== before.revisions.generation) {
      return publish({
        status: "stale",
        requestedGeneration: before.revisions.generation,
        currentGeneration: current.revisions.generation,
        state: current,
      });
    }
    if (selfWrites.delete(snapshot)) {
      return publish({ status: "self-write", snapshot, state: current });
    }
    if (snapshot === current.revisions.diskSnapshot) {
      return publish({ status: "unchanged", snapshot, state: current });
    }

    const result = await options.coordinator.observeDisk(snapshot);
    if (result.status === "stale") {
      return publish({
        status: "stale",
        requestedGeneration: result.requestedGeneration,
        currentGeneration: result.currentGeneration,
        state: result.state,
      });
    }
    if (result.status !== "accepted") {
      return publish({ status: "probe-failed", error: result, state: result.state });
    }
    return publish({
      status: result.state.source === "conflict" ? "conflict" : "external-pending",
      snapshot,
      state: result.state,
      result,
    });
  };

  /** Runs one scan, coalescing requests that arrive while it is in flight. */
  const requestRescan = (): Promise<DiskObservation> => {
    if (disposed) {
      return Promise.resolve({
        status: "stale",
        requestedGeneration: options.coordinator.snapshot().revisions.generation,
        currentGeneration: options.coordinator.snapshot().revisions.generation,
        state: options.coordinator.snapshot(),
      });
    }
    if (scanPromise) {
      scanAgain = true;
      return scanPromise;
    }
    scanPromise = scan().finally(() => {
      scanPromise = undefined;
      if (scanAgain && !disposed) {
        scanAgain = false;
        void requestRescan();
      }
    });
    return scanPromise;
  };

  /** Debounces native events into a single rescan. */
  const scheduleRescan = (): void => {
    if (disposed) {
      return;
    }
    if (timer !== undefined) {
      clearTimeout(timer);
    }
    timer = setTimeout(() => {
      timer = undefined;
      void requestRescan();
    }, debounceMs);
  };

  /** Subscribes to file events and deferred-save completion; idempotent. */
  const start = async (): Promise<void> => {
    if (disposed) {
      return;
    }
    if (startPromise) {
      return startPromise;
    }
    const stopCoordinator = options.coordinator.subscribe((state) => {
      if (state.operation !== "saving" && deferredScan && !disposed) {
        deferredScan = false;
        scheduleRescan();
      }
    });
    startPromise = Promise.resolve(options.events.subscribe(scheduleRescan)).then((stop) => {
      if (disposed) {
        stopCoordinator();
        stop();
      } else {
        unsubscribe = stop;
        coordinatorUnsubscribe = stopCoordinator;
      }
    });
    return startPromise;
  };

  /** Stops subscriptions and timers and ignores later observations. */
  const dispose = (): void => {
    if (disposed) {
      return;
    }
    disposed = true;
    if (timer !== undefined) {
      clearTimeout(timer);
      timer = undefined;
    }
    unsubscribe?.();
    unsubscribe = undefined;
    coordinatorUnsubscribe?.();
    coordinatorUnsubscribe = undefined;
    selfWrites.clear();
  };

  return {
    start,
    rescan: requestRescan,
    markSelfWrite(snapshot: string | null): void {
      selfWrites.add(snapshot);
    },
    dispose,
  };
}

export type DiskChangeObserver = ReturnType<typeof createDiskChangeObserver>;
