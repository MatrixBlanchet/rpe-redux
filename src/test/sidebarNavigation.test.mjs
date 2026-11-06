/** The rail merges drawer pages and inspector routes into one ordered list. */
import assert from "node:assert/strict";
import test from "node:test";
import { mergeSidebarNavigation } from "../frontend/chrome/sidebar/navigation.ts";

const pane = (id, order) => ({
  id,
  order,
  label: `${id} label`,
  icon: "grid",
  body: () => null,
});

const item = (id, order) => ({
  id,
  order,
  panelId: id,
  icon: { name: "help", label: `${id} label` },
  onActivate() {},
});

test("document pages keep their order and one separator closes the drawer band", () => {
  const merged = mergeSidebarNavigation(
    [
      { kind: "divider", id: "scripts.divider", order: 75 },
      item("history", 90),
      item("scripts", 80),
      item("metadata", 10),
    ],
    [pane("lines", 40), pane("timing", 30)],
  );
  assert.deepEqual(
    merged.map((entry) => entry.id),
    [
      "metadata",
      "drawer:timing",
      "drawer:lines",
      "drawer.boundary",
      "scripts.divider",
      "scripts",
      "history",
    ],
  );
  assert.equal(merged.find((entry) => entry.id === "drawer.boundary")?.kind, "divider");
});

test("a drawer entry keeps its pane id and sidebar trigger id", () => {
  const merged = mergeSidebarNavigation([], [pane("assets", 20)]);
  assert.deepEqual(
    merged.map((entry) => ({
      kind: entry.kind,
      drawerPaneId: entry.kind === "item" ? entry.drawerPaneId : undefined,
      domId: entry.kind === "item" ? entry.domId : undefined,
    })),
    [{ kind: "item", drawerPaneId: "assets", domId: "drawer-pane-assets" }],
  );
});
