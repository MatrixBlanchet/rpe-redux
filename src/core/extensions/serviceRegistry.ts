/** Owns the cross-Extension service registry and its lifecycle notifications. */

import type { ExtensionDisposer } from "./registry.ts";
import { decodeExtensionStorageJson, encodeExtensionStorageJson } from "./extensionStorageJson.ts";

/** A callable operation published by one Extension service. */
export type ExtensionServiceMethod = (...args: readonly unknown[]) => unknown | Promise<unknown>;

/** A versioned service definition owned by one Extension. */
export interface ExtensionServiceDefinition {
  readonly id: string;
  readonly version: string;
  readonly methods: Readonly<Record<string, ExtensionServiceMethod>>;
}

/** A read-only view of a currently available service provider. */
export interface ExtensionServiceInfo {
  readonly id: string;
  readonly version: string;
  readonly provider: string;
  readonly available: true;
}

/** A bounded JSON snapshot published by a provider-backed data service. */
export interface ExtensionDataProviderDefinition<T = unknown> {
  readonly id: string;
  readonly version: string;
  readonly initial: T;
}

/** A current provider snapshot, including the invalidation epoch. */
export interface ExtensionDataInfo<T = unknown> {
  readonly id: string;
  readonly version: string;
  readonly provider: string;
  readonly epoch: number;
  readonly available: true;
  readonly value: T;
}

/** Stable failure codes for service resolution and calls. */
export type ExtensionServiceErrorCode =
  "serviceUnavailable" | "serviceMethodUnavailable" | "serviceAlreadyProvided" | "serviceInvalid";

/** A service operation failure that callers can branch on. */
export class ExtensionServiceError extends Error {
  readonly code: ExtensionServiceErrorCode;
  readonly serviceId: string;

  /** Build one stable service failure. */
  constructor(code: ExtensionServiceErrorCode, serviceId: string, message: string) {
    super(message);
    this.name = "ExtensionServiceError";
    this.code = code;
    this.serviceId = serviceId;
  }
}

interface Provider {
  readonly owner: string;
  readonly definition: ExtensionServiceDefinition;
}

const providers = new Map<string, Provider>();
const listeners = new Map<string, Set<(info: ExtensionServiceInfo | null) => void>>();
interface DataProvider {
  readonly owner: string;
  readonly id: string;
  readonly version: string;
  epoch: number;
  value: unknown;
}
const dataProviders = new Map<string, DataProvider>();
const dataEpochs = new Map<string, number>();
const dataListeners = new Map<string, Set<(info: ExtensionDataInfo | null) => void>>();

/** Validate one service id before it reaches the global registry. */
function checkServiceId(id: string): string {
  const value = id.trim();
  if (!/^[a-z][a-z0-9._-]{1,127}$/u.test(value) || !value.includes(".")) {
    throw new ExtensionServiceError(
      "serviceInvalid",
      value,
      "Extension service ids must be namespaced lowercase identifiers",
    );
  }
  return value;
}

/** Validate a version and method table at the public seam. */
function checkDefinition(definition: ExtensionServiceDefinition): ExtensionServiceDefinition {
  const id = checkServiceId(definition.id);
  if (typeof definition.version !== "string" || !definition.version.trim()) {
    throw new ExtensionServiceError("serviceInvalid", id, "Extension service version is required");
  }
  const methods = definition.methods;
  if (!methods || typeof methods !== "object" || Array.isArray(methods)) {
    throw new ExtensionServiceError("serviceInvalid", id, "Extension service methods are required");
  }
  for (const [name, method] of Object.entries(methods)) {
    if (!/^[a-z][a-z0-9._-]{0,63}$/u.test(name) || typeof method !== "function") {
      throw new ExtensionServiceError(
        "serviceInvalid",
        id,
        `Invalid Extension service method: ${name}`,
      );
    }
  }
  return { id, version: definition.version.trim(), methods };
}

/** Notify listeners after a provider is added, replaced, or removed. */
function notify(id: string): void {
  const provider = providers.get(id);
  const info = provider
    ? Object.freeze({
        id,
        version: provider.definition.version,
        provider: provider.owner,
        available: true as const,
      })
    : null;
  for (const listener of [...(listeners.get(id) ?? [])]) {
    listener(info);
  }
}

/** Register or replace a service owned by one Extension activation. */
export function provideExtensionService(
  owner: string,
  definition: ExtensionServiceDefinition,
): ExtensionDisposer {
  const checked = checkDefinition(definition);
  const current = providers.get(checked.id);
  if (current && current.owner !== owner) {
    throw new ExtensionServiceError(
      "serviceAlreadyProvided",
      checked.id,
      `Extension service is already provided by ${current.owner}`,
    );
  }
  const provider = { owner, definition: checked };
  providers.set(checked.id, provider);
  notify(checked.id);
  let active = true;
  return () => {
    if (!active) {
      return;
    }
    active = false;
    if (providers.get(checked.id) === provider) {
      providers.delete(checked.id);
      notify(checked.id);
    }
  };
}

/** Resolve a service when its version matches the requested exact version. */
export function resolveExtensionService(
  _consumer: string,
  id: string,
  version?: string,
): ExtensionServiceInfo | null {
  const serviceId = checkServiceId(id);
  const provider = providers.get(serviceId);
  if (!provider || (version !== undefined && provider.definition.version !== version)) {
    return null;
  }
  return Object.freeze({
    id: serviceId,
    version: provider.definition.version,
    provider: provider.owner,
    available: true as const,
  });
}

/** Invoke one operation through the currently active provider. */
export async function callExtensionService(
  _consumer: string,
  id: string,
  method: string,
  args: readonly unknown[] = [],
): Promise<unknown> {
  const serviceId = checkServiceId(id);
  const provider = providers.get(serviceId);
  if (!provider) {
    throw new ExtensionServiceError(
      "serviceUnavailable",
      serviceId,
      `Extension service is unavailable: ${serviceId}`,
    );
  }
  const operation = provider.definition.methods[method];
  if (!operation) {
    throw new ExtensionServiceError(
      "serviceMethodUnavailable",
      serviceId,
      `Extension service method is unavailable: ${serviceId}.${method}`,
    );
  }
  return operation(...args);
}

/** Subscribe to provider availability changes for one service id. */
export function subscribeExtensionService(
  consumer: string,
  id: string,
  listener: (info: ExtensionServiceInfo | null) => void,
): ExtensionDisposer {
  const serviceId = checkServiceId(id);
  const entries = listeners.get(serviceId) ?? new Set();
  listeners.set(serviceId, entries);
  entries.add(listener);
  listener(resolveExtensionService(consumer, serviceId));
  let active = true;
  return () => {
    if (!active) {
      return;
    }
    active = false;
    entries.delete(listener);
    if (!entries.size) {
      listeners.delete(serviceId);
    }
  };
}

/** Remove every service owned by an Extension activation. */
export function removeExtensionServices(owner: string): number {
  let removed = 0;
  for (const [id, provider] of [...providers]) {
    if (provider.owner === owner) {
      providers.delete(id);
      notify(id);
      removed += 1;
    }
  }
  for (const [id, provider] of [...dataProviders]) {
    if (provider.owner === owner) {
      dataProviders.delete(id);
      dataEpochs.set(id, provider.epoch + 1);
      notifyData(id);
      removed += 1;
    }
  }
  return removed;
}

/** Clear the process-wide registry for isolated tests. */
export function resetExtensionServices(): void {
  providers.clear();
  listeners.clear();
  dataProviders.clear();
  dataEpochs.clear();
  dataListeners.clear();
}

/** Validate and clone JSON data at the provider seam. */
function cloneProviderData(value: unknown): unknown {
  const encoded = encodeExtensionStorageJson(value);
  return decodeExtensionStorageJson(encoded);
}

/** Notify data consumers with the current snapshot or explicit unavailability. */
function notifyData(id: string): void {
  const provider = dataProviders.get(id);
  const info = provider
    ? Object.freeze({
        id: provider.id,
        version: provider.version,
        provider: provider.owner,
        epoch: provider.epoch,
        available: true as const,
        value: provider.value,
      })
    : null;
  for (const listener of [...(dataListeners.get(id) ?? [])]) {
    listener(info);
  }
}

/** Publish one bounded JSON snapshot and own it until the returned disposer runs. */
export function provideExtensionData<T>(
  owner: string,
  definition: ExtensionDataProviderDefinition<T>,
): ExtensionDisposer {
  const id = checkServiceId(definition.id);
  if (typeof definition.version !== "string" || !definition.version.trim()) {
    throw new Error("Extension provider version is required");
  }
  const current = dataProviders.get(id);
  if (current && current.owner !== owner) {
    throw new Error(`Extension provider is already provided: ${id}`);
  }
  if (current) {
    dataProviders.delete(id);
    dataEpochs.set(id, current.epoch + 1);
    notifyData(id);
  }
  const provider: DataProvider = {
    owner,
    id,
    version: definition.version.trim(),
    epoch: dataEpochs.get(id) ?? 0,
    value: cloneProviderData(definition.initial),
  };
  dataProviders.set(id, provider);
  notifyData(id);
  let active = true;
  return () => {
    if (!active) {
      return;
    }
    active = false;
    if (dataProviders.get(id) === provider) {
      dataProviders.delete(id);
      dataEpochs.set(id, provider.epoch + 1);
      notifyData(id);
    }
  };
}

/** Read the current provider snapshot, or null while no provider is active. */
export function readExtensionData(
  _consumer: string,
  id: string,
  version?: string,
): ExtensionDataInfo | null {
  const serviceId = checkServiceId(id);
  const provider = dataProviders.get(serviceId);
  if (!provider || (version !== undefined && provider.version !== version)) {
    return null;
  }
  return Object.freeze({
    id: serviceId,
    version: provider.version,
    provider: provider.owner,
    epoch: provider.epoch,
    available: true as const,
    value: provider.value,
  });
}

/** Replace a provider snapshot and advance its epoch atomically. */
export function updateExtensionData(owner: string, id: string, value: unknown): void {
  const serviceId = checkServiceId(id);
  const provider = dataProviders.get(serviceId);
  if (!provider) {
    throw new Error(`Extension data provider is unavailable: ${serviceId}`);
  }
  if (provider.owner !== owner) {
    throw new Error(`Extension data provider does not own ${serviceId}: ${owner}`);
  }
  provider.value = cloneProviderData(value);
  provider.epoch += 1;
  dataEpochs.set(serviceId, provider.epoch);
  notifyData(serviceId);
}

/** Subscribe to snapshots and invalidation epochs for one provider id. */
export function subscribeExtensionData(
  _consumer: string,
  id: string,
  listener: (info: ExtensionDataInfo | null) => void,
): ExtensionDisposer {
  const serviceId = checkServiceId(id);
  const entries = dataListeners.get(serviceId) ?? new Set();
  dataListeners.set(serviceId, entries);
  entries.add(listener);
  listener(readExtensionData("", serviceId));
  let active = true;
  return () => {
    if (!active) {
      return;
    }
    active = false;
    entries.delete(listener);
    if (!entries.size) {
      dataListeners.delete(serviceId);
    }
  };
}
