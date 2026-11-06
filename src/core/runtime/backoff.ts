/**
 * Retry pacing shared by reconnects, local-service probes, and lease renewal.
 *
 * A policy is a pure function from attempt number to delay, so callers can test
 * their retry decisions without waiting. `Backoff` keeps the attempt count for a
 * live connection and resets it once the transport is healthy again.
 */

/** Delay curve for one retry sequence. `jitter` is a fraction of the base delay. */
export interface BackoffPolicy {
  readonly initialMs: number;
  readonly maxMs: number;
  readonly factor: number;
  /** 0 keeps delays exact; 0.2 spreads each delay by +/-20%. */
  readonly jitter: number;
}

/** Reconnect policy used by room clients: 750 ms, doubling, capped at 15 s. */
export const DEFAULT_BACKOFF: BackoffPolicy = Object.freeze({
  initialMs: 750,
  maxMs: 15_000,
  factor: 2,
  jitter: 0,
});

/**
 * Delay for one attempt.
 *
 * `attempt` is zero-based. A non-finite or negative attempt is treated as zero
 * so a corrupt counter cannot produce a negative timer. The result is always an
 * integer number of milliseconds within `[0, maxMs]`.
 */
export function backoffDelay(
  attempt: number,
  policy: BackoffPolicy = DEFAULT_BACKOFF,
  random: () => number = Math.random,
): number {
  const safeAttempt = Number.isFinite(attempt) ? Math.max(0, Math.floor(attempt)) : 0;
  const base = Math.min(policy.maxMs, policy.initialMs * policy.factor ** safeAttempt);
  if (policy.jitter <= 0) {
    return Math.max(0, Math.round(base));
  }
  const spread = base * Math.min(1, policy.jitter);
  const jittered = base - spread + random() * spread * 2;
  return Math.max(0, Math.min(policy.maxMs, Math.round(jittered)));
}

/** Stateful attempt counter for one connection or one repeated operation. */
export class Backoff {
  private readonly policy: BackoffPolicy;
  private readonly random: () => number;
  private attempt = 0;

  /** Create a counter; the policy and random source stay fixed for its lifetime. */
  constructor(policy: BackoffPolicy = DEFAULT_BACKOFF, random: () => number = Math.random) {
    this.policy = policy;
    this.random = random;
  }

  /** Number of delays produced since the last reset. */
  get attempts(): number {
    return this.attempt;
  }

  /** Produce the next delay and advance the counter. */
  next(): number {
    const delay = backoffDelay(this.attempt, this.policy, this.random);
    this.attempt += 1;
    return delay;
  }

  /** Return to the first delay after a successful connection. */
  reset(): void {
    this.attempt = 0;
  }
}
