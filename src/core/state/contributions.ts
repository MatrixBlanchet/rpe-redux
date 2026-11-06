/** Stable ordered snapshots and ownership-aware cleanup for feature registrations. */
export class Contributions<T extends { id: string; order: number }> {
  private entries = new Map<string, { entry: T; owner?: string }>();
  private listeners = new Set<() => void>();
  private snapshot: readonly T[] = [];
  /**
   * Takes one registration. `owner` is the registrar's name — a plugin id, or any
   * other tag — and is what `unregisterOwner` later removes in one call. An id is
   * registered once: a second `register` of the same id throws rather than
   * quietly replacing the first, so a plugin cannot take over a built-in action.
   */
  register(entry: T, owner?: string): () => void {
    this.assertFresh([entry]);
    const record = { entry, owner };
    this.entries.set(entry.id, record);
    this.changed();
    return () => {
      if (this.entries.get(entry.id) === record) {
        this.entries.delete(entry.id);
        this.changed();
      }
    };
  }
  /** Current entries in `order` then id order; a new snapshot lands on every change. */
  getSnapshot = (): readonly T[] => this.snapshot;
  /** Registers a related set under one cleanup function; the whole batch or none. */
  registerAll(entries: readonly T[], owner?: string): () => void {
    this.assertFresh(entries);
    const remove = entries.map((entry) => this.register(entry, owner));
    return () => remove.forEach((dispose) => dispose());
  }
  /** Read one entry by id, including its registered payload. */
  node(id: string): T | undefined {
    return this.entries.get(id)?.entry;
  }
  /** Read the owner tag recorded with one entry, or undefined when unowned. */
  ownerOf(id: string): string | undefined {
    return this.entries.get(id)?.owner;
  }
  /** Removes everything registered under one owner: the plugin-unload path. */
  unregisterOwner(owner: string): void {
    let changed = false;
    for (const [id, record] of this.entries) {
      if (record.owner === owner) {
        this.entries.delete(id);
        changed = true;
      }
    }
    if (changed) {
      this.changed();
    }
  }
  /**
   * Replace one registered payload in place, keeping its owner.
   *
   * Returns false when no entry carries this id. A successful update rebuilds
   * the ordered snapshot and notifies subscribers, so the same id keeps its
   * place in the owner's registration set and a later `unregisterOwner` still
   * removes it.
   */
  update(entry: T): boolean {
    if (!entry.id.trim() || !Number.isFinite(entry.order)) {
      throw new Error("Contribution requires an id and finite order");
    }
    const record = this.entries.get(entry.id);
    if (!record) {
      return false;
    }
    record.entry = entry;
    this.changed();
    return true;
  }
  /** Remove one entry by id; returns false when it was not registered. */
  unregister(id: string): boolean {
    if (!this.entries.delete(id)) {
      return false;
    }
    this.changed();
    return true;
  }
  /** Reevaluate context predicates without mutating registrations. */
  refresh = () => {
    this.changed();
  };
  /** Subscribe to snapshot changes; returns an unsubscribe callback. */
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  /** Checks a whole batch before any of it lands, so a rejected batch leaves nothing behind. */
  private assertFresh(entries: readonly T[]): void {
    const seen = new Set<string>();
    for (const entry of entries) {
      if (!entry.id.trim() || !Number.isFinite(entry.order)) {
        throw new Error("Contribution requires an id and finite order");
      }
      if (seen.has(entry.id) || this.entries.has(entry.id)) {
        throw new Error(`Contribution already registered: ${entry.id}`);
      }
      seen.add(entry.id);
    }
  }
  /** Rebuild the ordered snapshot and notify every subscriber. */
  private changed() {
    this.snapshot = Object.freeze(
      [...this.entries.values()]
        .map((record) => record.entry)
        .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id)),
    );
    for (const listener of this.listeners) {
      listener();
    }
  }
}
