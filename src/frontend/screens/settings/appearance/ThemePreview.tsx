/**
 * A live sample of a theme package.
 *
 * Colours, icon sources, action styling, and the chrome recipe come from the
 * package, so the appearance page shows a theme before it is applied. The
 * blueprint mirrors the selected layout presets, and the trait rows name every
 * surface and motion choice. The sample follows the same two ink rules as the
 * live shell: an accent button uses the resolved action ink, and an active icon
 * button uses the active ink and its faint fill.
 */
import { type CSSProperties } from "react";
import { Button } from "../../../../design/components/button/Button.tsx";
import { Card } from "../../../../design/components/card/Card.tsx";
import { IconButton } from "../../../../design/components/button/IconButton.tsx";
import {
  Icon,
  type IconName,
  resolveIconSource,
} from "../../../../design/components/icon/Icon.tsx";
import { Select } from "../../../../design/components/select/Select.tsx";
import { builtinIconFallback, getThemePackage } from "../../../../core/theme/registry.ts";
import { resolveThemeColors, type ThemePackage } from "../../../../core/theme/packages.ts";
import { useTranslation } from "../../../../i18n/react.ts";
import { packageName } from "../../../../core/utils/packageName.ts";

/** Resolve a theme icon against the appearance-matched fallback when omitted. */
function previewIconSource(theme: ThemePackage, name: IconName): string | undefined {
  return resolveIconSource(name, theme.icons[name] ?? builtinIconFallback(theme.appearance)[name]);
}

/**
 * The labels for every chrome preset.
 *
 * The maps are literal so TypeScript keeps the setting enum and the message
 * catalog in sync; a new preset without a label is a compile error.
 */
const TRAIT_KEYS = {
  density: {
    compact: "settings.theme.trait.density.compact",
    comfortable: "settings.theme.trait.density.comfortable",
    spacious: "settings.theme.trait.density.spacious",
  },
  inspector: {
    docked: "settings.theme.trait.inspector.docked",
    floating: "settings.theme.trait.inspector.floating",
    overlay: "settings.theme.trait.inspector.overlay",
  },
  side: {
    left: "settings.theme.trait.side.left",
    right: "settings.theme.trait.side.right",
  },
  sidebar: {
    rail: "settings.theme.trait.sidebar.rail",
    floating: "settings.theme.trait.sidebar.floating",
    top: "settings.theme.trait.sidebar.top",
    inspector: "settings.theme.trait.sidebar.inspector",
  },
  toolbar: {
    docked: "settings.theme.trait.toolbar.docked",
    floating: "settings.theme.trait.toolbar.floating",
  },
  toolbarPlacement: {
    top: "settings.theme.trait.toolbarPlacement.top",
    left: "settings.theme.trait.toolbarPlacement.left",
  },
  toolbarFlow: {
    rows: "settings.theme.trait.toolbarFlow.rows",
    single: "settings.theme.trait.toolbarFlow.single",
    grid: "settings.theme.trait.toolbarFlow.grid",
  },
  toolbarColumns: {
    2: "settings.theme.trait.toolbarColumns.two",
    3: "settings.theme.trait.toolbarColumns.three",
    4: "settings.theme.trait.toolbarColumns.four",
  },
  titlebar: {
    compact: "settings.theme.trait.titlebar.compact",
    normal: "settings.theme.trait.titlebar.normal",
    tall: "settings.theme.trait.titlebar.tall",
  },
  windowControls: {
    system: "settings.theme.trait.windowControls.system",
    compact: "settings.theme.trait.windowControls.compact",
    capsule: "settings.theme.trait.windowControls.capsule",
  },
  menu: {
    hamburger: "settings.theme.trait.menu.hamburger",
    expanded: "settings.theme.trait.menu.expanded",
  },
  transport: {
    toolbar: "settings.theme.trait.transport.toolbar",
    floating: "settings.theme.trait.transport.floating",
  },
  transportAnchor: {
    "top-left": "settings.theme.trait.transportAnchor.topLeft",
    "top-right": "settings.theme.trait.transportAnchor.topRight",
    "bottom-left": "settings.theme.trait.transportAnchor.bottomLeft",
    "bottom-right": "settings.theme.trait.transportAnchor.bottomRight",
  },
  transportDrag: {
    true: "settings.theme.trait.transportDraggable",
    false: "settings.theme.trait.transportFixed",
  },
  statusBar: {
    docked: "settings.theme.trait.statusbar.docked",
    floating: "settings.theme.trait.statusbar.floating",
    hidden: "settings.theme.trait.statusbar.hidden",
  },
  shape: {
    square: "settings.theme.trait.shape.square",
    soft: "settings.theme.trait.shape.soft",
    round: "settings.theme.trait.shape.round",
  },
  material: {
    solid: "settings.theme.trait.material.solid",
    raised: "settings.theme.trait.material.raised",
    glass: "settings.theme.trait.material.glass",
    flat: "settings.theme.trait.material.flat",
  },
  pattern: {
    none: "settings.theme.trait.pattern.none",
    grid: "settings.theme.trait.pattern.grid",
    dots: "settings.theme.trait.pattern.dots",
    scanlines: "settings.theme.trait.pattern.scanlines",
  },
  ambient: {
    none: "settings.theme.trait.ambient.none",
    aurora: "settings.theme.trait.ambient.aurora",
    pulse: "settings.theme.trait.ambient.pulse",
  },
  motion: {
    none: "settings.theme.trait.motion.none",
    subtle: "settings.theme.trait.motion.subtle",
    expressive: "settings.theme.trait.motion.expressive",
  },
  hover: {
    none: "settings.theme.trait.hover.none",
    lift: "settings.theme.trait.hover.lift",
    glow: "settings.theme.trait.hover.glow",
  },
  entrance: {
    none: "settings.theme.trait.entrance.none",
    fade: "settings.theme.trait.entrance.fade",
    rise: "settings.theme.trait.entrance.rise",
    slide: "settings.theme.trait.entrance.slide",
  },
} as const;

/** One labelled row of design-preset chips. */
function TraitGroup({ label, values }: { label: string; values: readonly string[] }) {
  return (
    <li className="redux-theme-preview-trait-group">
      <span className="redux-theme-preview-trait-label">{label}</span>
      <span className="redux-theme-preview-trait-values">
        {values.map((value) => (
          <span key={value} className="redux-theme-preview-trait">
            {value}
          </span>
        ))}
      </span>
    </li>
  );
}

/** A non-interactive sample of a theme package's colours and icons. */
export function ThemePreview({ theme }: { theme: ThemePackage }) {
  const { t, language } = useTranslation();
  const base = getThemePackage(theme.appearance === "light" ? "light" : "dark")?.colors ?? {};
  const colors = resolveThemeColors(base, theme.colors, theme.actionForeground);
  const { layout, surface, motion } = theme.chrome;
  const style = {
    ...Object.fromEntries(Object.entries(colors)),
    "--theme-backdrop-blur": `${surface.backdropBlur}px`,
  } as CSSProperties;
  const playSource = previewIconSource(theme, "playbackPlay");
  const settingsSource = previewIconSource(theme, "settings");
  const layoutTraits = [
    t(TRAIT_KEYS.density[layout.density]),
    t(TRAIT_KEYS.toolbarPlacement[layout.toolbarPlacement]),
    t(TRAIT_KEYS.toolbarFlow[layout.toolbarFlow]),
    ...(layout.toolbarFlow === "grid" ? [t(TRAIT_KEYS.toolbarColumns[layout.toolbarColumns])] : []),
    t(TRAIT_KEYS.titlebar[theme.chrome.titlebar.density]),
    t(TRAIT_KEYS.windowControls[theme.chrome.titlebar.windowControls]),
    t(TRAIT_KEYS.menu[theme.chrome.titlebar.menu]),
    t(TRAIT_KEYS.inspector[layout.inspector]),
    t(TRAIT_KEYS.side[layout.inspectorSide]),
    t(TRAIT_KEYS.sidebar[layout.sidebar]),
    t(TRAIT_KEYS.toolbar[layout.toolbar]),
    t(TRAIT_KEYS.statusBar[layout.statusBar]),
    t(TRAIT_KEYS.transport[layout.transport]),
    ...(layout.transport === "floating"
      ? [
          t(TRAIT_KEYS.transportAnchor[layout.transportAnchor]),
          t(TRAIT_KEYS.transportDrag[layout.transportDraggable ? "true" : "false"]),
        ]
      : []),
    ...(theme.ui.slots["inspector.empty"] ? [t("settings.theme.trait.customEmpty")] : []),
    ...(theme.ui.components.railItem ? [t("settings.theme.trait.customRail")] : []),
    ...(theme.ui.components.menuTrigger ? [t("settings.theme.trait.customMenu")] : []),
    ...(theme.ui.components.windowControl ? [t("settings.theme.trait.customWindow")] : []),
  ];
  const surfaceTraits = [
    t(TRAIT_KEYS.shape[surface.shape]),
    t(TRAIT_KEYS.material[surface.material]),
    t(TRAIT_KEYS.pattern[surface.pattern]),
    t(TRAIT_KEYS.ambient[surface.ambient]),
  ];
  const motionTraits = [
    t(TRAIT_KEYS.motion[motion.level]),
    t(TRAIT_KEYS.hover[motion.hover]),
    t(TRAIT_KEYS.entrance[motion.entrance]),
  ];

  return (
    <Card
      as="section"
      className="redux-theme-preview"
      style={style}
      data-theme-preview={theme.id}
      aria-label={t("settings.theme.preview.label")}
    >
      <div className="redux-theme-preview-heading">
        <span>{t("settings.theme.preview.label")}</span>
        <strong>{packageName(theme.name, language)}</strong>
      </div>
      <div
        className="redux-theme-preview-layout"
        data-inspector={layout.inspector}
        data-inspector-side={layout.inspectorSide}
        data-sidebar={layout.sidebar}
        data-toolbar={layout.toolbar}
        data-toolbar-placement={layout.toolbarPlacement}
        data-transport={layout.transport}
        data-transport-anchor={layout.transportAnchor}
        data-statusbar={layout.statusBar}
        data-density={layout.density}
        data-shape={surface.shape}
        data-material={surface.material}
        data-pattern={surface.pattern}
        data-ambient={surface.ambient}
        data-motion={motion.level}
      >
        <span className="redux-theme-preview-toolbar" aria-hidden="true" />
        <span className="redux-theme-preview-sidebar" aria-hidden="true" />
        <span className="redux-theme-preview-workspace">
          {t("settings.theme.preview.workspace")}
        </span>
        <span className="redux-theme-preview-inspector">
          {t("settings.theme.preview.inspector")}
        </span>
        <span className="redux-theme-preview-transport" aria-hidden="true" />
        <span className="redux-theme-preview-status">{t("settings.theme.preview.status")}</span>
      </div>
      <ul className="redux-theme-preview-traits">
        <TraitGroup label={t("settings.theme.group.layout")} values={layoutTraits} />
        <TraitGroup label={t("settings.theme.group.surface")} values={surfaceTraits} />
        <TraitGroup label={t("settings.theme.group.motion")} values={motionTraits} />
      </ul>
      <div className="redux-theme-preview-controls" inert>
        <Button variant="solid" data-emphasized="true">
          {t("settings.theme.preview.primary")}
        </Button>
        <Button variant="outlined">
          <Icon name="playbackPlay" source={playSource} size={16} />
          {t("settings.theme.preview.secondary")}
        </Button>
        <IconButton
          icon="settings"
          iconSource={settingsSource}
          label={t("settings.theme.preview.iconButton")}
          variant="ghost"
          active
        />
        <Select aria-label={t("settings.theme.preview.select")} defaultValue="sample">
          <option value="sample">{t("settings.theme.preview.option")}</option>
        </Select>
      </div>
    </Card>
  );
}
