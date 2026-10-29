export class PartnersFeatureUnavailableError extends Error {
  readonly code = "PERMANENT_FEATURE_UNAVAILABLE";

  constructor(readonly operation: string) {
    super(
      `${operation} todavía no está implementado. No se muestran datos de ejemplo ni se realizan cambios locales.`,
    );
    this.name = "PartnersFeatureUnavailableError";
  }
}

export function isPartnersFeatureUnavailable(
  error: unknown,
): error is PartnersFeatureUnavailableError {
  return error instanceof PartnersFeatureUnavailableError;
}

export function unavailablePartnersFeature(operation: string): never {
  throw new PartnersFeatureUnavailableError(operation);
}

export function partnersMutationErrorMessage(error: unknown, fallback: string): string {
  return isPartnersFeatureUnavailable(error) ? error.message : fallback;
}
