/**
 * The contextual help model for the editor.
 *
 * This file owns the section order and the mapping from shell context to a
 * section. Copy stays in the i18n catalogs so the guide remains complete in
 * every supported language and can be reviewed like the rest of the UI.
 */
import type { IconName } from "../../../design/components/icon/Icon.tsx";
import type { MessageKey } from "../../../i18n/index.ts";
import type { OnboardingStepId } from "../../onboarding/steps.ts";

/** Stable ids for the contextual tutorial topics. */
export type GuideSectionId =
  | "overview"
  | "inspector"
  | "home"
  | "toolbar"
  | "timeline"
  | "stage"
  | "metadata"
  | "notes"
  | "events"
  | "lines"
  | "timing"
  | "assets"
  | "curve"
  | "trajectory"
  | "history"
  | "issues"
  | "scripts"
  | "ai"
  | "collaboration"
  | "recording"
  | "multiEdit"
  | "audio"
  | "document"
  | "settings"
  | "shortcuts";

/** Built-in tutorial categories; Extensions may contribute their own tutorials. */
export type GuideCategoryId = "workflow" | "editing" | "tools" | "collaboration" | "app";

/** One help section, including its localized heading and practical tips. */
export interface GuideSection {
  id: GuideSectionId;
  category: GuideCategoryId;
  icon: IconName;
  title: MessageKey;
  summary: MessageKey;
  tips: readonly MessageKey[];
}

/** The tutorial topic order; keep broad workflow topics before specialist tools. */
export const GUIDE_SECTIONS: readonly GuideSection[] = [
  {
    id: "overview",
    category: "workflow",
    icon: "help",
    title: "guide.section.overview.title",
    summary: "guide.section.overview.summary",
    tips: [
      "guide.section.overview.tip1",
      "guide.section.overview.tip2",
      "guide.section.overview.tip3",
    ],
  },
  {
    id: "inspector",
    category: "editing",
    icon: "panelRight",
    title: "guide.section.inspector.title",
    summary: "guide.section.inspector.summary",
    tips: [
      "guide.section.inspector.tip1",
      "guide.section.inspector.tip2",
      "guide.section.inspector.tip3",
      "guide.section.inspector.tip4",
    ],
  },
  {
    id: "home",
    category: "workflow",
    icon: "home",
    title: "guide.section.home.title",
    summary: "guide.section.home.summary",
    tips: ["guide.section.home.tip1", "guide.section.home.tip2", "guide.section.home.tip3"],
  },
  {
    id: "toolbar",
    category: "workflow",
    icon: "layout",
    title: "guide.section.toolbar.title",
    summary: "guide.section.toolbar.summary",
    tips: [
      "guide.section.toolbar.tip1",
      "guide.section.toolbar.tip2",
      "guide.section.toolbar.tip3",
      "guide.section.toolbar.tip4",
    ],
  },
  {
    id: "timeline",
    category: "editing",
    icon: "clock",
    title: "guide.section.timeline.title",
    summary: "guide.section.timeline.summary",
    tips: [
      "guide.section.timeline.tip1",
      "guide.section.timeline.tip2",
      "guide.section.timeline.tip3",
      "guide.section.timeline.tip4",
    ],
  },
  {
    id: "stage",
    category: "workflow",
    icon: "preview",
    title: "guide.section.stage.title",
    summary: "guide.section.stage.summary",
    tips: [
      "guide.section.stage.tip1",
      "guide.section.stage.tip2",
      "guide.section.stage.tip3",
      "guide.section.stage.tip4",
    ],
  },
  {
    id: "metadata",
    category: "editing",
    icon: "info",
    title: "guide.section.metadata.title",
    summary: "guide.section.metadata.summary",
    tips: [
      "guide.section.metadata.tip1",
      "guide.section.metadata.tip2",
      "guide.section.metadata.tip3",
    ],
  },
  {
    id: "notes",
    category: "editing",
    icon: "pencil",
    title: "guide.section.notes.title",
    summary: "guide.section.notes.summary",
    tips: [
      "guide.section.notes.tip1",
      "guide.section.notes.tip2",
      "guide.section.notes.tip3",
      "guide.section.notes.tip4",
    ],
  },
  {
    id: "events",
    category: "editing",
    icon: "sliders",
    title: "guide.section.events.title",
    summary: "guide.section.events.summary",
    tips: ["guide.section.events.tip1", "guide.section.events.tip2", "guide.section.events.tip3"],
  },
  {
    id: "lines",
    category: "editing",
    icon: "grid",
    title: "guide.section.lines.title",
    summary: "guide.section.lines.summary",
    tips: ["guide.section.lines.tip1", "guide.section.lines.tip2", "guide.section.lines.tip3"],
  },
  {
    id: "timing",
    category: "editing",
    icon: "bpm",
    title: "guide.section.timing.title",
    summary: "guide.section.timing.summary",
    tips: ["guide.section.timing.tip1", "guide.section.timing.tip2", "guide.section.timing.tip3"],
  },
  {
    id: "assets",
    category: "editing",
    icon: "folder",
    title: "guide.section.assets.title",
    summary: "guide.section.assets.summary",
    tips: ["guide.section.assets.tip1", "guide.section.assets.tip2", "guide.section.assets.tip3"],
  },
  {
    id: "curve",
    category: "editing",
    icon: "curve",
    title: "guide.section.curve.title",
    summary: "guide.section.curve.summary",
    tips: ["guide.section.curve.tip1", "guide.section.curve.tip2", "guide.section.curve.tip3"],
  },
  {
    id: "trajectory",
    category: "editing",
    icon: "route",
    title: "guide.section.trajectory.title",
    summary: "guide.section.trajectory.summary",
    tips: [
      "guide.section.trajectory.tip1",
      "guide.section.trajectory.tip2",
      "guide.section.trajectory.tip3",
    ],
  },
  {
    id: "history",
    category: "tools",
    icon: "clock",
    title: "guide.section.history.title",
    summary: "guide.section.history.summary",
    tips: [
      "guide.section.history.tip1",
      "guide.section.history.tip2",
      "guide.section.history.tip3",
    ],
  },
  {
    id: "issues",
    category: "tools",
    icon: "shield",
    title: "guide.section.issues.title",
    summary: "guide.section.issues.summary",
    tips: ["guide.section.issues.tip1", "guide.section.issues.tip2", "guide.section.issues.tip3"],
  },
  {
    id: "multiEdit",
    category: "editing",
    icon: "select",
    title: "guide.section.multiEdit.title",
    summary: "guide.section.multiEdit.summary",
    tips: [
      "guide.section.multiEdit.tip1",
      "guide.section.multiEdit.tip2",
      "guide.section.multiEdit.tip3",
    ],
  },
  {
    id: "audio",
    category: "tools",
    icon: "waves",
    title: "guide.section.audio.title",
    summary: "guide.section.audio.summary",
    tips: ["guide.section.audio.tip1", "guide.section.audio.tip2", "guide.section.audio.tip3"],
  },
  {
    id: "scripts",
    category: "tools",
    icon: "extension",
    title: "guide.section.scripts.title",
    summary: "guide.section.scripts.summary",
    tips: [
      "guide.section.scripts.tip1",
      "guide.section.scripts.tip2",
      "guide.section.scripts.tip3",
    ],
  },
  {
    id: "ai",
    category: "collaboration",
    icon: "bot",
    title: "guide.section.ai.title",
    summary: "guide.section.ai.summary",
    tips: ["guide.section.ai.tip1", "guide.section.ai.tip2", "guide.section.ai.tip3"],
  },
  {
    id: "collaboration",
    category: "collaboration",
    icon: "users",
    title: "guide.section.collaboration.title",
    summary: "guide.section.collaboration.summary",
    tips: [
      "guide.section.collaboration.tip1",
      "guide.section.collaboration.tip2",
      "guide.section.collaboration.tip3",
    ],
  },
  {
    id: "recording",
    category: "collaboration",
    icon: "clapperboard",
    title: "guide.section.recording.title",
    summary: "guide.section.recording.summary",
    tips: [
      "guide.section.recording.tip1",
      "guide.section.recording.tip2",
      "guide.section.recording.tip3",
    ],
  },
  {
    id: "document",
    category: "app",
    icon: "save",
    title: "guide.section.document.title",
    summary: "guide.section.document.summary",
    tips: [
      "guide.section.document.tip1",
      "guide.section.document.tip2",
      "guide.section.document.tip3",
    ],
  },
  {
    id: "settings",
    category: "app",
    icon: "settings",
    title: "guide.section.settings.title",
    summary: "guide.section.settings.summary",
    tips: [
      "guide.section.settings.tip1",
      "guide.section.settings.tip2",
      "guide.section.settings.tip3",
    ],
  },
  {
    id: "shortcuts",
    category: "app",
    icon: "keyboard",
    title: "guide.section.shortcuts.title",
    summary: "guide.section.shortcuts.summary",
    tips: [
      "guide.section.shortcuts.tip1",
      "guide.section.shortcuts.tip2",
      "guide.section.shortcuts.tip3",
    ],
  },
];

const CONTEXT_TO_SECTION: Readonly<Record<string, GuideSectionId>> = {
  inspector: "inspector",
  metadata: "metadata",
  notes: "notes",
  events: "events",
  multi: "multiEdit",
  "multi-line": "lines",
  timing: "timing",
  lines: "lines",
  assets: "assets",
  curve: "curve",
  "curve-preview": "trajectory",
  sampling: "stage",
  history: "history",
  issues: "issues",
  scripts: "scripts",
  "code-cell": "ai",
  audio: "audio",
  collaboration: "collaboration",
  recording: "recording",
};

/** Map contextual topics to the closest anchored walkthrough step. */
const SECTION_TO_TUTORIAL_STEP: Readonly<Record<GuideSectionId, OnboardingStepId>> = {
  overview: "start",
  inspector: "parameters",
  home: "start",
  toolbar: "view",
  timeline: "notes",
  stage: "view",
  metadata: "metadata",
  notes: "notes",
  events: "notes",
  lines: "sidebar",
  timing: "metadata",
  assets: "sidebar",
  curve: "sidebar",
  trajectory: "sidebar",
  history: "sidebar",
  issues: "sidebar",
  scripts: "sidebar",
  ai: "sidebar",
  collaboration: "sidebar",
  recording: "sidebar",
  multiEdit: "sidebar",
  audio: "sidebar",
  document: "finish",
  settings: "finish",
  shortcuts: "finish",
};

/** Resolves an inspector or drawer id to the most useful guide section. */
export function guideSectionForContext(context?: string): GuideSectionId {
  return (context ? CONTEXT_TO_SECTION[context] : undefined) ?? "overview";
}

/** Returns the nearest real coach step for a contextual tutorial topic. */
export function tutorialStepForGuideSection(section: GuideSectionId): OnboardingStepId {
  return SECTION_TO_TUTORIAL_STEP[section];
}

/** Returns a section by id, falling back to the overview section. */
export function getGuideSection(id: GuideSectionId): GuideSection {
  return GUIDE_SECTIONS.find((section) => section.id === id) ?? GUIDE_SECTIONS[0];
}
