/**
 * The dedicated code-cell worker: module loading, API relay, console capture,
 * callback forwarding, and termination of a cell that never returns.
 *
 * The browser creates the worker from `CELL_WORKER_SOURCE`; this suite executes
 * the same text in a Node worker with a small `self` shim, so the worker half of
 * the protocol is covered without an iframe.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { Worker } from "node:worker_threads";
import { buildCodeCellSource } from "../../../core/codecell/runtime.ts";
import { CELL_WORKER_SOURCE } from "../../../core/codecell/workerSource.ts";

/** Worker prelude that presents the browser globals the bootstrap expects. */
const WORKER_PRELUDE = `
const { parentPort } = require("node:worker_threads");
globalThis.self = globalThis;
const cellListeners = [];
globalThis.addEventListener = (type, listener) => {
  if (type === "message") {
    cellListeners.push(listener);
  }
};
globalThis.postMessage = (message) => parentPort.postMessage(message);
parentPort.on("message", (data) => {
  for (const listener of cellListeners) {
    listener({ data, source: parentPort });
  }
});
`;

const MANIFEST = Object.freeze({
  id: "cell.test",
  name: "Test cell",
  version: "0.0.0",
  kind: "extension",
  engines: { "rpe-redux": 1 },
  capabilities: [],
});

/** Encode a module as a data URL, the Node equivalent of the iframe's blob URL. */
function moduleUrl(source) {
  return `data:text/javascript;charset=utf-8,${encodeURIComponent(source)}`;
}

/** A worker host with the iframe half of the cell protocol reduced to one object. */
class CellWorkerHost {
  constructor(responder = () => {}) {
    this.responder = responder;
    this.messages = [];
    this.resolve = null;
    this.result = new Promise((resolve) => {
      this.resolve = resolve;
    });
    this.spawn();
  }

  /** Creates (or replaces) the worker while keeping this host object intact. */
  spawn() {
    this.worker = new Worker(`${WORKER_PRELUDE}\n${CELL_WORKER_SOURCE}`, { eval: true });
    this.worker.on("message", (message) => this.onMessage(message));
    this.worker.on("error", (error) => {
      this.resolve?.({
        ok: false,
        logs: [],
        error: { name: error.name, message: error.message, stack: error.stack },
        durationMs: 0,
        truncated: false,
      });
    });
  }

  /** Routes worker bridge messages and resolves the one cell result. */
  onMessage(message) {
    this.messages.push(message);
    if (message.type === "cell-result") {
      const resolve = this.resolve;
      this.resolve = null;
      resolve?.(message);
      return;
    }
    if (message.type === "cell-rpc") {
      this.responder(message, this);
    }
  }

  /** Starts one cell module in this worker. */
  run(source, options = {}) {
    this.result = new Promise((resolve) => {
      this.resolve = resolve;
    });
    this.worker.postMessage({
      type: "cell-init",
      sourceUrl: moduleUrl(buildCodeCellSource(source, "test")),
      manifest: MANIFEST,
      input: options.input,
      version: "0.0.0",
    });
    return this.result;
  }

  /** Stops the worker; the returned promise resolves when the thread is gone. */
  terminate() {
    this.resolve = null;
    return this.worker.terminate();
  }
}

/** Resolve a promise or reject after a budget, so a hung worker fails the test. */
function withDeadline(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms} ms`)), ms);
      timer.unref?.();
    }),
  ]);
}

test("the cell worker returns its value and captured console logs", async () => {
  const host = new CellWorkerHost((message, workerHost) => {
    assert.equal(message.method, "api.call");
    assert.deepEqual(message.args[0], ["echo"]);
    workerHost.worker.postMessage({
      type: "cell-rpc-result",
      id: message.id,
      ok: true,
      value: { got: message.args[1][0] },
    });
  });
  try {
    const result = await withDeadline(
      host.run(
        `
        console.log("hello", input.value);
        const echoed = await redux.echo(input.value);
        return { echoed, value: input.value, big: 10n, bytes: new Uint8Array([1, 2]) };
        `,
        { input: { value: 42 } },
      ),
      5_000,
      "normal cell",
    );

    assert.equal(result.ok, true);
    assert.deepEqual(result.value, {
      echoed: { got: 42 },
      value: 42,
      big: "10n",
      bytes: [1, 2],
    });
    assert.equal(result.logs.length, 1);
    assert.equal(result.logs[0].level, "log");
    assert.match(result.logs[0].text, /hello 42/);
    assert.ok(
      host.messages.some(
        (message) => message.type === "cell-log" && /hello 42/.test(message.log.text),
      ),
      "the worker must stream each log entry before the final result",
    );
    assert.equal(typeof result.durationMs, "number");
    assert.equal(result.truncated, false);
  } finally {
    await host.terminate();
  }
});

test("the cell worker relays API callbacks through the iframe", async () => {
  const host = new CellWorkerHost((message, workerHost) => {
    const encoded = message.args[1][0];
    assert.equal(typeof encoded.__callback, "number");
    workerHost.worker.postMessage({
      type: "cell-callback",
      id: encoded.__callback,
      args: ["from-host"],
    });
    workerHost.worker.postMessage({
      type: "cell-rpc-result",
      id: message.id,
      ok: true,
      value: true,
    });
  });
  try {
    const result = await withDeadline(
      host.run(`
        await redux.withCallback((value) => console.log("callback", value));
        return { done: true };
      `),
      5_000,
      "callback cell",
    );

    assert.equal(result.ok, true);
    assert.deepEqual(result.value, { done: true });
    assert.equal(result.logs.at(-1)?.text, "callback from-host");
  } finally {
    await host.terminate();
  }
});

test("the cell worker reports thrown errors with their stack", async () => {
  const host = new CellWorkerHost();
  try {
    const result = await withDeadline(host.run('throw new Error("boom");'), 5_000, "failing cell");

    assert.equal(result.ok, false);
    assert.equal(result.error.name, "Error");
    assert.equal(result.error.message, "boom");
    assert.match(result.error.stack, /redux-cell-test\.js/);
  } finally {
    await host.terminate();
  }
});

test("an infinite loop is terminated and the host can run another cell", async () => {
  const host = new CellWorkerHost();
  try {
    const looping = host.run("while (true) {}");
    let settled = false;
    void looping.then(() => {
      settled = true;
    });
    await new Promise((resolve) => setTimeout(resolve, 150));
    assert.equal(settled, false, "the infinite cell must not resolve on its own");

    const started = Date.now();
    await withDeadline(host.terminate(), 5_000, "worker termination");
    assert.ok(Date.now() - started < 5_000);
    assert.equal(settled, false, "termination must not fabricate a result");

    host.spawn();
    const result = await withDeadline(
      host.run("return { recovered: true };"),
      5_000,
      "cell after termination",
    );
    assert.equal(result.ok, true);
    assert.deepEqual(result.value, { recovered: true });
  } finally {
    await host.terminate();
  }
});

test("an endless microtask chain is also terminated", async () => {
  const host = new CellWorkerHost();
  try {
    const looping = host.run("const spin = () => Promise.resolve().then(spin); await spin();");
    let settled = false;
    void looping.then(() => {
      settled = true;
    });
    await new Promise((resolve) => setTimeout(resolve, 150));
    assert.equal(settled, false, "the microtask cell must not resolve on its own");

    await withDeadline(host.terminate(), 5_000, "microtask worker termination");
    assert.equal(settled, false, "termination must not fabricate a result");

    host.spawn();
    const result = await withDeadline(
      host.run("return { recovered: true };"),
      5_000,
      "cell after microtask termination",
    );
    assert.equal(result.ok, true);
    assert.deepEqual(result.value, { recovered: true });
  } finally {
    await host.terminate();
  }
});

test("the cell worker removes timers, nested workers, and the raw bridge", async () => {
  const host = new CellWorkerHost();
  try {
    const result = await withDeadline(
      host.run(`
        const attempt = (run) => {
          try {
            run();
            return "allowed";
          } catch (error) {
            return error.message;
          }
        };
        return {
          timer: attempt(() => setTimeout(() => {}, 1)),
          worker: attempt(() => new Worker("data:text/javascript,")),
          postMessage: attempt(() => postMessage({ type: "cell-result", ok: true })),
          windowType: typeof window,
          documentType: typeof document,
          tauriInternalsType: typeof globalThis.__TAURI_INTERNALS__,
          ipcType: typeof globalThis.ipc,
          chromeType: typeof globalThis.chrome,
        };
      `),
      5_000,
      "restricted globals",
    );

    assert.equal(result.ok, true);
    assert.match(result.value.timer, /Global timers/);
    assert.match(result.value.worker, /Nested workers/);
    assert.match(result.value.postMessage, /bridge is not available/);
    assert.equal(result.value.windowType, "undefined");
    assert.equal(result.value.documentType, "undefined");
    assert.equal(result.value.tauriInternalsType, "undefined");
    assert.equal(result.value.ipcType, "undefined");
    assert.equal(result.value.chromeType, "undefined");
  } finally {
    await host.terminate();
  }
});
