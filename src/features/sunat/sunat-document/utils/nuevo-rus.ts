import { IGV_RATE } from "@/features/sunat/shared/constants/sunat.constants";
import { isNuevoRus } from "@/features/sunat/sunat-profile/utils/tax-regime";
import { SUNAT_TAX_AFFECTATION_TYPES } from "../enums/sunat-document.enums";

/**
 * Catalog 07 code of every non-gift line of a Nuevo RUS issuer. Mirrors
 * ms-sunat-tax-documents `NUEVO_RUS_TAX_TYPE`.
 *
 * NO VERIFICADO: no official SUNAT source says which code a Nuevo RUS boleta
 * line must declare. 20 (exonerado) was decided by Jairo; switching to 30
 * (inafecto) is only this constant, here and in ms-sunat.
 */
export const NUEVO_RUS_TAX_TYPE = SUNAT_TAX_AFFECTATION_TYPES.EXONERADO;

/**
 * IGV rate a line of this issuer carries: 0 for Nuevo RUS (its boletas
 * "no deben discriminar impuesto alguno", Reglamento art. 14.2 a)), 18% for
 * everyone else.
 */
export function getIssuerIgvRate(taxRegime: string | null | undefined): number {
  return isNuevoRus(taxRegime) ? 0 : IGV_RATE;
}
