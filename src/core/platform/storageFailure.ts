/**
 * Host-independent storage failure recognition.
 *
 * The classification and recovery threshold live in `core/io/failures.ts` so
 * document, library, backup, and cache code share one answer. This module keeps
 * the platform-facing import path used by existing callers.
 */
export {
  classifyStorageFailure,
  isRetryableStorageFailure,
  isStorageFailure,
  type StorageFailure,
  type StorageFailureKind,
} from "../io/failures.ts";
