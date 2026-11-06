/**
 * External-resource consent contract: what can be granted, how the list is
 * truncated, when the prompt runs, and the single authorized reopen per session.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { createChart } from "../../../core/global/chart/chart.ts";
import { TauriDocumentStore } from "../../../core/platform/desktop/documentStore.ts";
import {
  createExternalResourceAuthorizationHistory,
  isAuthorizableExternalResource,
  MAX_EXTERNAL_RESOURCE_PATH_LENGTH,
  reviewRejectedExternalResources,
  settleRejectedExternalResources,
  truncateExternalResourcePath,
} from "../../../frontend/screens/editor/workspace/document/open/externalResourceReview.ts";

/** Minimal opened result carrying the host's rejected-reference list. */
function opened(path, rejected) {
  return {
    candidate: {
      chart: {},
      name: "chart.json",
      desktop: {
        id: `document-${path}`,
        path,
        chart_name: "chart.json",
        entries: [],
        ...(rejected ? { rejected_external_resources: rejected } : {}),
      },
    },
    assets: new Map(),
    task: {},
  };
}

test("absolute external references are grantable and relative escapes are not", () => {
  assert.equal(isAuthorizableExternalResource("D:/shared/audio/fx.ogg"), true);
  assert.equal(isAuthorizableExternalResource("C:\\media\\bg.png"), true);
  assert.equal(isAuthorizableExternalResource("//server/share/song.ogg"), true);
  assert.equal(isAuthorizableExternalResource("/root/song.ogg"), true);
  assert.equal(isAuthorizableExternalResource("../secret.png"), false);
  assert.equal(isAuthorizableExternalResource("assets/../secret.png"), false);
  assert.equal(isAuthorizableExternalResource("D:relative.png"), false);
  assert.equal(isAuthorizableExternalResource("name:stream"), false);
  assert.equal(isAuthorizableExternalResource(""), false);
});

test("the review deduplicates names, splits them by grant policy, and truncates the list", () => {
  const review = reviewRejectedExternalResources([
    "D:/shared/audio/fx.ogg",
    "C:\\media\\bg.png",
    "//server/share/song.ogg",
    "/root/cover.png",
    "../secret.png",
    "assets/../secret.png",
    "D:relative.png",
    "name:stream",
    "D:/shared/audio/fx.ogg",
  ]);

  assert.equal(review.total, 8);
  assert.equal(review.authorizable.length, 4);
  assert.equal(review.nonAuthorizable.length, 4);
  assert.deepEqual(review.visible, [
    "D:/shared/audio/fx.ogg",
    "C:\\media\\bg.png",
    "//server/share/song.ogg",
    "/root/cover.png",
    "../secret.png",
  ]);
  assert.equal(review.hiddenCount, 3);
});

test("long paths keep their prefix and file name inside the prompt limit", () => {
  const long = `D:/${"nested/".repeat(20)}fx.ogg`;
  const truncated = truncateExternalResourcePath(long);
  assert.equal(truncated.length, MAX_EXTERNAL_RESOURCE_PATH_LENGTH);
  assert.ok(truncated.startsWith("D:/nested/"));
  assert.ok(truncated.endsWith("fx.ogg"));
  assert.match(truncated, /…/);
  assert.equal(truncateExternalResourcePath("D:/short.ogg"), "D:/short.ogg");
});

test("authorization history treats separators and case as the same document", () => {
  const history = createExternalResourceAuthorizationHistory();
  assert.equal(history.hasAttempted("C:\\Charts\\Song.json"), false);
  history.markAttempted("C:\\Charts\\Song.json");
  assert.equal(history.hasAttempted("c:/charts/SONG.json"), true);
  assert.equal(history.hasAttempted("C:/charts/other.json"), false);
});

test("a clean open never asks or reopens", async () => {
  const history = createExternalResourceAuthorizationHistory();
  const result = await settleRejectedExternalResources(
    "D:/charts/a.json",
    opened("D:/charts/a.json"),
    history,
    {
      confirm: async () => {
        throw new Error("must not ask");
      },
      notifyUnavailable: () => {
        throw new Error("must not notify");
      },
      reopen: async () => {
        throw new Error("must not reopen");
      },
    },
  );

  assert.equal(result.candidate.desktop.rejected_external_resources, undefined);
});

test("only relative escapes are reported without offering a grant", async () => {
  const path = "D:/charts/a.json";
  const first = opened(path, ["../secret.png", "assets/../secret.png"]);
  const notices = [];
  let confirmations = 0;
  let reopens = 0;

  const result = await settleRejectedExternalResources(
    path,
    first,
    createExternalResourceAuthorizationHistory(),
    {
      confirm: async () => {
        confirmations++;
        return true;
      },
      notifyUnavailable: (review) => notices.push(review),
      reopen: async () => {
        reopens++;
        return opened(path);
      },
    },
  );

  assert.equal(result, first);
  assert.equal(confirmations, 0);
  assert.equal(reopens, 0);
  assert.equal(notices.length, 1);
  assert.equal(notices[0].nonAuthorizable.length, 2);
});

test("confirming reopens the same document once with the grant", async () => {
  const path = "D:/charts/a.json";
  const first = opened(path, ["D:/shared/audio/fx.ogg", "../secret.png"]);
  const reopened = opened(path);
  const history = createExternalResourceAuthorizationHistory();
  const notices = [];
  let confirmations = 0;
  let reopens = 0;
  const ports = {
    confirm: async () => {
      confirmations++;
      return true;
    },
    notifyUnavailable: (review) => notices.push(review),
    reopen: async (target) => {
      reopens++;
      assert.equal(target, path);
      return reopened;
    },
  };

  const result = await settleRejectedExternalResources(path, first, history, ports);
  assert.equal(result, reopened);
  assert.equal(confirmations, 1);
  assert.equal(reopens, 1);
  assert.equal(notices.length, 0);

  // A later reopen of the same path in this session must not prompt again,
  // even when a grantable-looking reference is still reported.
  const again = opened(path, ["D:/shared/audio/fx.ogg"]);
  const second = await settleRejectedExternalResources(path, again, history, ports);
  assert.equal(second, again);
  assert.equal(confirmations, 1);
  assert.equal(reopens, 1);
});

test("a reopen that leaves only relative escapes reports them and stops", async () => {
  const path = "D:/charts/a.json";
  const first = opened(path, ["D:/shared/audio/fx.ogg"]);
  const reopened = opened(path, ["../secret.png"]);
  const notices = [];
  const history = createExternalResourceAuthorizationHistory();

  const result = await settleRejectedExternalResources(path, first, history, {
    confirm: async () => true,
    notifyUnavailable: (review) => notices.push(review),
    reopen: async () => reopened,
  });

  assert.equal(result, reopened);
  assert.equal(notices.length, 1);
  assert.equal(notices[0].total, 1);
  assert.deepEqual(notices[0].nonAuthorizable, ["../secret.png"]);
});

test("declining keeps the initial open and writes no authorization", async () => {
  const path = "D:/charts/a.json";
  const first = opened(path, ["D:/shared/audio/fx.ogg"]);
  const history = createExternalResourceAuthorizationHistory();
  let reopens = 0;
  let notices = 0;

  const result = await settleRejectedExternalResources(path, first, history, {
    confirm: async () => false,
    notifyUnavailable: () => {
      notices++;
    },
    reopen: async () => {
      reopens++;
      return opened(path);
    },
  });

  assert.equal(result, first);
  assert.equal(reopens, 0);
  assert.equal(notices, 0);
  assert.equal(history.hasAttempted(path), false);
});

/** Capture native calls and drive the chart channel to completion. */
function captureOpenBridge() {
  const calls = [];
  let nextCallback = 0;
  const previousWindow = globalThis.window;
  globalThis.window = {
    __TAURI_INTERNALS__: {
      invoke: async (command, args) => {
        calls.push({ command, args });
        if (command === "close_document") {
          return null;
        }
        if (command !== "open_document") {
          throw new Error(`unexpected command ${command}`);
        }
        queueMicrotask(() => args.onChart.onmessage({ kind: "done" }));
        return {
          id: `document-${calls.length}`,
          path: args.path,
          chart_name: "chart.json",
          chart: createChart(),
          entries: [],
          packed: false,
          disk_snapshot: "snapshot",
        };
      },
      transformCallback: () => ++nextCallback,
      unregisterCallback: () => undefined,
    },
  };
  return {
    calls,
    restore: () => {
      globalThis.window = previousWindow;
    },
  };
}

test("the store forwards allowExternalResources to the native open command", async () => {
  const bridge = captureOpenBridge();
  try {
    const store = new TauriDocumentStore();
    await store.open("D:/charts/a.json", { allowExternalResources: true });
    await store.open("D:/charts/b.json");

    const opens = bridge.calls.filter((call) => call.command === "open_document");
    assert.equal(opens.length, 2);
    assert.equal(opens[0].args.path, "D:/charts/a.json");
    assert.equal(opens[0].args.allowExternalResources, true);
    assert.equal(opens[1].args.path, "D:/charts/b.json");
    assert.equal(opens[1].args.allowExternalResources, false);
  } finally {
    bridge.restore();
  }
});
