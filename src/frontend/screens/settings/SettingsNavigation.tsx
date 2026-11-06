/**
 * The category rail of the settings window.
 *
 * Nested categories, search filtering, and the sliding selection bar are drawn from
 * the navigation registry rather than from a local list.
 */
import { useLayoutEffect, useRef } from "react";
import { navigationPathFrom, settingsNavigationChildren } from "./settingsCatalog.ts";
import type { SettingsNavigation as SettingsNavigationDefinition } from "../../../core/settings/types.ts";
import { Button } from "../../../design/components/button/Button.tsx";
import { SearchField } from "../../../design/components/input/SearchField.tsx";
import { Icon, type IconName } from "../../../design/components/icon/Icon.tsx";
import { useTranslation } from "../../../i18n/react.ts";

/** The category rail with search, nested groups, and a sliding selection bar. */
export function SettingsNavigation({
  open,
  categories,
  category,
  query,
  matchingNavigationKeys,
  expandedNavigationKeys,
  onToggleNavigation,
  setCategory,
  setQuery,
}: {
  open: boolean;
  categories: readonly SettingsNavigationDefinition[];
  category: string;
  query: string;
  matchingNavigationKeys: ReadonlySet<string>;
  expandedNavigationKeys: ReadonlySet<string>;
  onToggleNavigation(key: string): void;
  setCategory(value: string): void;
  setQuery(value: string): void;
}) {
  // Category labels are data, so they resolve through `tRaw`: the schema declares
  // message keys, and `tRaw` echoes the value unchanged if it is still a literal.
  const { t, tRaw } = useTranslation();
  const searching = query.trim().length > 0;
  const listRef = useRef<HTMLDivElement | null>(null);
  const railRef = useRef<HTMLSpanElement | null>(null);
  const placed = useRef(false);
  // Tracks whether the rail had a measurable position on the previous pass; a
  // reopened dialog snaps into place instead of animating from a stale row.
  const shown = useRef(false);

  const roots = categories.filter((entry) => !entry.parent);
  const visibleEntries = roots.flatMap((entry) => {
    const children = settingsNavigationChildren(entry.key);
    if (searching && !matchingNavigationKeys.has(entry.key)) {
      return [];
    }
    const showChildren = searching || expandedNavigationKeys.has(entry.key);
    const visibleChildren = showChildren
      ? children.filter((child) => !searching || matchingNavigationKeys.has(child.key))
      : [];
    return [entry, ...visibleChildren];
  });

  // A collapsed root can still be the owner of the page on screen. In that
  // state the exact child button is gone, so the rail moves to the root and the
  // root keeps a quiet accent; the page does not jump to another category just
  // because its section was folded.
  const activeRootKey = navigationPathFrom(categories, category)[0]?.key ?? null;
  const activeVisible = visibleEntries.some((entry) => entry.key === category);
  const railTarget = searching || activeVisible ? category : activeRootKey;

  // The rail is one element, not a pseudo-element per button: it slides to the
  // current row and gives the rail a single continuous position. The move is
  // short and linear enough to stay out of the way during repeated use.
  useLayoutEffect(() => {
    const list = listRef.current;
    const rail = railRef.current;
    if (!list || !rail) {
      return;
    }
    /** Place the rail at the active row, snapping on first show. */
    const position = () => {
      // The settings content is mounted inside a portal before the dialog opens,
      // where every offset reads 0. Waiting for a laid-out list keeps the first
      // real measurement on the open dialog, and the ResizeObserver below fires
      // when the portal becomes visible.
      if (!open || !list.offsetHeight) {
        rail.dataset.visible = "false";
        // A hidden rail drops its placed state so the next open positions it
        // from scratch.
        shown.current = false;
        return;
      }
      const active = searching
        ? null
        : list.querySelector<HTMLElement>(
            `.redux-settings-nav-item[data-category="${railTarget}"]`,
          );
      rail.dataset.visible = active ? "true" : "false";
      if (!active) {
        return;
      }
      // Layout offsets are already in the rail's coordinate space, so the
      // modal's opening scale does not distort the target position.
      const offset = active.offsetTop + (active.offsetHeight - rail.offsetHeight) / 2;
      const horizontalOffset =
        active.offsetLeft + (active.getAttribute("aria-level") === "2" ? 16 : 0);
      if (!placed.current || !shown.current) {
        // The first placement is instant, so a reopened rail appears at the
        // active row without sliding.
        rail.dataset.animate = "false";
        rail.style.setProperty("transform", `translate(${horizontalOffset}px, ${offset}px)`);
        void rail.offsetWidth;
        rail.dataset.animate = "true";
        placed.current = true;
        shown.current = true;
        return;
      }
      rail.style.setProperty("transform", `translate(${horizontalOffset}px, ${offset}px)`);
    };
    position();
    // Retry after layout settles so a zero-height first measurement cannot leave
    // the travelling rail at the previous category.
    let retryFrame = requestAnimationFrame(() => {
      retryFrame = requestAnimationFrame(() => position());
    });
    const retryTimer = window.setTimeout(() => position(), 180);
    // A width or zoom change moves the buttons without changing the category;
    // the rail still has to follow, and that is not a transition.
    const observer = new ResizeObserver(() => position());
    const onScroll = () => position();
    observer.observe(list);
    list.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(retryFrame);
      window.clearTimeout(retryTimer);
      observer.disconnect();
      list.removeEventListener("scroll", onScroll);
    };
  }, [railTarget, searching, open]);

  return (
    <aside className="redux-settings-nav">
      <div className="redux-settings-brand">
        <Icon name="settings" size={20} />
        <strong>{t("common.settings.title")}</strong>
      </div>
      <SearchField
        className="redux-settings-search"
        inputId="settings-search"
        value={query}
        onChange={setQuery}
        label={t("common.settings.search")}
        placeholder={t("common.settings.search")}
        clearLabel={t("common.action.clearSearch")}
      />
      <div className="redux-settings-nav-list" ref={listRef}>
        {visibleEntries.map((entry) => {
          const children = settingsNavigationChildren(entry.key);
          const hasChildren = children.length > 0;
          const isExpanded = expandedNavigationKeys.has(entry.key) || searching;
          return (
            <Button
              key={entry.key}
              type="button"
              variant="ghost"
              className={`redux-settings-nav-item ${entry.parent ? "redux-settings-nav-child" : "redux-settings-nav-parent"}`}
              data-category={entry.key}
              aria-current={!searching && category === entry.key}
              data-active-ancestor={
                !searching && !activeVisible && entry.key === activeRootKey ? "true" : undefined
              }
              aria-level={entry.parent ? 2 : 1}
              aria-expanded={hasChildren ? isExpanded : undefined}
              onClick={() => {
                if (hasChildren) {
                  const firstChild = children[0];
                  // A parent that is already open closes on click. It must not
                  // jump to its first child, because the user asked to collapse
                  // the section, not to navigate.
                  if (isExpanded && !searching) {
                    onToggleNavigation(entry.key);
                    return;
                  }
                  onToggleNavigation(entry.key);
                  if (!isExpanded && !searching && firstChild) {
                    setQuery("");
                    setCategory(firstChild.key);
                  }
                  return;
                }
                setQuery("");
                setCategory(entry.key);
              }}
            >
              {!entry.parent && entry.icon && (
                <Icon
                  className="redux-settings-nav-leading-icon"
                  name={entry.icon as IconName}
                  size={18}
                />
              )}
              <span className="redux-button-label">{tRaw(entry.label)}</span>
              {hasChildren && (
                <Icon className="redux-settings-nav-disclosure" name="chevronDown" size={16} />
              )}
            </Button>
          );
        })}
        <span
          className="redux-settings-nav-indicator"
          ref={railRef}
          aria-hidden="true"
          data-visible="false"
          data-animate="true"
        >
          <span className="redux-settings-nav-indicator-bar" />
        </span>
      </div>
    </aside>
  );
}
