/**
 * P0 settings smoke: the window opens, every registered page renders content,
 * navigation marks the chosen category, and the dialog closes and reopens.
 *
 * Page-specific behaviour belongs to unit suites; this check proves the
 * registry-to-surface path works in a packaged run without pinning individual
 * setting keys or shortcut bindings.
 */
export async function settingsSmoke(runner) {
  const opened = await runner.callApi("window.redux.settings.open()");
  runner.assert(opened === true, "settings command was not handled");
  await runner.waitFor("settings dialog", () =>
    runner.evaluate("Boolean(document.querySelector('dialog.redux-settings[open]'))"),
  );

  const pages = await runner.evaluate(`(() => {
    return [...document.querySelectorAll('[data-settings-section]')].map((section) => ({
      id: section.dataset.settingsSection,
      hidden: section.hidden,
      text: (section.textContent ?? '').trim().length,
      elements: section.querySelectorAll('*').length,
    }));
  })()`);
  runner.assert(pages.length > 0, "settings registry produced no pages");
  for (const page of pages) {
    runner.assert(
      page.id && !page.hidden && page.text > 0 && page.elements > 0,
      `settings page is empty: ${JSON.stringify(page)}`,
    );
  }

  const target = await runner.evaluate(`(() => {
    const sections = new Set(
      [...document.querySelectorAll('[data-settings-section]')]
        .filter((section) => !section.hidden && (section.textContent ?? '').trim().length > 0)
        .map((section) => section.dataset.settingsSection),
    );
    const item = [...document.querySelectorAll('.redux-settings-nav-item[data-category]')].find(
      (node) => !node.hasAttribute('aria-expanded') && sections.has(node.dataset.category),
    );
    if (!item) return null;
    item.click();
    return item.dataset.category;
  })()`);
  runner.assert(Boolean(target), "settings navigation has no selectable page");
  await runner.waitFor("settings navigation selection", () =>
    runner.evaluate(
      `document.querySelector('.redux-settings-nav-item[data-category=${JSON.stringify(target)}]')?.getAttribute('aria-current') === 'true'`,
    ),
  );

  // A tip opened from inside a modal must join the top layer above the dialog's
  // z-index, and the next modal-stack change must dismiss it instead of leaving
  // a stale label from the previous layer.
  const probe = await runner.evaluate(`(() => {
    const dialog = document.querySelector('dialog.redux-settings[open]');
    const anchor = dialog?.querySelector('button');
    if (!anchor) return null;
    anchor.setAttribute('data-tip-title', 'Tooltip probe');
    anchor.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    return true;
  })()`);
  runner.assert(probe === true, "settings dialog has no control to probe the tooltip layer");
  await runner.waitFor("modal tooltip", () =>
    runner.evaluate(`(() => {
      const tip = document.querySelector('#redux-rich-tooltip');
      const dialog = document.querySelector('dialog.redux-settings[open]');
      if (!tip?.matches(':popover-open') || !dialog) return false;
      return Number(getComputedStyle(tip).zIndex) >= Number(getComputedStyle(dialog).zIndex);
    })()`),
  );

  await runner.evaluate("document.querySelector('dialog.redux-settings[open]')?.close(); true");
  await runner.waitFor("settings closed", () =>
    runner.evaluate("!document.querySelector('dialog.redux-settings[open]')"),
  );
  await runner.waitFor("modal tooltip dismissed", () =>
    runner.evaluate(
      "document.querySelector('#redux-rich-tooltip')?.matches(':popover-open') !== true",
    ),
  );

  const reopened = await runner.callApi("window.redux.settings.open()");
  runner.assert(reopened === true, "settings command was not handled after close");
  await runner.waitFor("settings reopened", () =>
    runner.evaluate(`(() => {
      const dialog = document.querySelector('dialog.redux-settings[open]');
      const section = dialog?.querySelector('[data-settings-section]');
      return Boolean(section) && !section.hidden && (section.textContent ?? '').trim().length > 0;
    })()`),
  );
  await runner.evaluate("document.querySelector('dialog.redux-settings[open]')?.close(); true");
}
