/**
 * Pure derivations over the Extension contract: content kind, provenance, and
 * the host-computed trust state. Nothing here reads storage, the DOM, or the
 * network, so the rules stay testable and cannot be declared by a package.
 */
import type { PersistedExtensionState } from "./extensionRuntimeSupport.ts";
import type {
  ExtensionConsent,
  ExtensionContent,
  ExtensionProvenance,
  ExtensionSource,
  ExtensionTrustState,
  MaterializedExtensionManifest,
  ExtensionStatus,
} from "./extensionContract.ts";

/** The facts the trust rules are allowed to read from one runtime record. */
export interface TrustFacts {
  manifest: MaterializedExtensionManifest;
  status: ExtensionStatus;
  error: string | null;
  fingerprint: string | null;
  source: ExtensionSource;
  /** Only the host loader may set this after checking the build allowlist. */
  verifiedBuiltin: boolean;
  riskAcknowledged: boolean;
  acknowledgedFingerprint: string | null;
  consentStale: boolean;
}

/** The content kind is a consequence of the manifest shape, not a declaration. */
export function contentOf(manifest: MaterializedExtensionManifest): ExtensionContent {
  return manifest.entry === undefined ? "data-only" : "code";
}

/** Copy the declared provenance fields; missing fields stay absent. */
export function provenanceOf(manifest: MaterializedExtensionManifest): ExtensionProvenance {
  const provenance: ExtensionProvenance = {};
  if (manifest.sourceUrl !== undefined) {
    provenance.sourceUrl = manifest.sourceUrl;
  }
  if (manifest.homepage !== undefined) {
    provenance.homepage = manifest.homepage;
  }
  if (manifest.repository !== undefined) {
    provenance.repository = manifest.repository;
  }
  if (manifest.license !== undefined) {
    provenance.license = manifest.license;
  }
  if (manifest.author !== undefined) {
    provenance.author = manifest.author;
  }
  return provenance;
}

/**
 * Consent applies to specific bytes.
 *
 * Only the loader's build-allowlist match (`verifiedBuiltin`) bypasses consent;
 * a package that merely claims a built-in id still needs acknowledgement.
 */
export function consentOf(facts: TrustFacts): ExtensionConsent {
  if (facts.verifiedBuiltin) {
    return "current";
  }
  if (facts.fingerprint === null) {
    return facts.riskAcknowledged ? "current" : "none";
  }
  if (facts.riskAcknowledged && facts.acknowledgedFingerprint === facts.fingerprint) {
    return "current";
  }
  return facts.consentStale ? "stale" : "none";
}

/** Derive the host trust label from status, provenance, and current consent. */
export function trustStateOf(facts: TrustFacts): ExtensionTrustState {
  if (facts.status === "failed" || facts.error !== null) {
    return "blocked";
  }
  if (facts.verifiedBuiltin) {
    return "builtin";
  }
  const consent = consentOf(facts);
  if (consent === "stale") {
    return "blocked";
  }
  return consent === "current" ? "local-trusted" : "external-pending";
}

/** The consent facts derived from persisted state for the current bytes. */
export interface ConsentState {
  riskAcknowledged: boolean;
  acknowledgedFingerprint: string | null;
  consentStale: boolean;
}

/**
 * Match persisted consent against the current fingerprint.
 *
 * A shipped built-in is always current. Different stored bytes invalidate the
 * acknowledgement and mark consent stale; a stored acknowledgement without a
 * fingerprint is unconfirmed rather than stale.
 */
export function resolveConsent(
  fingerprint: string | null,
  persisted: PersistedExtensionState,
  verifiedBuiltin = false,
): ConsentState {
  if (verifiedBuiltin) {
    return {
      riskAcknowledged: true,
      acknowledgedFingerprint: fingerprint,
      consentStale: false,
    };
  }
  if (fingerprint === null) {
    return {
      riskAcknowledged: persisted.acknowledged,
      acknowledgedFingerprint: persisted.acknowledged ? fingerprint : null,
      consentStale: false,
    };
  }
  if (persisted.fingerprint === fingerprint) {
    return {
      riskAcknowledged: persisted.acknowledged,
      acknowledgedFingerprint: persisted.acknowledged ? fingerprint : null,
      consentStale: false,
    };
  }
  // Different stored bytes invalidate consent; a stored acknowledgement without
  // a fingerprint stays unconfirmed.
  return {
    riskAcknowledged: false,
    acknowledgedFingerprint: null,
    consentStale: persisted.acknowledged && persisted.fingerprint !== null,
  };
}
