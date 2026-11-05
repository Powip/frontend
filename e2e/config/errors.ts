/** The environment (.env.e2e / process env) is missing, malformed or inconsistent. */
export class E2EConfigError extends Error {
  override readonly name = "E2EConfigError";
}

/** A safety rule stopped the run: wrong host, wrong tenant or a gated action. */
export class EnvironmentGuardError extends Error {
  override readonly name = "EnvironmentGuardError";
}
