/**
 * Renders a theme's declarative UI tree with host design primitives.
 *
 * The tree is validated core data. This file is the only adapter that turns a
 * node into React, and it never creates DOM from a package-supplied tag, class,
 * style, URL, or handler. Values that are not host primitives are ignored.
 */
import { useSyncExternalStore, type CSSProperties } from "react";
import { Button } from "../../design/components/button/Button.tsx";
import { Divider } from "../../design/components/divider/Divider.tsx";
import { Icon, iconName } from "../../design/components/icon/Icon.tsx";
import { packageName } from "../../core/utils/packageName.ts";
import type { ValueCell } from "../../core/state/values.ts";
import type { ThemeUiNode } from "../../core/theme/ui.ts";
import { useTranslation } from "../../i18n/react.ts";

const neverSubscribe = () => () => {};
const visibleByDefault = () => true;
const missingStatus = () => false;

/** Fields a template may read from the host surface it replaces. */
export interface ThemeUiBindings {
  label?: string;
  icon?: string;
  active?: boolean;
  statusDot?: boolean;
  expanded?: boolean;
  onActivate?: () => void;
  items?: readonly ThemeUiItem[];
}

/** One live item offered to a sidebar repeat. */
export interface ThemeUiItem {
  id: string;
  label: string;
  icon: string;
  active?: boolean;
  onActivate(): void;
  visibility?: Pick<ValueCell<boolean>, "get" | "subscribe">;
  indicator?: Pick<ValueCell<boolean>, "get" | "subscribe">;
}

/** True when a node's optional condition matches the bound surface. */
function conditionMet(node: ThemeUiNode, bindings: ThemeUiBindings): boolean {
  switch (node.when) {
    case undefined:
    case "always":
      return true;
    case "active":
      return bindings.active === true;
    case "inactive":
      return bindings.active !== true;
    case "expanded":
      return bindings.expanded === true;
    case "collapsed":
      return bindings.expanded !== true;
    case "hasStatus":
      return bindings.statusDot === true;
    case "noStatus":
      return bindings.statusDot !== true;
    default:
      return true;
  }
}

/** Layout data attributes and the optional grid span, clamped to its parent. */
function layoutAttrs(node: ThemeUiNode, parentColumns?: number): Record<string, string> {
  const span = node.span
    ? parentColumns
      ? Math.min(node.span, parentColumns)
      : node.span
    : undefined;
  return {
    ...(node.direction ? { "data-direction": node.direction } : {}),
    ...(node.gap ? { "data-gap": node.gap } : {}),
    ...(node.align ? { "data-align": node.align } : {}),
    ...(node.justify ? { "data-justify": node.justify } : {}),
    ...(node.columns ? { "data-columns": String(node.columns) } : {}),
    ...(span ? { "data-span": String(span) } : {}),
    ...(node.wrap ? { "data-wrap": "true" } : {}),
    ...(node.padding ? { "data-padding": node.padding } : {}),
  };
}

/** Resolve a node's text from its binding or its literal language map. */
function textOf(node: ThemeUiNode, bindings: ThemeUiBindings, language: string): string {
  if (node.bind === "label") {
    return bindings.label ?? "";
  }
  return node.text ? packageName(node.text, language) : "";
}

/** Resolve a node's icon from its binding or its literal name. */
function iconOf(node: ThemeUiNode, bindings: ThemeUiBindings): string {
  if (node.bind === "icon") {
    return bindings.icon ?? "";
  }
  return node.icon ?? "";
}

/** One repeated item; it owns the live visibility and status subscriptions. */
function RepeatItem({
  template,
  item,
  expanded,
  columns,
}: {
  template: ThemeUiNode;
  item: ThemeUiItem;
  expanded: boolean;
  columns?: number;
}) {
  const visible = useSyncExternalStore(
    item.visibility?.subscribe ?? neverSubscribe,
    item.visibility?.get ?? visibleByDefault,
    item.visibility?.get ?? visibleByDefault,
  );
  const indicator = useSyncExternalStore(
    item.indicator?.subscribe ?? neverSubscribe,
    item.indicator?.get ?? missingStatus,
    item.indicator?.get ?? missingStatus,
  );
  if (!visible) {
    return null;
  }
  return (
    <ThemeUiNodeView
      tree={template}
      columns={columns}
      bindings={{
        label: item.label,
        icon: item.icon,
        active: item.active,
        statusDot: indicator,
        expanded,
        onActivate: item.onActivate,
      }}
    />
  );
}

/** Render one validated theme UI node. */
export function ThemeUiNodeView({
  tree,
  bindings,
  columns,
}: {
  tree: ThemeUiNode;
  bindings: ThemeUiBindings;
  columns?: number;
}) {
  const { language } = useTranslation();
  if (!conditionMet(tree, bindings)) {
    return null;
  }
  const attrs = layoutAttrs(tree, columns);
  switch (tree.kind) {
    case "stack":
    case "surface": {
      const childColumns = tree.columns ?? columns;
      const children = tree.children?.map((child, index) => (
        <ThemeUiNodeView key={index} tree={child} bindings={bindings} columns={childColumns} />
      ));
      if (tree.kind === "surface") {
        return (
          <div
            className="theme-ui-node theme-ui-surface"
            data-variant={tree.variant ?? "plain"}
            data-shape={tree.shape}
            {...attrs}
          >
            {children}
          </div>
        );
      }
      return (
        <div className="theme-ui-node theme-ui-stack" {...attrs}>
          {children}
        </div>
      );
    }
    case "text": {
      const content = textOf(tree, bindings, language);
      if (!content) {
        return null;
      }
      return (
        <span
          className="theme-ui-text"
          data-size={tree.size ?? "label"}
          data-tone={tree.tone ?? "default"}
          data-weight={tree.weight ?? "normal"}
          {...attrs}
        >
          {content}
        </span>
      );
    }
    case "icon": {
      const name = iconOf(tree, bindings);
      if (!name) {
        return null;
      }
      const size = tree.iconSize === "sm" ? 14 : tree.iconSize === "lg" ? 20 : 18;
      return (
        <Icon
          className="theme-ui-icon"
          name={iconName(name)}
          size={size}
          style={
            tree.tone
              ? ({
                  "--icon-color": `var(--${tree.tone === "muted" ? "foreground-muted" : tree.tone === "accent" ? "accent" : tree.tone === "danger" ? "danger" : "foreground"})`,
                } as CSSProperties)
              : undefined
          }
        />
      );
    }
    case "dot":
      return <span className="theme-ui-dot" data-tone={tree.tone ?? "accent"} aria-hidden="true" />;
    case "divider":
      return <Divider axis={tree.direction === "column" ? "x" : "y"} />;
    case "spacer":
      return <span className="theme-ui-spacer" aria-hidden="true" />;
    case "action": {
      // An action with no explicit text/icon reads the item it repeats over.
      const label =
        !tree.bind && !tree.text ? (bindings.label ?? "") : textOf(tree, bindings, language);
      const name = !tree.bind && !tree.icon ? (bindings.icon ?? "") : iconOf(tree, bindings);
      if (!label && !name) {
        return null;
      }
      const variant =
        tree.variant === "solid"
          ? "solid"
          : tree.variant === "outlined" || tree.variant === "raised" || tree.variant === "glass"
            ? "outlined"
            : "plain";
      return (
        <Button
          variant={variant}
          className="theme-ui-action"
          data-shape={tree.shape ?? "soft"}
          disabled={!bindings.onActivate}
          onClick={bindings.onActivate}
        >
          {name ? <Icon name={iconName(name)} size={16} /> : null}
          {label ? <span className="theme-ui-action-label">{label}</span> : null}
        </Button>
      );
    }
    case "repeat": {
      const items = bindings.items ?? [];
      if (!tree.template || !items.length) {
        return null;
      }
      return (
        <div className="theme-ui-node theme-ui-repeat" {...attrs}>
          {items.map((item) => (
            <RepeatItem
              key={item.id}
              template={tree.template as ThemeUiNode}
              item={item}
              expanded={bindings.expanded === true}
              columns={tree.columns}
            />
          ))}
        </div>
      );
    }
    default:
      return null;
  }
}
