/**
 * Consent rules for the Extension install review.
 *
 * The dialog shows every capability a manifest declares, grouped by the risk
 * tier from the shared capability catalog. Read access starts selected; write
 * and sensitive access starts unselected. Installation is all-or-nothing: the
 * confirmed set must contain every declared capability, so unchecking any row
 * disables the install button instead of granting a partial package.
 *
 * The deprecated `host.patch` name grants nothing and has no consent row, so
 * the catalog filters it out before any group, default, or decision is built.
 */
import type { ExtensionCapability } from "../../../../core/extensions/capabilities.ts";
import {
  consentRowsFor,
  type CapabilityConsentRow,
} from "../../../../core/extensions/capabilityCatalog.ts";
import type { ExtensionMethodRisk } from "../../../../core/extensions/methodRegistry.ts";

/** Risk groups in display order. */
export const CONSENT_RISK_ORDER = Object.freeze([
  "read",
  "write",
  "sensitive",
] as const satisfies readonly ExtensionMethodRisk[]);

/** One risk group of consent rows in catalog order. */
export interface CapabilityConsentGroup {
  /** Risk tier shared by the rows in this group. */
  readonly risk: ExtensionMethodRisk;
  /** Declared rows at this tier; a group is omitted when this is empty. */
  readonly rows: readonly CapabilityConsentRow[];
}

/** Confirmed capabilities, accepted as the dialog's set or a plain list. */
export type ConsentSelection = ReadonlySet<ExtensionCapability> | readonly ExtensionCapability[];

/** The install gate derived from one manifest declaration and its checkboxes. */
export interface ConsentDecision {
  /** True only when every declared capability is confirmed. */
  readonly ok: boolean;
  /** Declared capabilities still unchecked, in catalog order. */
  readonly missing: readonly ExtensionCapability[];
}

/** Whether a selection contains one capability without assuming its container. */
function isConfirmed(selection: ConsentSelection, capability: ExtensionCapability): boolean {
  return "has" in selection ? selection.has(capability) : selection.includes(capability);
}

/**
 * Group the declared capabilities by risk in [[CONSENT_RISK_ORDER]].
 *
 * Only groups with at least one row are returned, in fixed risk order. Rows
 * keep catalog order; duplicates and the deprecated `host.patch` name are
 * dropped by `consentRowsFor`.
 */
export function consentGroups(
  capabilities: readonly ExtensionCapability[],
): readonly CapabilityConsentGroup[] {
  const rows = consentRowsFor(capabilities);
  return Object.freeze(
    CONSENT_RISK_ORDER.map((risk) =>
      Object.freeze({
        risk,
        rows: Object.freeze(rows.filter((row) => row.risk === risk)),
      }),
    ).filter((group) => group.rows.length > 0),
  );
}

/**
 * The default checkbox state: read access is preselected, everything else is
 * left for the user to confirm explicitly.
 */
export function defaultConsentSelection(
  capabilities: readonly ExtensionCapability[],
): ReadonlySet<ExtensionCapability> {
  return new Set(
    consentRowsFor(capabilities)
      .filter((row) => row.risk === "read")
      .map((row) => row.capability),
  );
}

/**
 * Decide whether the reviewed package may be installed.
 *
 * Every declared capability must be confirmed. Unchecking a read row is
 * allowed as an interaction but makes the package incomplete, so it appears in
 * `missing` alongside any unchecked write or sensitive row.
 */
export function consentDecision(
  declared: readonly ExtensionCapability[],
  selection: ConsentSelection,
): ConsentDecision {
  const missing = consentRowsFor(declared)
    .map((row) => row.capability)
    .filter((capability) => !isConfirmed(selection, capability));
  return Object.freeze({ ok: missing.length === 0, missing: Object.freeze(missing) });
}

/** Declared capabilities that require a second confirmation before checking. */
export function sensitiveCapabilities(
  capabilities: readonly ExtensionCapability[],
): readonly ExtensionCapability[] {
  return Object.freeze(
    consentRowsFor(capabilities)
      .filter((row) => row.risk === "sensitive")
      .map((row) => row.capability),
  );
}
