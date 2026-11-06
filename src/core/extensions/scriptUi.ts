/** Host-owned UI capabilities exposed to sandboxed Extensions and their scripts. */
import { createLateBound } from "../utils/lateBound.ts";
import type {
  ExtensionParameterInput,
  ExtensionParameterSchema,
  ExtensionParameterValue,
} from "./parameters.ts";

/** Parameter value delivered to a script runner. */
export type ParamValue = ExtensionParameterValue;

/** Host UI surfaces an Extension may request. */
export type ScriptUiCapability = "notice" | "confirm" | "progress" | "input" | "select" | "guide";

export interface ScriptUiSource {
  readonly id: string;
  readonly name: string;
}

/** Request metadata kept at the host boundary; no UI objects cross to the package. */
export interface ScriptUiRequest {
  readonly source: ScriptUiSource;
  readonly signal: AbortSignal;
}

export type ScriptUiErrorCode = "unavailable" | "unsupported";

/** Raised when the script UI host is missing or lacks the requested capability. */
export class ScriptUiError extends Error {
  readonly code: ScriptUiErrorCode;
  readonly capability: ScriptUiCapability;

  /** Record the failure kind and the capability that was requested. */
  constructor(code: ScriptUiErrorCode, capability: ScriptUiCapability, message: string) {
    super(message);
    this.name = "ScriptUiError";
    this.code = code;
    this.capability = capability;
  }
}

export interface ScriptUiNoticeOptions {
  readonly level?: "info" | "success" | "warning" | "error";
  readonly step?: number;
  readonly totalSteps?: number;
  readonly timeoutMs?: number;
}

export interface ScriptUiProgressHandle {
  /** Aborted by the user or by the owning Extension lifecycle; close() is completion. */
  readonly signal: AbortSignal;
  update(message: string, options?: Omit<ScriptUiNoticeOptions, "timeoutMs">): void;
  close(): void;
}

export interface ScriptUiInputOptions {
  readonly title: string;
  readonly description?: string;
  readonly defaultValue?: string;
  readonly placeholder?: string;
  readonly multiline?: boolean;
  readonly confirmLabel?: string;
  readonly cancelLabel?: string;
}

export interface ScriptUiSelectOption {
  readonly value: string;
  readonly label: string;
  readonly disabled?: boolean;
}

export interface ScriptUiSelectOptions {
  readonly title: string;
  readonly description?: string;
  readonly options: readonly ScriptUiSelectOption[];
  readonly defaultValue?: string;
  readonly cancelLabel?: string;
}

export interface ScriptUiGuideStep {
  readonly title: string;
  readonly description?: string;
  readonly input?: ScriptUiInputOptions;
  readonly select?: ScriptUiSelectOptions;
}

export interface ScriptUiGuideOptions {
  readonly title: string;
  readonly description?: string;
  readonly steps: readonly ScriptUiGuideStep[];
  readonly previousLabel?: string;
  readonly nextLabel?: string;
  readonly cancelLabel?: string;
  readonly finishLabel?: string;
}

export interface ScriptUiGuideResult {
  readonly status: "completed" | "cancelled";
  readonly values: readonly (string | null)[];
}

export interface ScriptUiHost {
  readonly capabilities: readonly ScriptUiCapability[];
  notice(request: ScriptUiRequest, message: string, options?: ScriptUiNoticeOptions): void;
  confirm(request: ScriptUiRequest, message: string): Promise<boolean>;
  progress(request: ScriptUiRequest, title: string, totalSteps?: number): ScriptUiProgressHandle;
  input(request: ScriptUiRequest, options: ScriptUiInputOptions): Promise<string | null>;
  select(request: ScriptUiRequest, options: ScriptUiSelectOptions): Promise<string | null>;
  guide(request: ScriptUiRequest, options: ScriptUiGuideOptions): Promise<ScriptUiGuideResult>;
}

/** Host seam for collecting declared script parameters without exposing UI objects to core. */
export interface ScriptParameterHost {
  collect(
    owner: string,
    scriptId: string,
    schema: ExtensionParameterSchema,
    initial: Readonly<Record<string, ExtensionParameterInput>>,
  ): Promise<Readonly<Record<string, unknown>> | null>;
}

const scriptUiHostBinding = createLateBound<ScriptUiHost>();
const scriptParameterHostBinding = createLateBound<ScriptParameterHost>();

/** Attach the frontend-owned UI adapter without making core depend on React. */
export function connectScriptUiHost(host: ScriptUiHost): () => void {
  return scriptUiHostBinding.bind(host);
}

/** The connected script UI host, or null before the frontend mounts it. */
export function getScriptUiHost(): ScriptUiHost | null {
  return scriptUiHostBinding.value();
}

/** Attach the frontend-owned parameter collector without making core depend on React. */
export function connectScriptParameterHost(host: ScriptParameterHost): () => void {
  return scriptParameterHostBinding.bind(host);
}

/** The connected parameter collector, or null when no picker is mounted. */
export function getScriptParameterHost(): ScriptParameterHost | null {
  return scriptParameterHostBinding.value();
}

/** Resolves one capability without leaking the host implementation to a package. */
export function requireScriptUiHost(capability: ScriptUiCapability): ScriptUiHost {
  const host = scriptUiHostBinding.value();
  if (!host) {
    throw new ScriptUiError(
      "unavailable",
      capability,
      `Script UI host is unavailable for capability: ${capability}`,
    );
  }
  if (!host.capabilities.includes(capability)) {
    throw new ScriptUiError(
      "unsupported",
      capability,
      `Script UI capability is unsupported: ${capability}`,
    );
  }
  return host;
}
