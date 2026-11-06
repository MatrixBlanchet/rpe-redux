/**
 * Author-scoped undo rules for room transactions.
 *
 * Compensation is not a local history rollback: only the original author may
 * compensate a transaction, only once, and the target must still be in the
 * ledger. The room server owns the decision; this module owns the rules so a
 * transport handler cannot accidentally accept a second or foreign undo.
 */

/** One transaction retained for undo authorization. */
export interface UndoLedgerEntry {
  readonly actorId: string;
  /** Client-visible transaction id this entry belongs to. */
  readonly transactionId: string;
  /** The transaction this entry compensates, when it is itself an undo. */
  readonly undoOf?: string;
}

/** Result of validating a compensation request. */
export type UndoValidation =
  { readonly ok: true } | { readonly ok: false; readonly code: string; readonly message: string };

/**
 * Check whether `actorId` may compensate `undoOf`.
 *
 * The order of checks is stable: unknown target, foreign author, then an
 * existing compensation. That keeps the response useful without revealing
 * another member's transaction beyond its already-published id.
 */
export function validateUndo(
  ledger: ReadonlyMap<string, UndoLedgerEntry>,
  actorId: string,
  undoOf: string,
): UndoValidation {
  const original =
    ledger.get(undoOf) ?? [...ledger.values()].find((entry) => entry.transactionId === undoOf);
  if (!original) {
    return {
      ok: false,
      code: "unknown_transaction",
      message: "The transaction being undone is no longer available",
    };
  }
  if (original.actorId !== actorId) {
    return {
      ok: false,
      code: "undo_forbidden",
      message: "Only the author of a transaction can undo it",
    };
  }
  for (const entry of ledger.values()) {
    if (entry.actorId === actorId && entry.undoOf === undoOf) {
      return {
        ok: false,
        code: "already_undone",
        message: "That transaction was already compensated",
      };
    }
  }
  return { ok: true };
}

/** Record one accepted transaction, including its optional compensation target. */
export function recordUndo(
  ledger: Map<string, UndoLedgerEntry>,
  key: string,
  actorId: string,
  undoOf?: string,
  transactionId = key,
): void {
  ledger.set(key, {
    actorId,
    transactionId,
    ...(undoOf ? { undoOf } : {}),
  });
}

/** Remove one transaction from the ledger when the retained log is trimmed. */
export function deleteUndo(ledger: Map<string, UndoLedgerEntry>, key: string): void {
  ledger.delete(key);
}

/** Number of transaction ids the ledger retains. */
export function undoLedgerSize(ledger: ReadonlyMap<string, UndoLedgerEntry>): number {
  return ledger.size;
}
