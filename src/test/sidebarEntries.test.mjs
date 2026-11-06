/** Checks the standalone sidebar divider participates in ordering and cleanup. */
import assert from "node:assert/strict";
import test from "node:test";
import {
  getSidebarEntries,
  getSidebarEntry,
  getSidebarItems,
  registerSidebarDivider,
  registerSidebarItem,
  unregisterSidebarOwner,
} from "../core/shell/registries/sidebar.ts";

test("separate sidebar dividers are ordered without changing the item API", () => {
  const removePrevious = registerSidebarItem({
    id: "test.previous",
    order: 100,
    icon: { name: "help", label: "previous" },
    onActivate() {},
  });
  const removeItem = registerSidebarItem({
    id: "test.item",
    order: 120,
    icon: { name: "help", label: "test" },
    onActivate() {},
  });
  const removeDivider = registerSidebarDivider({ kind: "divider", id: "test.divider", order: 110 });
  try {
    assert.deepEqual(
      getSidebarEntries().map((entry) => entry.id),
      ["test.previous", "test.divider", "test.item"],
    );
    assert.deepEqual(
      getSidebarItems().map((entry) => entry.id),
      ["test.previous", "test.item"],
    );
    assert.equal(getSidebarEntries(), getSidebarEntries());
    assert.throws(() => registerSidebarDivider({ kind: "divider", id: "test.item", order: 130 }));
    removeItem();
    removeDivider();
    removePrevious();
    assert.equal(getSidebarEntries().length, 0);
  } finally {
    removeItem();
    removeDivider();
    removePrevious();
  }
});

test("a second owner cannot take an already registered sidebar id", () => {
  const remove = registerSidebarItem(
    {
      id: "test.owner.item",
      order: 100,
      icon: { name: "help", label: "First" },
      onActivate() {},
    },
    "owner-a",
  );
  try {
    assert.throws(
      () =>
        registerSidebarItem(
          {
            id: "test.owner.item",
            order: 200,
            icon: { name: "help", label: "Second" },
            onActivate() {},
          },
          "owner-b",
        ),
      /already registered/u,
    );
    assert.equal(getSidebarEntry("test.owner.item")?.icon.label, "First");
  } finally {
    remove();
  }
  assert.equal(getSidebarEntry("test.owner.item"), undefined);
});

test("owner cleanup removes only that owner's dividers", () => {
  const removeA = registerSidebarDivider(
    { kind: "divider", id: "test.owner.divider-a", order: 100 },
    "owner-a",
  );
  const removeB = registerSidebarDivider(
    { kind: "divider", id: "test.owner.divider-b", order: 110 },
    "owner-b",
  );
  try {
    unregisterSidebarOwner("owner-a");
    assert.equal(getSidebarEntry("test.owner.divider-a"), undefined);
    assert.equal(getSidebarEntry("test.owner.divider-b")?.id, "test.owner.divider-b");
  } finally {
    removeA();
    removeB();
    unregisterSidebarOwner("owner-a");
    unregisterSidebarOwner("owner-b");
  }
  assert.equal(getSidebarEntry("test.owner.divider-b"), undefined);
});
