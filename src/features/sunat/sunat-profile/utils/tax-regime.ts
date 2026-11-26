/**
 * Tax regime of the issuer (RUC) behind a SUNAT profile. Mirrors
 * ms-sunat-tax-documents `SUNAT_TAX_REGIMES`.
 *
 * - GENERAL: today's behavior (facturas and boletas with IGV).
 * - NUEVO_RUS: the issuer only issues boletas, and no line shows IGV.
 *   SUNAT: "El NRUS no permite la emisión de facturas, únicamente puede
 *   emitir boletas de venta y tickets"
 *   (https://orientacion.sunat.gob.pe/sites/default/files/inline-files/Nuevo_rus_carpeta_V2.pdf)
 *   and its comprobantes "no deben discriminar impuesto alguno"
 *   (Reglamento, art. 14.2 a), https://www.sunat.gob.pe/legislacion/rus/reglamento.html).
 */
export const SUNAT_TAX_REGIMES = {
  GENERAL: "GENERAL",
  NUEVO_RUS: "NUEVO_RUS",
} as const;

export type SunatTaxRegime = (typeof SUNAT_TAX_REGIMES)[keyof typeof SUNAT_TAX_REGIMES];

export const DEFAULT_SUNAT_TAX_REGIME: SunatTaxRegime = SUNAT_TAX_REGIMES.GENERAL;

export const SUNAT_TAX_REGIME_LABELS: Record<SunatTaxRegime, string> = {
  GENERAL: "Régimen general (con IGV)",
  NUEVO_RUS: "Nuevo RUS (solo boletas, sin IGV)",
};

export function isNuevoRus(taxRegime: string | null | undefined): boolean {
  return taxRegime === SUNAT_TAX_REGIMES.NUEVO_RUS;
}

/** Any value the API may send; unknown or missing means GENERAL. */
export function toSunatTaxRegime(value: string | null | undefined): SunatTaxRegime {
  return isNuevoRus(value) ? SUNAT_TAX_REGIMES.NUEVO_RUS : SUNAT_TAX_REGIMES.GENERAL;
}
