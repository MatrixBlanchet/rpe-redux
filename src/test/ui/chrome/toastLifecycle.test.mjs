/**
 * Notice lifetime rules: bounded auto-dismiss, manual closure, keyed merging,
 * and the row cap. The pure module keeps these decisions out of the DOM host.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  TOAST_MAX_ROWS,
  dismissToastRow,
  dueToasts,
  expireToasts,
  insertToast,
  isToastExpired,
  toastDuration,
} from "../../../design/patterns/toastLifecycle.ts";

/** Builds one lifecycle row with explicit fields for a test scenario. */
function row(overrides = {}) {
  return {
    id: 1,
    key: "asset:smoke.png",
    level: "warning",
    duration: toastDuration("warning"),
    startedAt: 1000,
    closable: true,
    ...overrides,
  };
}

test("ordinary and warning notices expire between six and eight seconds", () => {
  assert.ok(toastDuration("success") >= 6000 && toastDuration("success") <= 8000);
  assert.ok(toastDuration("info") >= 6000 && toastDuration("info") <= 8000);
  assert.ok(toastDuration("warning") >= 6000 && toastDuration("warning") <= 8000);
  assert.ok(toastDuration("error") > toastDuration("warning"));
});

test("a warning row is removed only after its lifetime", () => {
  const notice = row();
  assert.equal(isToastExpired(notice, notice.startedAt + notice.duration - 1), false);
  assert.equal(isToastExpired(notice, notice.startedAt + notice.duration), true);

  const early = expireToasts([notice], notice.startedAt + notice.duration - 1);
  assert.equal(early.rows.length, 1);
  assert.equal(early.expired.length, 0);

  const late = expireToasts([notice], notice.startedAt + notice.duration);
  assert.equal(late.rows.length, 0);
  assert.deepEqual(
    late.expired.map((item) => item.id),
    [notice.id],
  );
});

test("every row is closable and manual dismissal removes it", () => {
  const first = row({ id: 1 });
  const second = row({ id: 2, key: "asset:other.png", level: "error" });
  const inserted = insertToast([first], second);
  assert.equal(inserted.row.closable, true);

  const closed = dismissToastRow([first, second], first.id);
  assert.equal(closed.removed?.id, first.id);
  assert.deepEqual(
    closed.rows.map((item) => item.id),
    [second.id],
  );
});

test("sticky rows do not expire until the user closes them", () => {
  const sticky = row({ duration: 0 });
  assert.equal(isToastExpired(sticky, Number.MAX_SAFE_INTEGER), false);
  assert.equal(expireToasts([sticky], Number.MAX_SAFE_INTEGER).expired.length, 0);
  assert.equal(dismissToastRow([sticky], sticky.id).rows.length, 0);
});

test("the same key merges instead of stacking and keeps its first lifetime", () => {
  const first = insertToast([], row({ id: 1, message: "first" }));
  const merged = insertToast(first.rows, row({ id: 2, message: "second", startedAt: 4500 }));

  assert.equal(merged.merged, true);
  assert.equal(merged.rows.length, 1);
  assert.equal(merged.row.id, first.row.id);
  assert.equal(merged.row.message, "second");
  // The repeated notice must not reset the first appearance's expiry.
  assert.equal(merged.row.startedAt, first.row.startedAt);
  assert.equal(merged.row.duration, first.row.duration);

  const beforeFirstExpiry = expireToasts(merged.rows, first.row.startedAt + first.row.duration - 1);
  assert.equal(beforeFirstExpiry.rows.length, 1);
  const atFirstExpiry = expireToasts(merged.rows, first.row.startedAt + first.row.duration);
  assert.equal(atFirstExpiry.expired.length, 1);
});

test("unkeyed notices still append, and the oldest yields at the cap", () => {
  let rows = [];
  for (let id = 1; id <= TOAST_MAX_ROWS + 1; id += 1) {
    const result = insertToast(rows, row({ id, key: undefined, level: "success" }));
    rows = result.rows;
    if (id > TOAST_MAX_ROWS) {
      assert.deepEqual(
        result.evicted.map((item) => item.id),
        [1],
      );
    }
  }
  assert.equal(rows.length, TOAST_MAX_ROWS);
  assert.deepEqual(
    rows.map((item) => item.id),
    [2, 3, 4],
  );
});

test("a merged notice stays visible without restarting its timer", () => {
  const first = row({ id: 1, duration: 8000, startedAt: 1000 });
  const inserted = insertToast([first], row({ id: 2, duration: 8000, startedAt: 6000 }));
  assert.equal(inserted.merged, true);
  assert.deepEqual(
    dueToasts(inserted.rows, 9000).map((item) => item.id),
    [1],
  );
});
