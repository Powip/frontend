export interface PartnersApiErrorDto {
  code: string;
  message: string;
  correlationId: string | null;
  details: Record<string, unknown>;
}
