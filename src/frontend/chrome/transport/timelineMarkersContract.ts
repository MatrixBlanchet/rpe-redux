/**
 * The data contract between the markers controller and its view.
 *
 * The shapes live in `frontend/contracts/editorHost.ts` because the transport
 * chrome and the editor runtime exchange them. Both sides import this module,
 * so the marker state stays free of DOM types.
 */
import type {
  EditorHostTimelineMarkersSnapshot,
  TimelineMarker,
} from "../../contracts/editorHost.ts";

export type { TimelineMarker };

/** Props the markers view needs from its controller. */
export type TimelineMarkersViewProps = EditorHostTimelineMarkersSnapshot;
