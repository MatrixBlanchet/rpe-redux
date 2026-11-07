/**
 * Theme chrome recipes: closed preset parsing, legacy packages, bounded values,
 * and the built-in packages that ship the new contract.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import test from "node:test";
import {
  DEFAULT_THEME_CHROME,
  THEME_SCHEMA_VERSION,
  parseThemePackage,
} from "../../../core/theme/packages.ts";

const THEME_ROOT = resolve(import.meta.dirname, "../../..", "assets", "themes");

/** A minimal valid package document. */
function basePackage(overrides = {}) {
  return {
    schemaVersion: 2,
    kind: "theme",
    id: "test.theme",
    name: "Test theme",
    appearance: "dark",
    colors: { "--accent": "#a8c7fa" },
    ...overrides,
  };
}

test("a package without chrome keeps the documented defaults", () => {
  const parsed = parseThemePackage(basePackage(), "builtin");
  assert.ok(parsed);
  assert.deepEqual(parsed.chrome, DEFAULT_THEME_CHROME);
});

test("chrome accepts every documented preset group", () => {
  const parsed = parseThemePackage(
    basePackage({
      chrome: {
        layout: {
          density: "spacious",
          inspector: "floating",
          inspectorSide: "left",
          drawerSide: "right",
          sidebar: "top",
          toolbar: "floating",
          toolbarPlacement: "left",
          toolbarFlow: "grid",
          toolbarColumns: 3,
          toolbarOrder: ["toolbar.playback", "toolbar.line"],
          transport: "floating",
          transportAnchor: "bottom-left",
          transportDraggable: false,
          statusBar: "floating",
        },
        surface: {
          shape: "round",
          material: "glass",
          backdropBlur: 18,
          pattern: "dots",
          ambient: "aurora",
        },
        motion: {
          level: "expressive",
          speed: "fast",
          hover: "glow",
          entrance: "rise",
        },
        titlebar: {
          density: "compact",
          windowControls: "capsule",
          menu: "expanded",
        },
        metrics: {
          panelGap: 12,
          toolbarGap: 6,
          toolbarCell: 38,
          toolbarWidth: 240,
          inspectorWidth: 460,
          drawerListWidth: 280,
          sidebarWidth: 64,
          sidebarExpandedWidth: 240,
          titlebarHeight: 44,
          windowControlSize: 36,
          fieldControlWidth: 52,
          fieldGap: 20,
        },
      },
    }),
    "user",
  );

  assert.ok(parsed);
  assert.deepEqual(parsed.chrome, {
    layout: {
      density: "spacious",
      inspector: "floating",
      inspectorSide: "left",
      drawerSide: "right",
      sidebar: "top",
      toolbar: "floating",
      toolbarPlacement: "left",
      toolbarFlow: "grid",
      toolbarColumns: 3,
      toolbarOrder: ["toolbar.playback", "toolbar.line"],
      transport: "floating",
      transportAnchor: "bottom-left",
      transportDraggable: false,
      statusBar: "floating",
    },
    surface: {
      shape: "round",
      material: "glass",
      backdropBlur: 18,
      pattern: "dots",
      ambient: "aurora",
    },
    motion: {
      level: "expressive",
      speed: "fast",
      hover: "glow",
      entrance: "rise",
    },
    titlebar: {
      density: "compact",
      windowControls: "capsule",
      menu: "expanded",
    },
    metrics: {
      panelGap: 12,
      toolbarGap: 6,
      toolbarCell: 38,
      toolbarWidth: 240,
      inspectorWidth: 460,
      drawerListWidth: 280,
      sidebarWidth: 64,
      sidebarExpandedWidth: 240,
      titlebarHeight: 44,
      windowControlSize: 36,
      fieldControlWidth: 52,
      fieldGap: 20,
    },
  });
  assert.equal(parsed.schemaVersion, THEME_SCHEMA_VERSION);
});

test("frame metrics are bounded integers with a fixed vocabulary", () => {
  for (const [key, value] of [
    ["panelGap", -1],
    ["toolbarGap", 17],
    ["toolbarCell", 27],
    ["toolbarWidth", 199],
    ["inspectorWidth", 279],
    ["drawerListWidth", 159],
    ["drawerListWidth", 561],
    ["drawerListWidth", 240.5],
    ["drawerListWidth", "240"],
    ["sidebarWidth", 39],
    ["sidebarExpandedWidth", 159],
    ["titlebarHeight", 31],
    ["windowControlSize", 57],
    ["fieldControlWidth", 73],
    ["fieldGap", 7],
    ["fieldGap", 1.5],
    ["fieldGap", "16"],
  ]) {
    assert.equal(
      parseThemePackage(basePackage({ chrome: { metrics: { [key]: value } } }), "user"),
      null,
      `${key}=${value}`,
    );
  }
  assert.equal(
    parseThemePackage(basePackage({ chrome: { metrics: { unknown: 1 } } }), "user"),
    null,
  );
  const parsed = parseThemePackage(
    basePackage({ chrome: { metrics: { fieldControlWidth: 72, panelGap: 0 } } }),
    "user",
  );
  assert.equal(parsed?.chrome.metrics.fieldControlWidth, 72);
  assert.equal(parsed?.chrome.metrics.panelGap, 0);
  assert.equal(parsed?.chrome.metrics.toolbarCell, undefined);
  assert.equal(parsed?.chrome.metrics.drawerListWidth, undefined);
  for (const drawerListWidth of [160, 560]) {
    assert.equal(
      parseThemePackage(basePackage({ chrome: { metrics: { drawerListWidth } } }), "user")?.chrome
        .metrics.drawerListWidth,
      drawerListWidth,
    );
  }
});

test("toolbar order only accepts unique registered-id-shaped names", () => {
  assert.equal(
    parseThemePackage(
      basePackage({
        chrome: { layout: { toolbarOrder: ["toolbar.playback", "toolbar.playback"] } },
      }),
      "user",
    ),
    null,
  );
  assert.equal(
    parseThemePackage(basePackage({ chrome: { layout: { toolbarOrder: ["Bad Id"] } } }), "user"),
    null,
  );
  assert.equal(
    parseThemePackage(
      basePackage({ chrome: { layout: { toolbarOrder: Array(65).fill("toolbar.playback") } } }),
      "user",
    ),
    null,
  );
  const parsed = parseThemePackage(
    basePackage({
      chrome: { layout: { toolbarOrder: ["toolbar.playback", "toolbar.line"] } },
    }),
    "user",
  );
  assert.deepEqual(parsed?.chrome.layout.toolbarOrder, ["toolbar.playback", "toolbar.line"]);
});

test("title-bar presets and toolbar flow are closed enums", () => {
  assert.equal(
    parseThemePackage(basePackage({ chrome: { layout: { toolbarFlow: "carousel" } } }), "user"),
    null,
  );
  for (const value of [1, 5, 2.5, "2"]) {
    assert.equal(
      parseThemePackage(
        basePackage({ chrome: { layout: { toolbarFlow: "grid", toolbarColumns: value } } }),
        "user",
      ),
      null,
      String(value),
    );
  }
  assert.equal(
    parseThemePackage(basePackage({ chrome: { titlebar: { density: "huge" } } }), "user"),
    null,
  );
  assert.equal(
    parseThemePackage(basePackage({ chrome: { titlebar: { windowControls: "hidden" } } }), "user"),
    null,
  );
  assert.equal(
    parseThemePackage(basePackage({ chrome: { titlebar: { menu: "torn-off" } } }), "user"),
    null,
  );
  assert.equal(
    parseThemePackage(
      basePackage({
        chrome: {
          titlebar: {
            menu: "expanded",
            density: "tall",
            windowControls: "compact",
          },
        },
      }),
      "user",
    )?.chrome.titlebar.menu,
    "expanded",
  );
  const parsed = parseThemePackage(
    basePackage({
      chrome: {
        layout: { toolbarFlow: "single" },
        titlebar: { density: "tall", windowControls: "compact" },
      },
    }),
    "user",
  );
  assert.equal(parsed?.chrome.layout.toolbarFlow, "single");
  assert.equal(parsed?.chrome.titlebar.density, "tall");
  assert.equal(parsed?.chrome.titlebar.windowControls, "compact");
});

test("a partial chrome group keeps defaults for omitted fields", () => {
  const parsed = parseThemePackage(
    basePackage({ chrome: { layout: { inspector: "overlay" } } }),
    "user",
  );
  assert.ok(parsed);
  assert.equal(parsed.chrome.layout.inspector, "overlay");
  assert.equal(parsed.chrome.layout.density, DEFAULT_THEME_CHROME.layout.density);
  assert.equal(parsed.chrome.layout.drawerSide, "auto");
  assert.equal(parsed.chrome.layout.sidebar, DEFAULT_THEME_CHROME.layout.sidebar);
  assert.deepEqual(parsed.chrome.surface, DEFAULT_THEME_CHROME.surface);
  assert.deepEqual(parsed.chrome.motion, DEFAULT_THEME_CHROME.motion);
  assert.deepEqual(parsed.chrome.titlebar, DEFAULT_THEME_CHROME.titlebar);
  assert.deepEqual(parsed.chrome.metrics, DEFAULT_THEME_CHROME.metrics);
});

test("an unknown chrome key rejects the package", () => {
  assert.equal(
    parseThemePackage(basePackage({ chrome: { layout: { dock: "left" } } }), "user"),
    null,
  );
  assert.equal(parseThemePackage(basePackage({ chrome: { shadow: "huge" } }), "user"), null);
  assert.equal(parseThemePackage(basePackage({ chrome: [] }), "user"), null);
});

test("an unknown preset value rejects the package", () => {
  assert.equal(
    parseThemePackage(basePackage({ chrome: { layout: { inspector: "detached" } } }), "user"),
    null,
  );
  assert.equal(
    parseThemePackage(basePackage({ chrome: { motion: { level: "cinematic" } } }), "user"),
    null,
  );
  assert.equal(
    parseThemePackage(basePackage({ chrome: { surface: { material: "metal" } } }), "user"),
    null,
  );
  assert.equal(
    parseThemePackage(basePackage({ chrome: { layout: { toolbarPlacement: "right" } } }), "user"),
    null,
  );
  assert.equal(
    parseThemePackage(basePackage({ chrome: { layout: { transport: "window" } } }), "user"),
    null,
  );
  assert.equal(
    parseThemePackage(basePackage({ chrome: { layout: { transportAnchor: "center" } } }), "user"),
    null,
  );
  assert.equal(
    parseThemePackage(basePackage({ chrome: { layout: { transportDraggable: "yes" } } }), "user"),
    null,
  );
  assert.equal(
    parseThemePackage(basePackage({ chrome: { layout: { drawerSide: "up" } } }), "user"),
    null,
  );
});

test("the drawer side is a closed enum with an automatic default", () => {
  const fallback = parseThemePackage(basePackage(), "user");
  assert.equal(fallback?.chrome.layout.drawerSide, "auto");
  for (const drawerSide of ["auto", "left", "right"]) {
    assert.equal(
      parseThemePackage(basePackage({ chrome: { layout: { drawerSide } } }), "user")?.chrome.layout
        .drawerSide,
      drawerSide,
    );
  }
});

test("backdrop blur is a bounded integer", () => {
  for (const value of [-1, 25, 1.5, "12", Number.NaN]) {
    assert.equal(
      parseThemePackage(
        basePackage({ chrome: { surface: { material: "glass", backdropBlur: value } } }),
        "user",
      ),
      null,
    );
  }
  const parsed = parseThemePackage(
    basePackage({ chrome: { surface: { material: "glass", backdropBlur: 24 } } }),
    "user",
  );
  assert.equal(parsed?.chrome.surface.backdropBlur, 24);
});

test("legacy schema-one packages still load with defaults", () => {
  const parsed = parseThemePackage(basePackage({ schemaVersion: 1 }), "portable");
  assert.ok(parsed);
  assert.deepEqual(parsed.chrome, DEFAULT_THEME_CHROME);
});

test("metadata strings are bounded", () => {
  assert.equal(parseThemePackage(basePackage({ version: "v".repeat(201) }), "user"), null);
  assert.equal(parseThemePackage(basePackage({ author: "a".repeat(201) }), "user"), null);
});

test("color and icon collections are capped", () => {
  const colors = {};
  for (let index = 0; index <= 512; index += 1) {
    colors[`--extra-${index}`] = "#000000";
  }
  assert.equal(parseThemePackage(basePackage({ colors }), "user"), null);

  const icons = {};
  for (let index = 0; index <= 512; index += 1) {
    icons[`icon${index}`] = "icons/icon.png";
  }
  assert.equal(parseThemePackage(basePackage({ icons }), "user"), null);
});

test("a theme can declare a declarative slot and component tree", () => {
  const parsed = parseThemePackage(
    basePackage({
      ui: {
        slots: {
          "inspector.empty": {
            kind: "surface",
            variant: "glass",
            shape: "round",
            padding: "lg",
            gap: "md",
            children: [
              {
                kind: "text",
                text: { en: "Panels", zh: "闈㈡澘" },
                size: "heading",
                weight: "strong",
              },
              {
                kind: "repeat",
                items: "sidebarItems",
                columns: 2,
                gap: "sm",
                template: { kind: "action", variant: "plain", shape: "soft" },
              },
            ],
          },
        },
        components: {
          railItem: {
            kind: "stack",
            direction: "row",
            gap: "sm",
            align: "center",
            children: [
              { kind: "icon", bind: "icon", iconSize: "sm" },
              { kind: "text", bind: "label", size: "caption", when: "expanded" },
              { kind: "dot", tone: "accent", when: "hasStatus" },
            ],
          },
          menuTrigger: {
            kind: "stack",
            direction: "row",
            gap: "sm",
            align: "center",
            children: [
              { kind: "icon", bind: "icon", iconSize: "sm" },
              { kind: "text", bind: "label", size: "caption" },
            ],
          },
          windowControl: {
            kind: "stack",
            direction: "row",
            gap: "sm",
            align: "center",
            children: [{ kind: "icon", bind: "icon", iconSize: "sm" }],
          },
        },
      },
    }),
    "user",
  );
  assert.ok(parsed);
  assert.equal(parsed.ui.slots["inspector.empty"]?.kind, "surface");
  assert.equal(parsed.ui.components.railItem?.kind, "stack");
  assert.equal(parsed.ui.components.menuTrigger?.kind, "stack");
  assert.equal(parsed.ui.components.windowControl?.kind, "stack");
});

test("unknown UI slots, components, node kinds, and node props reject the package", () => {
  assert.equal(
    parseThemePackage(
      basePackage({ ui: { slots: { "titlebar.unknown": { kind: "text", text: "Unknown" } } } }),
      "user",
    ),
    null,
  );
  assert.equal(
    parseThemePackage(
      basePackage({ ui: { components: { button: { kind: "text", text: "Go" } } } }),
      "user",
    ),
    null,
  );
  assert.equal(
    parseThemePackage(
      basePackage({ ui: { slots: { "inspector.empty": { kind: "html", text: "No" } } } }),
      "user",
    ),
    null,
  );
  assert.equal(
    parseThemePackage(
      basePackage({
        ui: {
          slots: {
            "inspector.empty": { kind: "stack", className: "evil", children: [] },
          },
        },
      }),
      "user",
    ),
    null,
  );
});

test("a component template cannot invent its label, icon, or actions", () => {
  assert.equal(
    parseThemePackage(
      basePackage({
        ui: { components: { railItem: { kind: "action", variant: "solid" } } },
      }),
      "user",
    ),
    null,
  );
  assert.equal(
    parseThemePackage(
      basePackage({
        ui: { components: { railItem: { kind: "text", text: "Fake label" } } },
      }),
      "user",
    ),
    null,
  );
  assert.equal(
    parseThemePackage(
      basePackage({
        ui: { components: { railItem: { kind: "icon", icon: "shield" } } },
      }),
      "user",
    ),
    null,
  );
});

test("critical chrome anatomies keep an unconditional bound label or icon", () => {
  for (const [id, tree] of [
    ["windowControl", { kind: "dot", tone: "accent" }],
    ["windowControl", { kind: "spacer" }],
    ["menuTrigger", { kind: "dot", tone: "accent" }],
    ["menuTrigger", { kind: "icon", bind: "icon", when: "active" }],
  ]) {
    assert.equal(
      parseThemePackage(basePackage({ ui: { components: { [id]: tree } } }), "user"),
      null,
      id,
    );
  }
  const parsed = parseThemePackage(
    basePackage({
      ui: {
        components: {
          menuTrigger: { kind: "icon", bind: "icon" },
          windowControl: { kind: "text", bind: "label" },
        },
      },
    }),
    "user",
  );
  assert.ok(parsed);
});

test("a repeat needs a template and a valid column count", () => {
  assert.equal(
    parseThemePackage(
      basePackage({
        ui: {
          slots: {
            "inspector.empty": { kind: "repeat", items: "sidebarItems" },
          },
        },
      }),
      "user",
    ),
    null,
  );
  assert.equal(
    parseThemePackage(
      basePackage({
        ui: {
          slots: {
            "inspector.empty": {
              kind: "repeat",
              items: "sidebarItems",
              template: { kind: "text", text: "Item" },
              columns: 5,
            },
          },
        },
      }),
      "user",
    ),
    null,
  );
});

test("theme UI cannot invent an action outside a registered-item repeat", () => {
  assert.equal(
    parseThemePackage(
      basePackage({
        ui: {
          slots: {
            "inspector.empty": { kind: "action", variant: "solid" },
          },
        },
      }),
      "user",
    ),
    null,
  );
  assert.equal(
    parseThemePackage(
      basePackage({
        ui: {
          slots: {
            "inspector.empty": {
              kind: "repeat",
              items: "sidebarItems",
              template: { kind: "action", text: "Fake command" },
            },
          },
        },
      }),
      "user",
    ),
    null,
  );
  assert.equal(
    parseThemePackage(
      basePackage({
        ui: {
          slots: {
            "inspector.empty": {
              kind: "repeat",
              items: "sidebarItems",
              template: {
                kind: "repeat",
                items: "sidebarItems",
                template: { kind: "text", text: "Nested" },
              },
            },
          },
        },
      }),
      "user",
    ),
    null,
  );
});

test("theme packages cannot carry Extension code or capability fields", () => {
  for (const extra of [
    { entry: "index.js" },
    { activate() {} },
    { scripts: [] },
    { capabilities: ["ui.panel"] },
    { dependencies: ["other"] },
    { engines: { "rpe-redux": 1 } },
  ]) {
    assert.equal(parseThemePackage(basePackage(extra), "user"), null);
  }
  assert.equal(parseThemePackage(basePackage({ kind: "extension" }), "user"), null);
});

test("the colour channel only accepts the published token vocabulary", () => {
  assert.equal(
    parseThemePackage(basePackage({ colors: { "--inspector-width": "transparent" } }), "user"),
    null,
  );
  assert.equal(
    parseThemePackage(
      basePackage({ colors: { "--action-foreground-resting": "#000000" } }),
      "user",
    ),
    null,
  );
  const parsed = parseThemePackage(
    basePackage({
      colors: { "--accent": "#a8c7fa", "--on-accent-hover": "#000000" },
    }),
    "user",
  );
  assert.ok(parsed);
  assert.equal(parsed.colors["--on-accent-hover"], "#000000");
});

test("total glyph data is bounded", () => {
  const glyph = "data:image/png;base64,iVBORw0KGgo" + "A".repeat(500 * 1024);
  const icons = {};
  for (let index = 0; index < 9; index += 1) {
    icons[`icon${index}`] = glyph;
  }
  assert.equal(parseThemePackage(basePackage({ icons }), "user"), null);
});

test("a PNG data URL cannot break out of the icon URL", () => {
  const parsed = parseThemePackage(
    basePackage({
      icons: {
        evil: 'data:image/png;base64,iVBORw0KGgo");background:red',
      },
    }),
    "user",
  );
  assert.ok(parsed);
  assert.deepEqual({ ...parsed.icons }, {});
});

test("remote and script-capable glyph sources are still ignored", () => {
  const parsed = parseThemePackage(
    basePackage({
      icons: {
        remote: "https://example.com/icon.png",
        svg: "data:image/svg+xml;base64,PHN2Zy8+",
        local: "icons/local.png",
      },
    }),
    "user",
  );
  assert.ok(parsed);
  assert.deepEqual({ ...parsed.icons }, { local: "icons/local.png" });
});

test("every built-in theme package parses", () => {
  const ids = [];
  for (const entry of readdirSync(THEME_ROOT, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue;
    }
    const document = JSON.parse(readFileSync(join(THEME_ROOT, entry.name, "package.json"), "utf8"));
    const parsed = parseThemePackage(document, "builtin");
    assert.ok(parsed, `${entry.name} must parse`);
    ids.push(parsed.id);
  }
  assert.deepEqual(ids.sort(), ["dark", "light"]);
});
