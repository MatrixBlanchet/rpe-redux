/**
 * The value mechanism: the observable cells every other layer stores state in,
 * and the registry that gives a value an id so it can be read, observed and
 * persisted by name.
 *
 * Three layers, and this is the bottom one:
 *
 * - **Mechanism** (here): `createValue` for one value, `createKeyedValue` for one
 *   value *per key*, and `defineValue`/`values` for a value that has an id, may be
 *   persisted to preferences, and can be observed by the whole application.
 * - **Data**: which values exist, what they start at, and who may write them —
 *   `core/edit/state/*` for the editor's, each surface for its own.
 * - **Facade**: `core/api/values.ts` is the plugin surface. Internal code imports
 *   these cells directly; a plugin goes through the facade.
 *
 * A cell is observable by whole-value subscription and, for a keyed cell, by the
 * single key that changed. Neither shape removes state: `KeyedValueCell` has no
 * `delete`, because these keys are permanent by design.
 */
import {
  PREFERENCE_SECTIONS,
  preferences,
  readPreference,
  writePreference,
  type PreferenceSection,
} from "./preferences.ts";
import { isRecord } from "../utils/guards.ts";
import { assertSafeIdentifier } from "../utils/safeIdentifier.ts";

/** Construction options for one observable cell. */
export interface ValueOptions<T> {
  initial: T;
  validate?(value: T): void;
  merge?(previous: T, next: Partial<T>): T;
  equals?(a: T, b: T): boolean;
}

/** Read, write, update, and subscribe to one value. */
export interface ValueCell<T> {
  get(): T;
  set(value: T): void;
  /** Merge object fields by default; a supplied merge rule overrides that behavior. */
  update(partial: Partial<T>): void;
  subscribe(listener: () => void): () => void;
}

/**
 * Listener reset hooks kept off the public cell shape.
 *
 * Removing a named value must also detach every listener that still holds the
 * cell handle; otherwise a disposed Extension subscription keeps firing when
 * the old handle is written directly.
 */
const cellResetters = new WeakMap<object, () => void>();

/** Local observable value. It is not registered by id or written to preferences. */
export function createValue<T>({
  initial,
  validate,
  merge,
  equals = Object.is,
}: ValueOptions<T>): ValueCell<T> {
  let current = initial;
  const listeners = new Set<() => void>();
  const set = (next: T): void => {
    validate?.(next);
    if (equals(current, next)) {
      return;
    }
    current = next;
    for (const listener of [...listeners]) {
      listener();
    }
  };
  const cell = Object.freeze({
    get: () => current,
    set,
    update(partial: Partial<T>): void {
      if (merge) {
        set(merge(current, partial));
      } else if (isRecord(current) && isRecord(partial)) {
        const previous = current as Record<string, unknown>;
        const fields = partial as Record<string, unknown>;
        if (
          Object.keys(fields).every(
            (key) => Object.hasOwn(previous, key) && Object.is(previous[key], fields[key]),
          )
        ) {
          return;
        }
        set({ ...current, ...partial } as T);
      } else {
        set(partial as T);
      }
    },
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  });
  cellResetters.set(cell, () => listeners.clear());
  return cell;
}

/** Construction options for a per-key cell. */
export interface KeyedValueOptions<V> {
  /** What a key reads before anything has been stored under it. */
  initial: V;
  equals?(a: V, b: V): boolean;
}

/**
 * One value per key.
 *
 * A write notifies only listeners subscribed to that key, and reading an
 * unwritten key returns `initial`. There is no generic keyed store factory.
 */
export interface KeyedValueCell<V> {
  /** The value stored under `key`, or the cell's `initial` when nothing is. */
  get(key: string): V;
  /** Stores a value and notifies only `key`'s listeners. Writing the current value is a no-op. */
  set(key: string, value: V): void;
  /** Adds a listener for one key only. The returned function removes it. */
  subscribeKey(key: string, listener: () => void): () => void;
  /** The keys that hold a value. A key reads its initial value without being stored. */
  keys(): string[];
}

/**
 * Local per-key observable value. Like `createValue` it is registered by no id
 * and never written to preferences.
 */
export function createKeyedValue<V>({
  initial,
  equals = Object.is,
}: KeyedValueOptions<V>): KeyedValueCell<V> {
  const entries = new Map<string, V>();
  const listeners = new Map<string, Set<() => void>>();
  const get = (key: string): V => {
    const stored = entries.get(key);
    return stored === undefined ? initial : stored;
  };
  return Object.freeze({
    get,
    set(key: string, value: V): void {
      if (equals(get(key), value)) {
        return;
      }
      entries.set(key, value);
      for (const listener of [...(listeners.get(key) ?? [])]) {
        listener();
      }
    },
    subscribeKey(key: string, listener: () => void): () => void {
      let keyListeners = listeners.get(key);
      if (!keyListeners) {
        keyListeners = new Set();
        listeners.set(key, keyListeners);
      }
      keyListeners.add(listener);
      return () => {
        keyListeners.delete(listener);
        if (!keyListeners.size) {
          listeners.delete(key);
        }
      };
    },
    keys: () => [...entries.keys()],
  });
}

/** Definition for a named value: initial value, validation, merge, and persistence. */
export interface ValueDefinition<T> extends ValueOptions<T> {
  id: string;
  /** Omitted means runtime-only; true uses the shared values preference section. */
  persist?: true | PreferenceSection;
  storageKey?: string;
  /**
   * Former storage key adopted once when the current key has no stored value.
   * The next write lands under `storageKey` and drops the legacy entry.
   */
  legacyStorageKey?: string;
}

/** The cell returned by `defineValue`, carrying its registry id. */
export interface ValueHandle<T> extends ValueCell<T> {
  readonly id: string;
  /** Alias for subscribe: this handle already identifies one value. */
  subscribeKey(listener: () => void): () => void;
}

/** Dynamic access to the named registry, for ids that are not known at compile time. */
export interface ValueById {
  has(id: string): boolean;
  get<T>(id: string): T;
  set<T>(id: string, value: T): void;
  update(id: string, partial: unknown): void;
  subscribe(id: string, listener: () => void): () => void;
  subscribeAll(listener: () => void): () => void;
  snapshot(): Record<string, unknown>;
}

interface ValueEntry {
  id: string;
  storageKey: string;
  legacyStorageKey?: string;
  section: PreferenceSection | null;
  initial: unknown;
  cell: ValueCell<unknown>;
  handle: ValueHandle<unknown>;
  validate: ((value: unknown) => void) | null;
  equals: (a: unknown, b: unknown) => boolean;
  adopting: boolean;
  /** Who contributed this value; absent for host-owned values. */
  owner?: string;
}

/** Registry backing the live values store and its preference attachment. */
class ValueStore {
  private readonly entries = new Map<string, ValueEntry>();
  private readonly attached = new Set<PreferenceSection>();
  private readonly listeners = new Set<() => void>();
  private readonly ownerRevisions = new Map<string, number>();
  private revision = 0;
  /** Monotonic registry version, incremented on every value change. */
  getVersion = (): number => this.revision;
  /** Subscribe to any named value change; returns an unsubscribe callback. */
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  /**
   * Subscribe to changes of values contributed by one owner.
   *
   * The listener runs only after a write, removal, or adoption of that owner's
   * values, so a package never observes host or other-package state changes
   * through the gated `subscribeAll` handle.
   */
  subscribeOwner(owner: string, listener: () => void): () => void {
    let revision = this.ownerRevisions.get(owner) ?? 0;
    return this.subscribe(() => {
      const next = this.ownerRevisions.get(owner) ?? 0;
      if (next === revision) {
        return;
      }
      revision = next;
      listener();
    });
  }
  readonly byId: ValueById = Object.freeze({
    has: (id: string) => this.has(id),
    get: <T>(id: string) => this.get<T>(id),
    set: <T>(id: string, value: T) => this.set(id, value),
    update: (id: string, partial: unknown) => this.update(id, partial),
    subscribe: (id: string, listener: () => void) => this.subscribeKey(id, listener),
    subscribeAll: (listener: () => void) => this.subscribe(listener),
    snapshot: () => this.snapshot(),
  });

  /**
   * Register a value, adopt any stored value from its section, and persist later
   * writes. `owner` tags a contributed value; the id and storage key must be safe.
   */
  define<T>(definition: ValueDefinition<T>, owner?: string): ValueHandle<T> {
    const { id, validate, equals } = definition;
    assertSafeIdentifier(id, "Value id");
    if (definition.storageKey !== undefined) {
      assertSafeIdentifier(definition.storageKey, "Value storage key");
    }
    if (definition.legacyStorageKey !== undefined) {
      assertSafeIdentifier(definition.legacyStorageKey, "Value legacy storage key");
    }
    if (this.entries.has(id)) {
      const existing = this.entries.get(id);
      if (owner !== undefined && existing?.owner === owner) {
        // A package may re-declare one of its values after a reload. The first
        // declaration owns the cell; later declarations reuse its state.
        return existing.handle as ValueHandle<T>;
      }
      throw new Error("Value id must be unique: " + id);
    }
    const section =
      definition.persist === undefined
        ? null
        : definition.persist === true
          ? PREFERENCE_SECTIONS.values
          : definition.persist;
    const cell = createValue(definition);
    const handle = Object.freeze({
      id,
      ...cell,
      subscribeKey: cell.subscribe,
    }) as ValueHandle<unknown>;
    const entry: ValueEntry = {
      id,
      storageKey: definition.storageKey ?? id,
      ...(definition.legacyStorageKey === undefined
        ? {}
        : { legacyStorageKey: definition.legacyStorageKey }),
      section,
      initial: definition.initial,
      cell: cell as ValueCell<unknown>,
      handle,
      validate: validate ? (value) => validate(value as T) : null,
      equals: equals ? (a, b) => equals(a as T, b as T) : Object.is,
      adopting: false,
      ...(owner === undefined ? {} : { owner }),
    };
    this.entries.set(id, entry);
    if (section) {
      this.attach(section);
      const values = this.section(section);
      const stored = values[entry.storageKey];
      if (stored !== undefined && this.accepts(entry, stored)) {
        cell.set(stored as T);
      } else if (definition.legacyStorageKey !== undefined) {
        const legacy = values[definition.legacyStorageKey];
        if (legacy !== undefined && this.accepts(entry, legacy)) {
          cell.set(legacy as T);
          const migrated = { ...values, [entry.storageKey]: legacy };
          delete migrated[definition.legacyStorageKey];
          writePreference(section, migrated);
        }
      }
    }
    cell.subscribe(() => {
      if (!entry.adopting) {
        this.persist(entry);
      }
      if (entry.owner !== undefined) {
        this.bumpOwner(entry.owner);
      }
      this.notify();
    });
    if (owner !== undefined) {
      this.bumpOwner(owner);
    }
    return handle as ValueHandle<T>;
  }

  /** Whether an id is registered. */
  has(id: string): boolean {
    return this.entries.has(id);
  }
  /** The contributing package for an owned value, or undefined for host values. */
  ownerOf(id: string): string | undefined {
    return this.entries.get(id)?.owner;
  }
  /**
   * Remove one named value and detach every listener still holding its handle.
   *
   * `purge` also removes the value's persisted storage entry. A normal runtime
   * disposal keeps stored state so the next declaration adopts it.
   */
  undefine(id: string, options: { purge?: boolean } = {}): boolean {
    const entry = this.entries.get(id);
    if (!entry) {
      return false;
    }
    this.entries.delete(id);
    cellResetters.get(entry.cell)?.();
    if (entry.owner !== undefined) {
      this.bumpOwner(entry.owner);
    }
    if (options.purge) {
      this.purgeStored([entry]);
    }
    this.notify();
    return true;
  }
  /**
   * Remove every value contributed by one owner and detach their listeners.
   *
   * `purge` also removes the owner's persisted value entries. Callers use the
   * plain form for disable/reload and the purge form only for uninstall.
   */
  removeOwner(owner: string, options: { purge?: boolean } = {}): number {
    if (!owner.trim()) {
      throw new Error("Value owner must not be empty");
    }
    const removed: ValueEntry[] = [];
    for (const [id, entry] of this.entries) {
      if (entry.owner !== owner) {
        continue;
      }
      this.entries.delete(id);
      cellResetters.get(entry.cell)?.();
      removed.push(entry);
    }
    if (!removed.length) {
      return 0;
    }
    this.bumpOwner(owner);
    if (options.purge) {
      this.purgeStored(removed);
    }
    this.notify();
    return removed.length;
  }
  /** Remove one owner's values and their persisted storage entries. */
  purgeOwner(owner: string): number {
    return this.removeOwner(owner, { purge: true });
  }
  /** Read the handle for a registered id; throws when the id is unknown. */
  getHandle<T>(id: string): ValueHandle<T> {
    return this.require(id).handle as ValueHandle<T>;
  }
  /** Read a registered value by id; throws when the id is unknown. */
  get<T>(id: string): T {
    return this.require(id).cell.get() as T;
  }
  /** Write a registered value by id; throws when the id is unknown. */
  set<T>(id: string, value: T): void {
    this.require(id).cell.set(value);
  }
  /** Merge into a registered value by id; throws when the id is unknown. */
  update(id: string, partial: unknown): void {
    this.require(id).cell.update(partial as Partial<unknown>);
  }
  /** Subscribe to one registered value by id. */
  subscribeKey(id: string, listener: () => void): () => void {
    return this.require(id).cell.subscribe(listener);
  }
  /** Values that differ from their initial state, keyed by value id. */
  snapshot(): Record<string, unknown> {
    const moved: Record<string, unknown> = {};
    for (const entry of this.entries.values()) {
      const value = entry.cell.get();
      if (!entry.equals(value, entry.initial)) {
        moved[entry.id] = value;
      }
    }
    return moved;
  }
  /** Return a registered entry, throwing a stable error for an unknown id. */
  private require(id: string): ValueEntry {
    const entry = this.entries.get(id);
    if (!entry) {
      throw new Error("Value is not defined: " + id);
    }
    return entry;
  }
  /** Bump the registry version and notify every subscriber. */
  private notify(): void {
    this.revision++;
    for (const listener of [...this.listeners]) {
      listener();
    }
  }
  /** Advance one owner's revision before the shared notification runs. */
  private bumpOwner(owner: string): void {
    this.ownerRevisions.set(owner, (this.ownerRevisions.get(owner) ?? 0) + 1);
  }
  /** Copy one preference section, or an empty object when it is malformed. */
  private section(name: PreferenceSection): Record<string, unknown> {
    const value = readPreference<unknown>(name, {});
    return isRecord(value) ? { ...value } : {};
  }
  /** Whether the value passes the entry's validator; a missing validator accepts. */
  private accepts(entry: ValueEntry, value: unknown): boolean {
    try {
      entry.validate?.(value);
      return true;
    } catch {
      return false;
    }
  }
  /** Remove one owner's stored keys, grouping writes by preference section. */
  private purgeStored(entries: readonly ValueEntry[]): void {
    const bySection = new Map<PreferenceSection, Set<string>>();
    for (const entry of entries) {
      if (!entry.section) {
        continue;
      }
      let keys = bySection.get(entry.section);
      if (!keys) {
        keys = new Set();
        bySection.set(entry.section, keys);
      }
      keys.add(entry.storageKey);
      if (entry.legacyStorageKey !== undefined) {
        keys.add(entry.legacyStorageKey);
      }
    }
    for (const [section, keys] of bySection) {
      const current = this.section(section);
      let changed = false;
      for (const key of keys) {
        if (Object.hasOwn(current, key)) {
          delete current[key];
          changed = true;
        }
      }
      if (changed) {
        writePreference(section, current);
      }
    }
  }
  /** Mirror one value into its preference section, removing it when back at initial. */
  private persist(entry: ValueEntry): void {
    if (!entry.section) {
      return;
    }
    const section = this.section(entry.section),
      value = entry.cell.get();
    if (entry.equals(value, entry.initial)) {
      if (!(entry.storageKey in section)) {
        return;
      }
      delete section[entry.storageKey];
    } else {
      section[entry.storageKey] = value;
    }
    writePreference(entry.section, section);
  }
  /** Follow one preference section once, so external writes reach its values. */
  private attach(name: PreferenceSection): void {
    if (this.attached.has(name)) {
      return;
    }
    this.attached.add(name);
    preferences.subscribe(name, () => this.adopt(name));
  }
  /** Adopt a changed preference section without writing it back. */
  private adopt(name: PreferenceSection): void {
    const section = this.section(name);
    for (const entry of this.entries.values()) {
      if (entry.section !== name) {
        continue;
      }
      const stored = section[entry.storageKey];
      if (stored !== undefined && !this.accepts(entry, stored)) {
        continue;
      }
      const next = stored === undefined ? entry.initial : stored;
      if (entry.equals(entry.cell.get(), next)) {
        continue;
      }
      entry.adopting = true;
      try {
        entry.cell.set(next);
      } finally {
        entry.adopting = false;
      }
    }
  }
}

/** Registry for named application/plugin values; local cells share its implementation. */
export const values = new ValueStore();
/** Register a named value on the shared registry and return its handle. */
export function defineValue<T>(definition: ValueDefinition<T>, owner?: string): ValueHandle<T> {
  return values.define(definition, owner);
}
