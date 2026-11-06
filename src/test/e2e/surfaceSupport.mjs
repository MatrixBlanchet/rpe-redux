/**
 * Shared surface helpers for the P0 workspace journey: real CDP input, rail
 * animation sampling, drawer geometry, and drawer activation checks.
 *
 * These helpers assert only structural shell behavior, so another journey can
 * reuse them without importing the workspace scenario itself.
 */

const DRAWER_REST_WIDTH = 400;
const DRAWER_LIST_WIDTH = 240;
const DRAWER_EXPANDED_WIDTH = DRAWER_REST_WIDTH + DRAWER_LIST_WIDTH;

/** True when a measured length is within one CSS pixel of its target. */
export function near(value, target, tolerance = 1) {
  return typeof value === "number" && Math.abs(value - target) <= tolerance;
}

/** Reads the compact rail's open class, width, viewport rect, and elevation. */
export async function railState(runner) {
  return runner.evaluate(`(() => {
    const node = document.querySelector('.workbench .sidebar');
    if (!node) return null;
    const rect = node.getBoundingClientRect();
    const style = getComputedStyle(node);
    return {
      open: node.classList.contains('is-open'),
      width: rect.width,
      left: rect.left,
      top: rect.top,
      height: rect.height,
      right: rect.right,
      shadow: style.boxShadow,
      overlayShadow: style.getPropertyValue('--shadow-overlay-panel').trim(),
    };
  })()`);
}

/**
 * Reads the frame boxes the compact rail must not move.
 *
 * The rail sits in its own grid track, so the inspector column and both
 * workspace surfaces keep the same left edge and width at every pointer state.
 */
export async function frameGeometry(runner) {
  return runner.evaluate(`(() => {
    const rect = (selector) => {
      const box = document.querySelector(selector)?.getBoundingClientRect();
      return box
        ? { left: box.left, right: box.right, top: box.top, width: box.width, height: box.height }
        : null;
    };
    const sidebar = document.querySelector('.workbench .sidebar');
    return {
      sidebar: rect('.workbench .sidebar'),
      inspector: rect('#inspector'),
      inspectorColumn: rect('.workbench-inspector'),
      workspace: rect('.workbench-workspace'),
      stage: rect('#stage'),
      timeline: rect('.workbench-workspace .canvases'),
      sidebarShadow: sidebar ? getComputedStyle(sidebar).boxShadow : '',
    };
  })()`);
}

/**
 * Reads the home library split and its two action groups.
 *
 * Equal columns are checked from the computed track list, not a viewport
 * constant. Action groups are compared by the shared `redux-button-lg` class
 * and by measured height so the layout can move without pinning pixels.
 */
export async function homeLibraryLayout(runner) {
  return runner.evaluate(`(() => {
    const root = document.querySelector('.redux-welcome-columns');
    const style = root ? getComputedStyle(root) : null;
    const rect = (node) => {
      const box = node?.getBoundingClientRect();
      return box ? { left: box.left, top: box.top, width: box.width, height: box.height } : null;
    };
    const buttons = (selector) =>
      [...(root?.querySelectorAll(selector) ?? [])].map((node) => ({
        height: node.getBoundingClientRect().height,
        size: node.classList.contains('redux-button-lg'),
        solid: node.classList.contains('redux-button-solid'),
        danger: node.classList.contains('redux-button-danger'),
        outlined: node.classList.contains('redux-button-outlined'),
      }));
    const detail = root?.querySelector('.redux-library-detail');
    const side = root?.querySelector('.redux-welcome-side');
    return {
      layout: root?.dataset.layout ?? '',
      detailState: root?.dataset.detail ?? '',
      columns: style?.gridTemplateColumns ?? '',
      sideAlign: side ? getComputedStyle(side).alignSelf : '',
      detail: rect(detail),
      card: rect(root?.querySelector('.redux-library-card')),
      library: rect(root?.querySelector('.redux-welcome-library')),
      cardActions: buttons('.redux-library-card-actions .redux-button'),
      footerActions: buttons('.redux-library-actions .redux-library-action'),
    };
  })()`);
}

/** Moves the real pointer through CDP so React receives pointer enter and leave. */
export async function movePointer(runner, x, y) {
  await runner.command("Input.dispatchMouseEvent", {
    type: "mouseMoved",
    x,
    y,
    button: "none",
    buttons: 0,
  });
}

/** Presses and releases the real pointer at one viewport point. */
export async function clickPointer(runner, x, y, button = "left") {
  await runner.command("Input.dispatchMouseEvent", {
    type: "mousePressed",
    x,
    y,
    button,
    buttons: button === "right" ? 2 : 1,
    clickCount: 1,
  });
  await runner.command("Input.dispatchMouseEvent", {
    type: "mouseReleased",
    x,
    y,
    button,
    buttons: 0,
    clickCount: 1,
  });
}

/** Presses one key through CDP so focus and input modality change for real. */
export async function pressKey(runner, key, code, virtualKeyCode) {
  await runner.command("Input.dispatchKeyEvent", {
    type: "rawKeyDown",
    key,
    code,
    windowsVirtualKeyCode: virtualKeyCode,
    nativeVirtualKeyCode: virtualKeyCode,
  });
  await runner.command("Input.dispatchKeyEvent", {
    type: "keyUp",
    key,
    code,
    windowsVirtualKeyCode: virtualKeyCode,
    nativeVirtualKeyCode: virtualKeyCode,
  });
}

/** Returns the icon-slot point of one rail entry inside the visible 56px rail. */
export async function railEntryPoint(runner, selector) {
  return runner.evaluate(`(() => {
    const node = document.querySelector(${JSON.stringify(selector)});
    if (!node) return null;
    const rect = node.getBoundingClientRect();
    return { x: rect.right - 20, y: rect.top + rect.height / 2 };
  })()`);
}

export async function drawerPaneIds(runner) {
  return runner.evaluate(
    "[...document.querySelectorAll('.sidebar [data-drawer-pane]')].map((node) => node.dataset.drawerPane)",
  );
}

/**
 * Reads the SDK drawer selection beside the drawer mode the inspector paints.
 *
 * `selected` is the public `workspace.drawerPane()` value; `pane` and `split`
 * come from the rendered drawer, so a stale core selection fails the comparison.
 */
export async function drawerSdkState(runner) {
  return runner.evaluate(`(() => {
    const inspector = document.querySelector('#inspector');
    const split = inspector?.querySelector('.drawer-split');
    const page = split?.closest('[data-drawer-pane]');
    return {
      selected: window.redux.workspace.drawerPane(),
      open: inspector?.classList.contains('is-drawer') === true,
      pane: page?.dataset.drawerPane ?? '',
      split: Boolean(split),
    };
  })()`);
}

/** Reads the drawer's measured boxes and painted surfaces. */
export async function drawerGeometry(runner, pane) {
  return runner.evaluate(`(() => {
    const inspector = document.querySelector('#inspector');
    const drawer = inspector?.querySelector('[data-drawer-pane=${JSON.stringify(pane)}]');
    const list = drawer?.querySelector('.drawer-split-list');
    const properties = drawer?.querySelector('.drawer-split-properties');
    const header = inspector?.querySelector('.inspector-status');
    const stage = document.querySelector('.workbench-workspace');
    const rect = (node) => {
      const box = node?.getBoundingClientRect();
      return box
        ? { left: box.left, right: box.right, top: box.top, width: box.width, height: box.height }
        : null;
    };
    const background = (node) => (node ? getComputedStyle(node).backgroundColor : '');
    const computed = inspector ? getComputedStyle(inspector) : null;
    return {
      expanded: drawer?.classList.contains('is-expanded') ?? false,
      inspector: rect(inspector),
      list: rect(list),
      properties: rect(properties),
      header: rect(header),
      stage: rect(stage),
      shadow: computed?.boxShadow ?? '',
      edgeShadow: computed?.getPropertyValue('--drawer-edge-shadow').trim() ?? '',
      backgrounds: {
        inspector: background(inspector),
        list: background(list),
        properties: background(properties),
      },
    };
  })()`);
}

/** Returns a point inside the inspector body from one measured state. */
export function inspectorPointer(state) {
  return {
    x: state.inspector.left + 60,
    y: state.inspector.top + Math.min(80, state.inspector.height / 2),
  };
}

/** Opens one drawer page through its rail button and checks the inspector mode. */
export async function openDrawerPane(runner, pane) {
  await runner.evaluate(
    `document.querySelector('.sidebar [data-drawer-pane=${JSON.stringify(pane)}]')?.click(); true`,
  );
  await runner.waitFor(`drawer pane ${pane}`, () =>
    runner.evaluate(
      `Boolean(document.querySelector('#inspector.is-drawer [data-drawer-pane=${JSON.stringify(pane)}]'))`,
    ),
  );
  const identity = await runner.evaluate(`(() => {
    const inspector = document.querySelector('#inspector');
    const drawer = inspector?.querySelector('[data-drawer-pane=${JSON.stringify(pane)}]');
    return {
      header: inspector?.querySelector('.inspector-status-name')?.textContent?.trim() ?? '',
      icon: Boolean(inspector?.querySelector('.inspector-status-icon')),
      list: Boolean(drawer?.querySelector('.drawer-split-list')),
      detached: Boolean(document.querySelector('.drawer')),
    };
  })()`);
  runner.assert(
    identity.header.length > 0 && identity.icon,
    `drawer pane ${pane} needs a header name and icon: ${JSON.stringify(identity)}`,
  );
  runner.assert(
    identity.list,
    `drawer pane ${pane} did not render its list column: ${JSON.stringify(identity)}`,
  );
  runner.assert(
    !identity.detached,
    `drawer pane ${pane} must render inside the inspector, not a detached overlay`,
  );

  // A drawer page opens expanded and widens the inspector left from its track.
  await runner.waitFor(`drawer pane ${pane} expanded width`, async () => {
    const state = await drawerGeometry(runner, pane);
    return state.expanded && near(state.inspector?.width, DRAWER_EXPANDED_WIDTH);
  });
  await runner.waitFor(
    `drawer pane ${pane} edge elevation`,
    async () => {
      const state = await drawerGeometry(runner, pane);
      return state.shadow !== "none" && state.shadow.includes("-16px");
    },
    Date.now() + 2_000,
  );
  const expanded = await drawerGeometry(runner, pane);
  runner.assert(
    near(expanded.inspector?.width, DRAWER_EXPANDED_WIDTH),
    `drawer pane ${pane} did not widen the inspector: ${JSON.stringify(expanded)}`,
  );
  runner.assert(
    expanded.list !== null &&
      expanded.inspector !== null &&
      expanded.list.left >= expanded.inspector.left - 1 &&
      near(expanded.list.width, DRAWER_LIST_WIDTH),
    `drawer pane ${pane} did not expose the list column inside the inspector: ${JSON.stringify(expanded)}`,
  );
  runner.assert(
    near(expanded.properties?.width, DRAWER_REST_WIDTH),
    `drawer pane ${pane} narrowed the property column: ${JSON.stringify(expanded)}`,
  );
  runner.assert(
    expanded.header !== null &&
      expanded.inspector !== null &&
      near(expanded.header.width, expanded.inspector.width),
    `drawer pane ${pane} header does not span the inspector: ${JSON.stringify(expanded)}`,
  );
  runner.assert(
    expanded.backgrounds.list === expanded.backgrounds.inspector &&
      expanded.backgrounds.properties === expanded.backgrounds.inspector,
    `drawer pane ${pane} paints the list or properties unlike the inspector: ${JSON.stringify(expanded.backgrounds)}`,
  );
  runner.assert(
    expanded.shadow !== "none" &&
      expanded.shadow.includes("-16px") &&
      expanded.edgeShadow.includes("-16px"),
    `drawer pane ${pane} did not paint its edge elevation: ${JSON.stringify(expanded)}`,
  );

  // Leaving the whole frame collapses the panel and clips the list behind it.
  const expandedPoint = inspectorPointer(expanded);
  await movePointer(runner, expandedPoint.x, expandedPoint.y);
  await movePointer(runner, 2, 2);
  await runner.waitFor(`drawer pane ${pane} collapsed width`, async () => {
    const state = await drawerGeometry(runner, pane);
    return !state.expanded && near(state.inspector?.width, DRAWER_REST_WIDTH);
  });
  await runner.waitFor(
    `drawer pane ${pane} elevation cleared`,
    async () => {
      const state = await drawerGeometry(runner, pane);
      return state.shadow === "none";
    },
    Date.now() + 2_000,
  );
  const collapsed = await drawerGeometry(runner, pane);
  runner.assert(
    collapsed.inspector !== null &&
      collapsed.list !== null &&
      near(collapsed.inspector.width, DRAWER_REST_WIDTH) &&
      collapsed.list.left < collapsed.inspector.left - 1,
    `drawer pane ${pane} did not mask the list column when collapsed: ${JSON.stringify(collapsed)}`,
  );
  runner.assert(
    near(collapsed.stage?.width, expanded.stage?.width),
    `drawer pane ${pane} resized the stage on collapse: ${JSON.stringify({ expanded, collapsed })}`,
  );
  runner.assert(
    near(collapsed.inspector?.right, expanded.inspector?.right) &&
      near((expanded.inspector?.width ?? 0) - (collapsed.inspector?.width ?? 0), DRAWER_LIST_WIDTH),
    `drawer pane ${pane} moved instead of only widening the inspector: ${JSON.stringify({ expanded, collapsed })}`,
  );
  runner.assert(
    collapsed.shadow === "none",
    `drawer pane ${pane} kept its overlay elevation while collapsed: ${JSON.stringify(collapsed)}`,
  );

  // Entering the 400px inspector body again schedules the reveal.
  const collapsedPoint = inspectorPointer(collapsed);
  await movePointer(runner, collapsedPoint.x, collapsedPoint.y);
  await runner.waitFor(`drawer pane ${pane} pointer reveal`, async () => {
    const state = await drawerGeometry(runner, pane);
    return state.expanded && near(state.inspector?.width, DRAWER_EXPANDED_WIDTH);
  });
  const reopened = await drawerGeometry(runner, pane);
  runner.assert(
    reopened.list !== null &&
      reopened.inspector !== null &&
      reopened.list.left >= reopened.inspector.left - 1 &&
      near(reopened.inspector.width, DRAWER_EXPANDED_WIDTH),
    `drawer pane ${pane} did not reveal the list again on pointer entry: ${JSON.stringify(reopened)}`,
  );
  runner.assert(
    near(reopened.stage?.width, expanded.stage?.width),
    `drawer pane ${pane} resized the stage on reveal: ${JSON.stringify({ expanded, reopened })}`,
  );
}
