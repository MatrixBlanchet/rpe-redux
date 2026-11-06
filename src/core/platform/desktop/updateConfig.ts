/**
 * Build-time update source configuration.
 *
 * Fill these before producing a signed updater build. They are deliberately not
 * settings rows: a repository URL or signing key is product provenance, not a
 * user preference, and the UI must not invite users to replace it.
 *
 * The public key must also be compiled into the Rust host as
 * `REDUX_UPDATE_PUBLIC_KEY`; the host treats that build-time value as the trust
 * anchor and rejects a renderer-supplied replacement.
 */
/** Release repository compiled into an updater build. */
export const UPDATE_REPOSITORY = "seacblue/rpe-redux";
/** Public key the Rust host uses as the update trust anchor. */
export const UPDATE_PUBLIC_KEY =
  "dW50cnVzdGVkIGNvbW1lbnQ6IG1pbmlzaWduIHB1YmxpYyBrZXk6IDA5QjdDRDhDOEJFN0U2NzMKUldSejV1ZUxqTTIzQ1RBbm9VWnRETWwvTXhwOVpsVUFqMEw3dmpVSTNpQ1ZWak5BaW9HZnlWRUkK";
