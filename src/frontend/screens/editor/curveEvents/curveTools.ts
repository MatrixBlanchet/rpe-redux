/** Shared curve-preview tool identifiers, glyph names, and grouping. */
import type { IconName } from "../../../../design/components/icon/Icon.tsx";

/** Tool identifiers the curve overlay can activate. */
export type CurveTool =
  "pencil" | "line" | "polyline" | "curve" | "select" | "connect" | "subdivide";

/** Creation tools, in dock order. `label` is an i18n message key. */
export const CURVE_CREATION_TOOLS = [
  { id: "pencil", icon: "pencil", label: "editorPanels.curvePreview.tool.pencil" },
  { id: "line", icon: "linePath", label: "editorPanels.curvePreview.tool.line" },
  { id: "polyline", icon: "polylinePath", label: "editorPanels.curvePreview.tool.polyline" },
  { id: "curve", icon: "curvePath", label: "editorPanels.curvePreview.tool.curve" },
] as const satisfies readonly {
  id: CurveTool;
  icon: IconName;
  label: string;
}[];

/** Editing tools, in dock order. `label` is an i18n message key. */
export const CURVE_EDIT_TOOLS = [
  { id: "select", icon: "select", label: "editorPanels.curvePreview.tool.select" },
  { id: "connect", icon: "external", label: "editorPanels.curvePreview.tool.connect" },
  { id: "subdivide", icon: "subdivide", label: "editorPanels.curvePreview.tool.subdivide" },
] as const satisfies readonly {
  id: CurveTool;
  icon: IconName;
  label: string;
}[];
