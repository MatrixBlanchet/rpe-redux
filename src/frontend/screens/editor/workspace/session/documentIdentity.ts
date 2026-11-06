/**
 * Editor-side re-export of the shared document identity contract.
 *
 * The display model is consumed by persistent chrome, so its implementation
 * lives in `frontend/contracts/documentIdentity.ts`. This path stays as the
 * editor session's import site and keeps existing callers working.
 */
export * from "../../../../contracts/documentIdentity.ts";
