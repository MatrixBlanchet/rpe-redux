/** Host-neutral cache for the native runtime ports used by frontend clients. */

export interface RuntimePorts {
  frontendPort: number;
  backendPort: number;
  aiPort: number;
}

export const DEFAULT_RUNTIME_PORTS: RuntimePorts = Object.freeze({
  frontendPort: 4173,
  backendPort: 47821,
  aiPort: 47822,
});

let current = DEFAULT_RUNTIME_PORTS;

/** Read the most recently adopted runtime port configuration. */
export function getRuntimePorts(): RuntimePorts {
  return current;
}

/** Adopt the native configuration before constructing local service clients. */
export function setRuntimePorts(next: RuntimePorts): RuntimePorts {
  current = Object.freeze({ ...next });
  return current;
}
