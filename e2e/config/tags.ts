import type { E2EEnv } from "./env";

/** Tags used in spec titles, e.g. `test("registers a lot", { tag: TAGS.WRITES_OLVA }, ...)`. */
export const TAGS = {
  /** Fast, read-only checks that prove the suite and the environment are alive. */
  SMOKE: "@smoke",
  /** Creates real shipments in Olva. Skipped unless E2E_ALLOW_REAL_SHIPMENTS=true. */
  WRITES_OLVA: "@writes-olva",
  /** Injects a failure into one endpoint (Olva errors cannot be produced on demand). */
  FAULT: "@fault",
} as const;

/** Value for Playwright's `grepInvert`: keeps gated specs out unless they were allowed. */
export function resolveGrepInvert(
  env: Pick<E2EEnv, "E2E_ALLOW_REAL_SHIPMENTS">,
): RegExp | undefined {
  return env.E2E_ALLOW_REAL_SHIPMENTS ? undefined : new RegExp(TAGS.WRITES_OLVA);
}
