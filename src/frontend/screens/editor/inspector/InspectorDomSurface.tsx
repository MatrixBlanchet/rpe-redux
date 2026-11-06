/** Owns the React refs for the inspector frame and trajectory overlay. */
import {
  createDomSurface,
  type DomSurfaceHandle,
  type DomSurfaceProviderProps,
} from "../../../contracts/domSurface.ts";
import type { InspectorSurface } from "../workspace/runtime/composition/editorSurfaces.ts";

/** Refs and attach callbacks for the inspector frame and trajectory overlay. */
export type InspectorSurfaceHandle = DomSurfaceHandle<InspectorSurface>;

const inspectorSurface = createDomSurface<InspectorSurface>(["inspector", "trajectoryOverlay"], {
  selector: (key) => (key === "inspector" ? "inspector.panel" : "inspector.trajectoryOverlay"),
  provider: "InspectorSurfaceProvider",
});

/** Creates the ref pair and resolves them once both host nodes are mounted. */
export function createInspectorSurface(): InspectorSurfaceHandle {
  return inspectorSurface.create();
}

/** Provides the inspector surface handle to the panes below it. */
export function InspectorSurfaceProvider(props: DomSurfaceProviderProps<InspectorSurface>) {
  return inspectorSurface.Provider(props);
}

/** Returns the surrounding inspector surface; throws outside its provider. */
export function useInspectorSurface(): InspectorSurfaceHandle {
  return inspectorSurface.useSurface();
}
