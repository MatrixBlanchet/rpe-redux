/** Public, namespaced hook registry used by sandboxed Extensions.
 *
 * Hooks cross a small interface: a package registers a namespaced handler and
 * another package invokes it with a JSON object. The registry owns ordering,
 * cancellation, timeout handling, result merging, and lifecycle disposal.
 */

/** A JSON object accepted as a public hook payload or handler patch. */
export type ExtensionHookObject = Readonly<Record<string, unknown>>;

/** Primitive field kinds accepted by a public hook payload schema. */
export type PublicHookFieldType = "string" | "number" | "boolean" | "object" | "array" | "null";

/** One named field in a public hook payload schema. */
export interface PublicHookFieldSchema {
  readonly type: PublicHookFieldType;
  readonly required?: boolean;
}

/** Stable, JSON-safe shape contract for one public hook payload. */
export interface PublicHookPayloadSchema {
  readonly fields: Readonly<Record<string, PublicHookFieldSchema>>;
  readonly allowUnknown?: boolean;
}

/** Options that control one public hook registration. */
export interface PublicHookRegistrationOptions {
  readonly owner: string;
  readonly schema: PublicHookPayloadSchema;
  readonly priority?: number;
}

/** Options that control one public hook invocation. */
export interface PublicHookInvokeOptions {
  readonly signal?: AbortSignal;
  readonly timeoutMs?: number;
}

/** The merged result returned by a public hook invocation. */
export interface PublicHookInvocationResult {
  readonly payload: ExtensionHookObject;
  readonly cancelled: boolean;
  readonly handled: boolean;
}

/** Stable errors thrown by the public hook seam. */
export type PublicHookErrorCode =
  | "hookNameInvalid"
  | "hookPayloadInvalid"
  | "hookSchemaInvalid"
  | "hookNotFound"
  | "hookCancelled"
  | "hookTimeout"
  | "hookHandlerFailed"
  | "hookResultInvalid";

/** Error with a stable code that callers can branch on across the bridge. */
export class PublicHookError extends Error {
  readonly code: PublicHookErrorCode;
  readonly hookName: string;

  /** Build one public hook failure. */
  constructor(code: PublicHookErrorCode, hookName: string, message: string) {
    super(message);
    this.name = "PublicHookError";
    this.code = code;
    this.hookName = hookName;
  }
}

/** A public hook callback; it may return a partial payload or cancel the run. */
export type PublicHookHandler = (
  payload: ExtensionHookObject,
) => ExtensionHookObject | void | Promise<ExtensionHookObject | void>;

interface PublicHookEntry {
  readonly owner: string;
  readonly callback: PublicHookHandler;
  readonly priority: number;
  readonly schema: PublicHookPayloadSchema;
  readonly sequence: number;
  active: boolean;
}

const HOOK_NAME = /^[a-z][a-z0-9._-]{1,127}:[a-z][a-z0-9._-]{0,63}$/u;
const MAX_NAME_LENGTH = 128;
const MAX_HANDLERS = 128;
const MAX_TIMEOUT_MS = 30_000;

/** Await one handler while keeping timeout and cancellation listeners bounded. */
function awaitHookHandler(
  result: PromiseLike<unknown> | unknown,
  name: string,
  timeoutMs: number,
  signal: AbortSignal | undefined,
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(
      () =>
        finish(new PublicHookError("hookTimeout", name, `Extension hook timed out: ${name}`), true),
      timeoutMs,
    );
    const cleanup = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
    };
    const finish = (value: unknown, failed: boolean) => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      if (failed) {
        reject(value);
      } else {
        resolve(value);
      }
    };
    const onAbort = () =>
      finish(
        new PublicHookError("hookCancelled", name, `Extension hook was cancelled: ${name}`),
        true,
      );
    if (signal?.aborted) {
      onAbort();
      return;
    }
    signal?.addEventListener("abort", onAbort, { once: true });
    Promise.resolve(result).then(
      (value) => finish(value, false),
      (error) => finish(error, true),
    );
  });
}

/** Whether a value is a plain JSON-compatible value. */
function isJsonValue(value: unknown, ancestors: Set<object>, depth: number): boolean {
  if (depth > 32) {
    return false;
  }
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return true;
  }
  if (typeof value === "number") {
    return Number.isFinite(value);
  }
  if (typeof value !== "object" || ancestors.has(value)) {
    return false;
  }
  if (Array.isArray(value)) {
    ancestors.add(value);
    try {
      return value.every((entry) => isJsonValue(entry, ancestors, depth + 1));
    } finally {
      ancestors.delete(value);
    }
  }
  if (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) {
    return false;
  }
  ancestors.add(value);
  try {
    return Object.values(value).every((entry) => isJsonValue(entry, ancestors, depth + 1));
  } finally {
    ancestors.delete(value);
  }
}

/** Validate one public hook name and return its trimmed form. */
export function normalizePublicHookName(name: unknown, owner?: string): string {
  if (typeof name !== "string") {
    throw new PublicHookError(
      "hookNameInvalid",
      String(name),
      "Extension hook name must be a string",
    );
  }
  const trimmed = name.trim();
  if (
    !trimmed ||
    trimmed.length > MAX_NAME_LENGTH ||
    !HOOK_NAME.test(trimmed) ||
    (owner !== undefined && !trimmed.startsWith(`${owner}:`))
  ) {
    const suffix = owner === undefined ? "" : ` for owner ${owner}`;
    throw new PublicHookError(
      "hookNameInvalid",
      trimmed,
      `Extension hook name is invalid${suffix}: ${trimmed}`,
    );
  }
  return trimmed;
}

/** Validate a payload object before it crosses the public hook seam. */
function assertHookObject(
  value: unknown,
  code: "hookPayloadInvalid" | "hookResultInvalid",
  name: string,
): asserts value is ExtensionHookObject {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) ||
    !isJsonValue(value, new Set(), 0)
  ) {
    throw new PublicHookError(
      code,
      name,
      `Extension hook ${code === "hookPayloadInvalid" ? "payload" : "result"} must be JSON data`,
    );
  }
}

/** Validate and freeze a public hook payload schema at registration time. */
function normalizeHookSchema(schema: unknown, name: string): PublicHookPayloadSchema {
  if (!schema || typeof schema !== "object" || Array.isArray(schema)) {
    throw new PublicHookError("hookSchemaInvalid", name, "Extension hook schema must be an object");
  }
  const fields = (schema as { fields?: unknown }).fields;
  if (!fields || typeof fields !== "object" || Array.isArray(fields)) {
    throw new PublicHookError(
      "hookSchemaInvalid",
      name,
      "Extension hook schema fields are required",
    );
  }
  const normalized: Record<string, PublicHookFieldSchema> = {};
  for (const [field, definition] of Object.entries(fields)) {
    if (!/^[a-z][a-z0-9._-]{0,63}$/u.test(field) || !definition || typeof definition !== "object") {
      throw new PublicHookError(
        "hookSchemaInvalid",
        name,
        `Invalid Extension hook field: ${field}`,
      );
    }
    const type = (definition as { type?: unknown }).type;
    if (
      !(["string", "number", "boolean", "object", "array", "null"] as const).includes(
        type as PublicHookFieldType,
      )
    ) {
      throw new PublicHookError(
        "hookSchemaInvalid",
        name,
        `Invalid Extension hook field type: ${field}`,
      );
    }
    normalized[field] = Object.freeze({
      type: type as PublicHookFieldType,
      ...(typeof (definition as { required?: unknown }).required === "boolean"
        ? { required: (definition as { required: boolean }).required }
        : {}),
    });
  }
  return Object.freeze({
    fields: Object.freeze(normalized),
    allowUnknown: (schema as { allowUnknown?: unknown }).allowUnknown === true,
  });
}

/** Validate one payload against the hook's published field schema. */
function assertHookSchemaPayload(
  value: ExtensionHookObject,
  schema: PublicHookPayloadSchema,
  name: string,
): void {
  for (const [field, definition] of Object.entries(schema.fields)) {
    if (!(field in value)) {
      if (definition.required) {
        throw new PublicHookError(
          "hookPayloadInvalid",
          name,
          `Required hook field is missing: ${field}`,
        );
      }
      continue;
    }
    const entry = value[field];
    const matches =
      (definition.type === "null" && entry === null) ||
      (definition.type === "array" && Array.isArray(entry)) ||
      (definition.type === "object" &&
        entry !== null &&
        typeof entry === "object" &&
        !Array.isArray(entry)) ||
      (definition.type === "number" && typeof entry === "number" && Number.isFinite(entry)) ||
      (definition.type === "string" && typeof entry === "string") ||
      (definition.type === "boolean" && typeof entry === "boolean");
    if (!matches) {
      throw new PublicHookError(
        "hookPayloadInvalid",
        name,
        `Hook field has the wrong type: ${field}`,
      );
    }
  }
  if (!schema.allowUnknown && Object.keys(value).some((field) => !(field in schema.fields))) {
    throw new PublicHookError("hookPayloadInvalid", name, "Hook payload contains an unknown field");
  }
}

/** Ordered, disposable registry for public Extension hooks. */
export class PublicHookRegistry {
  private readonly hooks = new Map<string, PublicHookEntry[]>();
  private nextSequence = 0;

  /** Register one owner-scoped hook and return an idempotent disposer. */
  register(
    name: unknown,
    callback: PublicHookHandler,
    options: PublicHookRegistrationOptions,
  ): () => void {
    const normalized = normalizePublicHookName(name, options.owner);
    const schema = normalizeHookSchema(options.schema, normalized);
    if (typeof callback !== "function") {
      throw new TypeError("Extension hook handler must be a function");
    }
    const priority = options.priority ?? 0;
    if (!Number.isFinite(priority)) {
      throw new TypeError("Extension hook priority must be finite");
    }
    const entries = this.hooks.get(normalized) ?? [];
    if (entries.length && JSON.stringify(entries[0].schema) !== JSON.stringify(schema)) {
      throw new PublicHookError(
        "hookSchemaInvalid",
        normalized,
        "Hook registrations must share one schema",
      );
    }
    if (entries.length >= MAX_HANDLERS) {
      throw new PublicHookError(
        "hookHandlerFailed",
        normalized,
        "Extension hook handler limit reached",
      );
    }
    const entry: PublicHookEntry = {
      owner: options.owner,
      callback,
      priority: Math.max(-1000, Math.min(1000, priority)),
      schema,
      sequence: this.nextSequence++,
      active: true,
    };
    entries.push(entry);
    entries.sort((left, right) => right.priority - left.priority || left.sequence - right.sequence);
    this.hooks.set(normalized, entries);
    return () => {
      if (!entry.active) {
        return;
      }
      entry.active = false;
      const current = this.hooks.get(normalized);
      if (!current) {
        return;
      }
      const index = current.indexOf(entry);
      if (index >= 0) {
        current.splice(index, 1);
      }
      if (!current.length) {
        this.hooks.delete(normalized);
      }
    };
  }

  /** Invoke one hook, merging handler patches in priority order. */
  async invoke(
    name: unknown,
    payload: unknown,
    options: PublicHookInvokeOptions = {},
  ): Promise<PublicHookInvocationResult> {
    const normalized = normalizePublicHookName(name);
    assertHookObject(payload, "hookPayloadInvalid", normalized);
    const entries = this.hooks.get(normalized);
    if (!entries?.length) {
      throw new PublicHookError(
        "hookNotFound",
        normalized,
        `Extension hook is not registered: ${normalized}`,
      );
    }
    assertHookSchemaPayload(payload, entries[0].schema, normalized);
    const timeoutMs =
      options.timeoutMs === undefined
        ? 5_000
        : Math.max(1, Math.min(MAX_TIMEOUT_MS, Math.round(options.timeoutMs)));
    const started = Date.now();
    let current: Record<string, unknown> = { ...payload };
    let cancelled = false;
    for (const entry of [...entries]) {
      if (options.signal?.aborted) {
        throw new PublicHookError(
          "hookCancelled",
          normalized,
          `Extension hook was cancelled: ${normalized}`,
        );
      }
      const elapsed = Date.now() - started;
      if (elapsed >= timeoutMs) {
        throw new PublicHookError(
          "hookTimeout",
          normalized,
          `Extension hook timed out: ${normalized}`,
        );
      }
      let result: unknown;
      try {
        result = await awaitHookHandler(
          entry.callback(Object.freeze({ ...current })),
          normalized,
          Math.max(1, timeoutMs - elapsed),
          options.signal,
        );
      } catch (error) {
        if (error instanceof PublicHookError) {
          throw error;
        }
        throw new PublicHookError("hookHandlerFailed", normalized, String(error));
      }
      if (result === undefined) {
        continue;
      }
      assertHookObject(result, "hookResultInvalid", normalized);
      current = { ...current, ...result };
      assertHookSchemaPayload(current, entries[0].schema, normalized);
      if (result.cancel === true) {
        cancelled = true;
        break;
      }
    }
    return Object.freeze({ payload: Object.freeze(current), cancelled, handled: true });
  }

  /** Remove every registration owned by one Extension. */
  removeOwner(owner: string): number {
    let removed = 0;
    for (const [name, entries] of this.hooks) {
      const retained = entries.filter((entry) => {
        if (entry.owner !== owner) {
          return true;
        }
        entry.active = false;
        removed += 1;
        return false;
      });
      if (retained.length) {
        this.hooks.set(name, retained);
      } else {
        this.hooks.delete(name);
      }
    }
    return removed;
  }

  /** Return whether a hook currently has at least one handler. */
  has(name: unknown): boolean {
    const normalized = normalizePublicHookName(name);
    return Boolean(this.hooks.get(normalized)?.length);
  }
}

/** Application-wide registry shared by Extension runtimes and host features. */
export const publicHookRegistry = new PublicHookRegistry();
