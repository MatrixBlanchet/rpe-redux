/** Coordinates an explicit response to an already observed direct disk change. */

export type DiskChangeAction = "reload" | "retain" | "save-as";

export interface DiskChangeResolutionRequest {
  readonly snapshot: string | null;
  readonly dirty: boolean;
  readonly chartFingerprint: string | null;
  readonly generation: number;
  readonly action: DiskChangeAction;
}

export interface DiskChangeRevision {
  readonly chartFingerprint: string | null;
  readonly generation: number;
}

export interface DiskChangeResolutionHost {
  isDirty(): boolean;
  revision(): DiskChangeRevision;
  readDiskSnapshot(): Promise<string | null>;
  reloadFromDisk(expected: {
    readonly chartFingerprint: string | null;
    readonly diskSnapshot: string | null;
    readonly generation: number;
  }): Promise<void>;
  retainLocal(): Promise<void> | void;
  saveAs(): Promise<void>;
}

export type DiskChangeResolution =
  | { readonly status: "reloaded"; readonly snapshot: string | null }
  | { readonly status: "retained"; readonly snapshot: string | null }
  | { readonly status: "saved-as"; readonly snapshot: string | null }
  | {
      readonly status: "stale";
      readonly reason:
        | "disk_snapshot_changed"
        | "dirty_state_changed"
        | "chart_fingerprint_changed"
        | "generation_changed";
      readonly observedSnapshot: string | null;
      readonly currentSnapshot: string | null;
    }
  | {
      readonly status: "invalid_action";
      readonly action: DiskChangeAction;
      readonly dirty: boolean;
    }
  | { readonly status: "failed"; readonly error: unknown };

/** Builds a resolver that revalidates disk, dirty, and revision state before acting. */
export function createDiskChangeResolver(host: DiskChangeResolutionHost) {
  /** Applies one explicit disk-change action, or reports why it is stale. */
  const resolve = async (request: DiskChangeResolutionRequest): Promise<DiskChangeResolution> => {
    if (request.action === "save-as" && !request.dirty) {
      return { status: "invalid_action", action: request.action, dirty: request.dirty };
    }

    const currentSnapshot = await host.readDiskSnapshot();
    if (currentSnapshot !== request.snapshot) {
      return {
        status: "stale",
        reason: "disk_snapshot_changed",
        observedSnapshot: request.snapshot,
        currentSnapshot,
      };
    }
    if (host.isDirty() !== request.dirty) {
      return {
        status: "stale",
        reason: "dirty_state_changed",
        observedSnapshot: request.snapshot,
        currentSnapshot,
      };
    }
    const revision = host.revision();
    if (revision.chartFingerprint !== request.chartFingerprint) {
      return {
        status: "stale",
        reason: "chart_fingerprint_changed",
        observedSnapshot: request.snapshot,
        currentSnapshot,
      };
    }
    if (revision.generation !== request.generation) {
      return {
        status: "stale",
        reason: "generation_changed",
        observedSnapshot: request.snapshot,
        currentSnapshot,
      };
    }

    try {
      if (request.action === "reload") {
        await host.reloadFromDisk({
          chartFingerprint: request.chartFingerprint,
          diskSnapshot: request.snapshot,
          generation: request.generation,
        });
        return { status: "reloaded", snapshot: request.snapshot };
      }
      if (request.action === "retain") {
        await host.retainLocal();
        return { status: "retained", snapshot: request.snapshot };
      }
      await host.saveAs();
      return { status: "saved-as", snapshot: request.snapshot };
    } catch (error) {
      return { status: "failed", error };
    }
  };

  return { resolve };
}

export type DiskChangeResolver = ReturnType<typeof createDiskChangeResolver>;
