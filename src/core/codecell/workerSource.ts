/**
 * The source of the dedicated worker that executes one code cell.
 *
 * The opaque-origin iframe holds the host bridge and creates a classic blob
 * worker from this text; a module worker cannot be created in that origin. The
 * bootstrap loads the submitted cell module with a dynamic import, captures its
 * console, mirrors the asynchronous API over the bridge, and returns one
 * structured result. The iframe owns the deadline and calls `terminate()`, so a
 * synchronous loop in the cell never blocks the editor or the bridge.
 */
export const CELL_WORKER_SOURCE = `
"use strict";
(() => {
  const post = globalThis.postMessage.bind(globalThis);
  const textEncoder = new TextEncoder();
  const CELL_LOG_LIMIT = 200;
  const CELL_LOG_BYTES = 64 * 1024;
  const CELL_LOG_TEXT = 4096;
  const CELL_RESULT_BYTES = 1_000_000;
  const pending = new Map();
  const callbacks = new Map();
  const controller = new AbortController();
  let nextId = 1;
  let startedAt = 0;
  let manifest = null;
  let input;
  let version = "";
  let cellConsole = null;
  let finished = false;

  /** Returns a readable message for any thrown value. */
  function messageOf(error) {
    return error instanceof Error ? error.message : String(error);
  }

  /** Serializes an error for a cell result. */
  function errorOf(error) {
    return {
      name: error instanceof Error ? error.name : "Error",
      message: messageOf(error),
      stack:
        error instanceof Error && typeof error.stack === "string" ? error.stack : undefined,
    };
  }

  /** Formats one console argument for cell log capture. */
  function formatLogValue(value) {
    if (typeof value === "string") {
      return value;
    }
    if (value instanceof Error) {
      return value.stack ?? value.message;
    }
    try {
      return JSON.stringify(value, (_key, entry) =>
        typeof entry === "bigint" ? String(entry) + "n" : entry,
      );
    } catch {
      return String(value);
    }
  }

  /** Replaces console with a bounded capture and returns its logs and truncation flag. */
  function createCellConsole(start) {
    const logs = [];
    let bytes = 0;
    let truncated = false;
    const write =
      (level) =>
      (...args) => {
        if (logs.length >= CELL_LOG_LIMIT || bytes >= CELL_LOG_BYTES) {
          truncated = true;
          return;
        }
        let text = args.map(formatLogValue).join(" ");
        if (text.length > CELL_LOG_TEXT) {
          text = text.slice(0, CELL_LOG_TEXT) + "…";
          truncated = true;
        }
        const size = textEncoder.encode(text).byteLength;
        if (bytes + size > CELL_LOG_BYTES) {
          truncated = true;
          return;
        }
        bytes += size;
        const entry = {
          level,
          text,
          atMs: Math.round(performance.now() - start),
        };
        logs.push(entry);
        try {
          post({ type: "cell-log", log: entry });
        } catch {
          // A terminated worker cannot stream its last entries; the final result
          // still carries the local log array when the run completes normally.
        }
      };
    const original = globalThis.console;
    globalThis.console = {
      ...original,
      log: write("log"),
      info: write("info"),
      warn: write("warn"),
      error: write("error"),
      debug: write("log"),
    };
    return { logs, truncated: () => truncated };
  }

  /** Serializes a cell result and flags values that exceed the size cap. */
  function cellValue(value) {
    try {
      const text = JSON.stringify(value, (_key, entry) => {
        if (typeof entry === "bigint") {
          return String(entry) + "n";
        }
        if (typeof entry === "function" || typeof entry === "symbol") {
          return undefined;
        }
        if (entry instanceof Uint8Array) {
          return Array.from(entry);
        }
        return entry;
      });
      if (text === undefined) {
        return { value: null, truncated: false };
      }
      if (text.length > CELL_RESULT_BYTES) {
        return { value: null, truncated: true };
      }
      return { value: JSON.parse(text), truncated: false };
    } catch {
      return { value: null, truncated: true };
    }
  }

  /** Delivers the one result this worker may report; later calls are ignored. */
  function finish(result) {
    if (finished) {
      return;
    }
    finished = true;
    post(result);
  }

  /** Reports a non-cell failure, such as a throwing host callback, to the iframe. */
  function reportFailure(action, error) {
    if (finished) {
      return;
    }
    post({ type: "cell-failure", action, error: messageOf(error) });
  }

  /** Stores a callback for invocation from the iframe and returns its id. */
  function registerCallback(callback) {
    const id = nextId++;
    callbacks.set(id, callback);
    return id;
  }

  /** Converts callbacks and byte arrays into bridge-safe values. */
  function encode(value) {
    if (typeof value === "function") {
      return { __callback: registerCallback(value) };
    }
    if (value instanceof Uint8Array) {
      return { __bytes: Array.from(value) };
    }
    if (Array.isArray(value)) {
      return value.map(encode);
    }
    if (value && typeof value === "object") {
      const encoded = {};
      for (const [key, entry] of Object.entries(value)) {
        encoded[key] = encode(entry);
      }
      return encoded;
    }
    return value;
  }

  /** Sends one request through the iframe and resolves with its decoded result. */
  function rpc(method, args) {
    if (finished) {
      return Promise.reject(new Error("Code cell worker is finished"));
    }
    const id = nextId++;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      try {
        post({ type: "cell-rpc", id, method, args: encode(args) });
      } catch (error) {
        pending.delete(id);
        reject(error);
      }
    });
  }

  /** Returns an idempotent disposer that releases one host handle. */
  function makeDisposer(id) {
    let active = true;
    return () => {
      if (!active || finished) {
        return;
      }
      active = false;
      post({ type: "cell-dispose-handle", id });
    };
  }

  /** Builds the asynchronous proxy for one host value handle. */
  function makeValueHandle(bridgeId, id) {
    return Object.freeze({
      id: typeof id === "string" ? id : "",
      get: () => rpc("values.get", [bridgeId]),
      set: (value) => rpc("values.set", [bridgeId, value]),
      update: (partial) => rpc("values.update", [bridgeId, partial]),
      subscribe: (listener) => rpc("values.subscribe", [bridgeId, listener]),
      subscribeKey: (listener) => rpc("values.subscribe", [bridgeId, listener]),
    });
  }

  /** Restores byte arrays, value handles, and disposers from bridge values. */
  function decode(value) {
    if (Array.isArray(value)) {
      return value.map(decode);
    }
    if (value && typeof value === "object") {
      if (Array.isArray(value.__bytes)) {
        return new Uint8Array(value.__bytes);
      }
      if (typeof value.__valueHandle === "string") {
        return makeValueHandle(value.__valueHandle, value.id);
      }
      if (typeof value.__disposer === "string") {
        return makeDisposer(value.__disposer);
      }
      const decoded = {};
      for (const [key, entry] of Object.entries(value)) {
        decoded[key] = decode(entry);
      }
      return decoded;
    }
    return value;
  }

  /** Builds the proxy that turns property paths and calls into bridge RPCs. */
  function makeApi(path) {
    const target = (...args) => rpc("api.call", [path, args]);
    return new Proxy(target, {
      get(_target, property) {
        if (typeof property !== "string") {
          return undefined;
        }
        if (path.length === 0 && property === "version") {
          return version;
        }
        if (
          property === "then" ||
          property === "toJSON" ||
          property === "constructor" ||
          property === "prototype" ||
          property === "__proto__"
        ) {
          return undefined;
        }
        return makeApi([...path, property]);
      },
      apply(_target, _thisArg, args) {
        return rpc("api.call", [path, args]);
      },
    });
  }

  /** Denies a global that cell code must not use inside its worker. */
  function deny(name, message) {
    const denyValue = function denyGlobal() {
      throw new Error(message);
    };
    let holder = globalThis;
    while (holder && holder !== Object.prototype) {
      try {
        Object.defineProperty(holder, name, {
          configurable: false,
          writable: false,
          value: denyValue,
        });
      } catch {
        try {
          holder[name] = denyValue;
        } catch {
          // A host-defined non-writable property stays as it is.
        }
      }
      holder = Object.getPrototypeOf(holder);
    }
  }

  /** Removes timers, nested workers, and the raw bridge from cell code. */
  function shieldGlobals() {
    for (const name of [
      "setTimeout",
      "setInterval",
      "setImmediate",
      "requestAnimationFrame",
      "clearTimeout",
      "clearInterval",
      "cancelAnimationFrame",
    ]) {
      deny(name, "Global timers are not available inside a code cell");
    }
    deny("Worker", "Nested workers are not available inside a code cell");
    deny("SharedWorker", "Nested workers are not available inside a code cell");
    deny("importScripts", "importScripts is not available inside a code cell");
    deny("postMessage", "The code cell bridge is not available to cell code");
    deny("close", "A code cell cannot close its worker");
  }

  /** Handles one bridge result or callback message from the iframe. */
  function onMessage(message) {
    if (!message || typeof message !== "object") {
      return;
    }
    if (message.type === "cell-rpc-result") {
      const request = pending.get(message.id);
      if (!request) {
        return;
      }
      pending.delete(message.id);
      if (message.ok) {
        request.resolve(decode(message.value));
      } else {
        const error = new Error(String(message.error?.message ?? "Code cell bridge failed"));
        if (message.error?.code) {
          error.code = message.error.code;
        }
        request.reject(error);
      }
      return;
    }
    if (message.type === "cell-callback") {
      const callback = callbacks.get(message.id);
      if (!callback) {
        return;
      }
      try {
        const result = callback(...(Array.isArray(message.args) ? message.args : []));
        if (result && typeof result.then === "function") {
          result.catch((error) => reportFailure("callback.promise", error));
        }
      } catch (error) {
        reportFailure("callback", error);
      }
      return;
    }
    if (message.type === "cell-abort") {
      controller.abort();
    }
  }

  /** Imports the cell module, runs activate, and reports the result. */
  async function run(message) {
    manifest = message.manifest;
    input = message.input;
    version = typeof message.version === "string" ? message.version : "";
    startedAt = performance.now();
    cellConsole = createCellConsole(startedAt);
    shieldGlobals();
    try {
      const sourceUrl = String(message.sourceUrl ?? "");
      if (!sourceUrl) {
        throw new Error("Code cell source is unavailable");
      }
      const module = await import(sourceUrl);
      // module.mod keeps older installed packages loadable.
      const definition = module.default ?? module.extension ?? module.mod;
      if (!definition || typeof definition.activate !== "function") {
        throw new Error("Extension entry must export a default definition with activate");
      }
      const value = await definition.activate({
        manifest,
        signal: controller.signal,
        api: makeApi([]),
        input,
      });
      const encoded = cellValue(value);
      finish({
        type: "cell-result",
        ok: true,
        value: encoded.value,
        logs: cellConsole.logs,
        durationMs: Math.round(performance.now() - startedAt),
        truncated: encoded.truncated || cellConsole.truncated() === true,
      });
    } catch (error) {
      finish({
        type: "cell-result",
        ok: false,
        error: errorOf(error),
        logs: cellConsole.logs,
        durationMs: Math.round(performance.now() - startedAt),
        truncated: cellConsole.truncated() === true,
      });
    }
  }

  globalThis.addEventListener("message", (event) => {
    const message = event.data;
    if (!message || typeof message !== "object") {
      return;
    }
    if (message.type === "cell-init") {
      void run(message);
      return;
    }
    onMessage(message);
  });
  globalThis.addEventListener("error", (event) => {
    reportFailure("sandbox.error", event.error ?? event.message);
  });
  globalThis.addEventListener("unhandledrejection", (event) => {
    reportFailure("sandbox.promise", event.reason);
  });
})();
`;
