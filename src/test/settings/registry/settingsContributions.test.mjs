/** The settings UI contribution registry: lookups, replacement, and disposal. */
import assert from "node:assert/strict";
import test from "node:test";
import {
  registerSettingControl,
  registerSettingsPage,
  settingControlFor,
  settingsPageFor,
} from "../../../frontend/screens/settings/settingsContributions.ts";

function Control() {
  return null;
}

test("a custom control is discoverable and its disposer removes it", () => {
  const dispose = registerSettingControl("test.control", Control);
  assert.equal(settingControlFor("test.control"), Control);
  dispose();
  assert.equal(settingControlFor("test.control"), null);
});

test("a settings page carries its search keywords and component", () => {
  const page = { keywords: "settings.search.helpKeywords", component: Control };
  const dispose = registerSettingsPage("test.page", page);
  assert.deepEqual(settingsPageFor("test.page"), page);
  dispose();
  assert.equal(settingsPageFor("test.page"), null);
});

test("re-registering replaces the earlier contribution without removing the new one", () => {
  const first = registerSettingControl("test.replace", Control);
  const second = registerSettingControl("test.replace", () => null);
  first();
  assert.ok(settingControlFor("test.replace"));
  second();
  assert.equal(settingControlFor("test.replace"), null);
});
