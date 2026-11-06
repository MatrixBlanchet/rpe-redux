/**
 * Mounted MCP request seam.
 *
 * The active editor binds its adapter on mount and drops the binding on
 * teardown, so a transport treats a missing binding as unavailable.
 */
import { createLateBound } from "../../utils/lateBound.ts";
import type { McpAdapter } from "./adapter.ts";

/** Mounted MCP request seam; transports forward requests to the active editor. */
export interface MountedMcpApi extends Pick<McpAdapter, "handle"> {}

const mcpBinding = createLateBound<MountedMcpApi>();

/** Binds the mounted adapter; returns an idempotent disposer. */
export function connectMcpApi(adapter: MountedMcpApi): () => void {
  return mcpBinding.bind(adapter);
}

/** The active adapter, or null while no editor is mounted. */
export function getMcpApi(): MountedMcpApi | null {
  return mcpBinding.value();
}
