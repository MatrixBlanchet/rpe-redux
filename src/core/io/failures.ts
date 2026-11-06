/**
 * One taxonomy for local persistence failures.
 *
 * Host errors arrive as native codes, service JSON, DOM exceptions, or plain
 * messages. The UI needs a stable answer to three questions regardless of the
 * source: can this be retried, does it indicate a full disk or missing
 * permission, and is it a storage failure rather than a network failure. This
 * module answers those questions without owning any presentation.
 */

/** Stable reason a local read, write, or delete failed. */
export type StorageFailureKind =
  | "not-found"
  | "permission"
  | "read-only"
  | "quota"
  | "unavailable"
  | "corrupt"
  | "busy"
  | "unknown";

/** Classified failure with the original code when one was available. */
export interface StorageFailure {
  readonly kind: StorageFailureKind;
  /** Whether repeating the same operation may succeed without user action. */
  readonly retryable: boolean;
  /** Machine code from the host or service, when present. */
  readonly code?: string;
}

/** Native or service code patterns that identify a storage failure directly. */
const CODE_KINDS: readonly [RegExp, StorageFailureKind][] = [
  [/^(?:storage_error|io_error|disk_error|sqlite_error|database_error)$/i, "unavailable"],
  [/^(?:disk_full|quota_exceeded|enospc|no_space)$/i, "quota"],
  [/^(?:permission_denied|eacces|eperm)$/i, "permission"],
  [/^(?:read_only|readonly|erofs)$/i, "read-only"],
  [/^(?:not_found|enoent|missing)$/i, "not-found"],
  [/^(?:corrupt|invalid_data|malformed)$/i, "corrupt"],
  [/^(?:busy|locked|ebusy)$/i, "busy"],
];

/** Message patterns, checked in this order so "read-only" wins over "permission". */
const MESSAGE_KINDS: readonly [RegExp, StorageFailureKind][] = [
  [/(?:read[\s-]?only|只读|erofs)/i, "read-only"],
  [/(?:no space|disk full|quota|enospc|空间不足|磁盘已满|磁盘空间)/i, "quota"],
  [/(?:permission|access denied|eacces|eperm|not permitted|拒绝访问|权限|无权限)/i, "permission"],
  [/(?:not found|enoent|missing|does not exist|不存在|找不到)/i, "not-found"],
  [/(?:corrupt|malformed|invalid data|损坏|格式错误)/i, "corrupt"],
  [/(?:busy|locked|ebusy|占用|正在使用)/i, "busy"],
  [
    /(?:unavailable|offline|timeout|timed out|econn|network|unreachable|database|sqlite|disk|存储|数据库|磁盘|不可用)/i,
    "unavailable",
  ],
];

/** Read a string code from an error-like value. */
function errorCode(error: unknown): string | undefined {
  if (typeof error === "object" && error !== null) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === "string" && code.trim()) {
      return code.trim();
    }
    const reason = (error as { reason?: unknown }).reason;
    if (typeof reason === "string" && reason.trim()) {
      return reason.trim();
    }
  }
  return undefined;
}

/** Read the human message from an error-like value. */
function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  if (typeof error === "object" && error !== null) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") {
      return message;
    }
  }
  return String(error);
}

/** Whether a kind is worth retrying without asking the user to change anything. */
function retryableKind(kind: StorageFailureKind): boolean {
  return kind === "unavailable" || kind === "busy";
}

/**
 * Classify one persistence failure.
 *
 * The code is authoritative when present. Messages are a fallback for native
 * errors that cross an IPC boundary as text. An unrecognized failure returns
 * `unknown` and is not treated as a storage failure by the recovery UI.
 */
export function classifyStorageFailure(error: unknown): StorageFailure {
  const code = errorCode(error);
  if (code) {
    for (const [pattern, kind] of CODE_KINDS) {
      if (pattern.test(code)) {
        return { kind, retryable: retryableKind(kind), code };
      }
    }
  }
  const message = errorMessage(error);
  for (const [pattern, kind] of MESSAGE_KINDS) {
    if (pattern.test(message)) {
      return {
        kind,
        retryable: retryableKind(kind),
        ...(code === undefined ? {} : { code }),
      };
    }
  }
  return { kind: "unknown", retryable: false, ...(code === undefined ? {} : { code }) };
}

/** Whether a failure belongs to local storage rather than the network or UI. */
export function isStorageFailure(error: unknown): boolean {
  const failure = classifyStorageFailure(error);
  if (failure.kind === "unknown") {
    return false;
  }
  if (failure.kind === "not-found" || failure.kind === "corrupt") {
    return false;
  }
  if (failure.kind !== "unavailable") {
    return true;
  }
  // "Unavailable" also covers transient network wording. The storage recovery
  // prompt is reserved for native storage/database codes or explicit messages.
  return /(?:storage|sqlite|database|disk|存储|数据库|磁盘)/i.test(
    `${failure.code ?? ""} ${errorMessage(error)}`,
  );
}

/** Whether the same operation may be retried without a user decision. */
export function isRetryableStorageFailure(error: unknown): boolean {
  return classifyStorageFailure(error).retryable;
}
