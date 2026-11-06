/**
 * Registers the local AI-assisted development page under General: the code-cell
 * toggle and the loopback endpoints an external AI can use.
 *
 * Code cells are the only AI entry point. MCP transport code remains in the
 * application for compatibility, but this page exposes no MCP control.
 */
import { settingsRegistry } from "../settings.ts";
import type { SettingDefinition, SettingsNavigation } from "../types.ts";

const navigation: SettingsNavigation = {
  key: "general.mcp",
  parent: "general",
  label: "settings.group.localAi",
  icon: "external",
  order: 30,
};

const fields: SettingDefinition[] = [
  {
    key: "code-execution-enabled",
    navigation: "general.mcp",
    group: "",
    label: "settings.field.code-execution-enabled.label",
    description: "settings.field.code-execution-enabled.description",
    control: "toggle",
    default: false,
    // The source changes every run, so consent is bound to this profile and the
    // sandbox rather than to a package fingerprint.
    confirm: {
      title: "settings.codeCell.enableWarning.title",
      description: "settings.codeCell.enableWarning.description",
      label: "settings.codeCell.enableWarning.confirm",
      cancelLabel: "common.action.cancel",
    },
  },
  {
    key: "mcp-access",
    navigation: "general.mcp",
    group: "",
    label: "settings.field.mcp-access.label",
    control: "custom",
    fullWidth: true,
    enabledWhen: { key: "code-execution-enabled", equals: true },
  },
];

settingsRegistry.registerNavigation(navigation);
settingsRegistry.registerSettings(fields);
