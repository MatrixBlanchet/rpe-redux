/** Owns the React refs for the transport controls and spectrum canvas. */
import {
  createDomSurface,
  type DomSurfaceHandle,
  type DomSurfaceProviderProps,
} from "../../contracts/domSurface.ts";
import type { TransportSurface } from "../../contracts/transportSurface.ts";

/** Refs and attach callbacks for the transport surface. */
export type TransportSurfaceHandle = DomSurfaceHandle<TransportSurface>;

const transportSurface = createDomSurface<TransportSurface>(
  ["timelineMarkers", "scrubberWrap", "scrubber", "scrubberSpectrum"],
  {
    selector: (key) => `transport.${String(key)}`,
    provider: "TransportSurfaceProvider",
  },
);

/** Creates the ref set and attach callbacks for the transport surface. */
export function createTransportSurface(): TransportSurfaceHandle {
  return transportSurface.create();
}

/** Provides the transport surface handle to the chrome tree. */
export function TransportSurfaceProvider(props: DomSurfaceProviderProps<TransportSurface>) {
  return transportSurface.Provider(props);
}

/** Returns the transport surface handle; throws when used outside its provider. */
export function useTransportSurface(): TransportSurfaceHandle {
  return transportSurface.useSurface();
}
