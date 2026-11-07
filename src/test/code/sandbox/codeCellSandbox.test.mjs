/**
 * The iframe half of the cell worker protocol: deadline enforcement, worker
 * termination, and reuse of the same sandbox for the next run.
 *
 * The checked-in `extension-sandbox.html` is evaluated in a Node VM with fake
 * timers, blob URLs, and a fake worker. This covers the actual watchdog code
 * without a browser; the worker itself is covered by `codeCellWorker.test.mjs`.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const HTML_URL = new URL("../../../public/extension-sandbox.html", import.meta.url);
const TOKEN = "cell-sandbox-token";

/** An event target with the subset of DOM listener methods the iframe uses. */
function eventTarget() {
  const listeners = new Map();
  return {
    addEventListener(type, listener) {
      const list = listeners.get(type) ?? [];
      list.push(listener);
      listeners.set(type, list);
    },
    removeEventListener(type, listener) {
      const list = listeners.get(type) ?? [];
      listeners.set(
        type,
        list.filter((entry) => entry !== listener),
      );
    },
    dispatch(type, event) {
      for (const listener of [...(listeners.get(type) ?? [])]) {
        listener(event);
      }
    },
  };
}

/** Load the iframe script into a VM with the browser seams it touches. */
async function createSandbox() {
  const html = await readFile(HTML_URL, "utf8");
  const source = html.toLowerCase();
  const openStart = source.indexOf("<script");
  const openEnd = source.indexOf(">", openStart);
  const closeStart = source.indexOf("</script", openEnd + 1);
  const closeEnd = source.indexOf(">", closeStart);
  const script =
    openStart >= 0 && openEnd >= 0 && closeStart > openEnd && closeEnd >= 0
      ? html.slice(openEnd + 1, closeStart)
      : undefined;
  assert.ok(script, "extension-sandbox.html must contain one script");

  const timers = new Map();
  let nextTimer = 1;
  const setTimeout = (callback, delay = 0) => {
    const id = nextTimer++;
    timers.set(id, { callback, delay });
    return id;
  };
  const clearTimeout = (id) => {
    timers.delete(id);
  };
  const advance = (ms) => {
    for (const [id, timer] of [...timers]) {
      if (timer.delay <= ms) {
        timers.delete(id);
        timer.callback();
      }
    }
  };

  const workers = [];
  class FakeWorker {
    constructor(url) {
      this.url = url;
      this.terminated = false;
      this.messages = [];
      workers.push(this);
    }

    postMessage(message) {
      this.messages.push(message);
    }

    terminate() {
      this.terminated = true;
    }
  }

  const blobs = [];
  let nextBlob = 1;
  class FakeUrl extends URL {
    static createObjectURL(blob) {
      blobs.push(blob);
      return `blob:cell-${nextBlob++}`;
    }

    static revokeObjectURL(url) {
      blobs.push({ revoked: url });
    }
  }

  const window = eventTarget();
  const navigation = eventTarget();
  const parent = { postMessage() {} };
  window.parent = parent;
  const toHost = [];
  const port = {
    onmessage: null,
    start() {},
    close() {},
    postMessage(message) {
      toHost.push(message);
    },
  };

  const context = vm.createContext({
    AbortController,
    Blob,
    Error,
    Map,
    Math,
    Object,
    Promise,
    Proxy,
    Set,
    String,
    TextEncoder,
    URL: FakeUrl,
    Worker: FakeWorker,
    clearTimeout,
    console,
    location: { href: `https://sandbox.test/extension-sandbox.html?token=${TOKEN}` },
    navigation,
    performance,
    setTimeout,
    window,
  });
  vm.runInContext(script, context, { filename: "extension-sandbox.html" });

  window.dispatch("message", {
    source: parent,
    data: { type: "redux-sandbox-init", token: TOKEN },
    ports: [port],
  });

  return {
    advance,
    navigation,
    port,
    toHost,
    workers,
    load(message) {
      port.onmessage({ data: message });
    },
  };
}

/** Build a cell-mode load message with the fields the iframe validates. */
function cellLoad(overrides = {}) {
  return {
    type: "load",
    mode: "cell",
    source: "const run = async () => 1; export default { activate: run };",
    workerSource: "self.onmessage = () => {};",
    manifest: { id: "cell.test", capabilities: [] },
    input: { value: 1 },
    version: "0.0.0",
    timeoutMs: 1_200,
    ...overrides,
  };
}

/** Strip the VM realm's prototypes before structural comparison. */
function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

test("the sandbox CSP permits blob workers but keeps the network closed", async () => {
  const html = await readFile(HTML_URL, "utf8");
  assert.match(html, /worker-src 'self' blob:/u);
  assert.match(html, /connect-src 'none'/u);
  assert.match(html, /child-src 'none'/u);
  assert.match(html, /frame-src 'none'/u);
  assert.match(html, /navigate-to 'none'/u);
});

test("the sandbox blocks a package navigation before it can leave the frame", async () => {
  const sandbox = await createSandbox();
  let prevented = false;
  sandbox.navigation.dispatch("navigate", {
    cancelable: true,
    preventDefault() {
      prevented = true;
    },
  });

  assert.equal(prevented, true);
  const failure = sandbox.toHost.findLast((message) => message.type === "failure");
  assert.equal(failure?.action, "sandbox.navigate");
  assert.match(failure?.error, /cannot navigate/u);
});

test("disposing the iframe twice is safe and keeps the worker stopped", async () => {
  const sandbox = await createSandbox();
  sandbox.load(cellLoad({ timeoutMs: 5_000 }));
  const worker = sandbox.workers.at(-1);
  assert.ok(worker);

  sandbox.port.onmessage({ data: { type: "dispose" } });
  sandbox.port.onmessage({ data: { type: "dispose" } });

  assert.equal(worker.terminated, true);
});

test("the iframe terminates a worker at the deadline and reports a timeout", async () => {
  const sandbox = await createSandbox();
  sandbox.load(cellLoad({ source: "while (true) {}" }));
  const worker = sandbox.workers.at(-1);
  assert.ok(worker, "the iframe must create a worker");
  assert.equal(worker.terminated, false);

  sandbox.advance(1_200);

  assert.equal(worker.terminated, true, "the timeout must terminate the worker");
  assert.deepEqual(plain(sandbox.toHost.at(-1)), {
    type: "cell-result",
    ok: false,
    logs: [],
    error: {
      name: "TimeoutError",
      message: "Code cell execution timed out after 1200 ms",
    },
    durationMs: 1_200,
    truncated: true,
  });
});

test("the iframe streams worker logs and includes them in a timeout result", async () => {
  const sandbox = await createSandbox();
  sandbox.load(
    cellLoad({ timeoutMs: 1_000, source: "console.log('before loop'); while (true) {}" }),
  );
  const worker = sandbox.workers.at(-1);
  assert.ok(worker);

  worker.onmessage({
    data: {
      type: "cell-log",
      log: { level: "log", text: "before loop", atMs: 5 },
    },
  });
  assert.deepEqual(plain(sandbox.toHost.at(-1)), {
    type: "cell-log",
    log: { level: "log", text: "before loop", atMs: 5 },
  });

  sandbox.advance(1_000);
  const result = sandbox.toHost.findLast((message) => message.type === "cell-result");
  assert.deepEqual(plain(result.logs), [{ level: "log", text: "before loop", atMs: 5 }]);
  assert.equal(worker.terminated, true);
});

test("the same iframe runs the next cell after a termination", async () => {
  const sandbox = await createSandbox();
  sandbox.load(cellLoad({ timeoutMs: 1_000 }));
  const first = sandbox.workers.at(-1);
  sandbox.advance(1_000);
  assert.equal(first.terminated, true);

  sandbox.load(
    cellLoad({
      source: "return 2;",
      timeoutMs: 1_000,
      input: { value: 2 },
    }),
  );
  const second = sandbox.workers.at(-1);
  assert.notEqual(second, first, "a new run must create a new worker");
  assert.equal(second.terminated, false);

  second.onmessage({
    data: {
      type: "cell-result",
      ok: true,
      value: { answer: 2 },
      logs: [{ level: "log", text: "second", atMs: 1 }],
      durationMs: 2,
      truncated: false,
    },
  });

  assert.deepEqual(plain(sandbox.toHost.at(-1)), {
    type: "cell-result",
    ok: true,
    value: { answer: 2 },
    logs: [{ level: "log", text: "second", atMs: 1 }],
    durationMs: 2,
    truncated: false,
  });
  assert.equal(
    second.terminated,
    true,
    "a completed worker must be released instead of left running",
  );
  sandbox.advance(1_000);
  assert.equal(
    sandbox.toHost.filter((message) => message.type === "cell-result").length,
    2,
    "a completed cell must not fire its deadline",
  );
});

test("the iframe forwards worker RPCs and maps callbacks to the host", async () => {
  const sandbox = await createSandbox();
  sandbox.load(cellLoad({ timeoutMs: 5_000 }));
  const worker = sandbox.workers.at(-1);

  worker.onmessage({
    data: {
      type: "cell-rpc",
      id: 7,
      method: "api.call",
      args: [[["selection", "subscribe"]], [{ __callback: 3 }]],
    },
  });
  const request = sandbox.toHost.at(-1);
  assert.equal(request.type, "rpc");
  assert.equal(request.method, "api.call");
  assert.equal(typeof request.id, "number");
  assert.equal(request.args[0][0].join("."), "selection.subscribe");
  assert.equal(typeof request.args[1][0].__callback, "number");

  // The host answers and then invokes the mapped callback.
  sandbox.port.onmessage({
    data: { type: "rpc-result", id: request.id, ok: true, value: { __disposer: "d1" } },
  });
  assert.deepEqual(plain(worker.messages.at(-1)), {
    type: "cell-rpc-result",
    id: 7,
    ok: true,
    value: { __disposer: "d1" },
  });

  const callbackId = request.args[1][0].__callback;
  sandbox.port.onmessage({ data: { type: "callback", id: callbackId, args: ["payload"] } });
  assert.deepEqual(plain(worker.messages.at(-1)), {
    type: "cell-callback",
    id: 3,
    args: ["payload"],
  });
});
