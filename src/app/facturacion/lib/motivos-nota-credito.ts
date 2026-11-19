import { IGV_RATE } from "@/features/sunat/shared/constants/sunat.constants";

/**
 * Motivos de nota de crédito ofrecidos en el modal, con su código del
 * catálogo SUNAT 09 (mismos códigos que SUNAT_CREDIT_NOTE_REASON_CODES en
 * ms-sunat-tax-documents).
 */
export const MOTIVOS_NC = [
  { code: "06", label: "Devolución total" },
  { code: "07", label: "Devolución por ítem" },
  { code: "01", label: "Anulación de la operación" },
  { code: "02", label: "Anulación por error en el RUC" },
  { code: "03", label: "Corrección por error en la descripción" },
  { code: "05", label: "Descuento por ítem" },
  { code: "08", label: "Bonificación" },
  { code: "04", label: "Descuento global" },
] as const;

export function getCodigoMotivoNc(motivo: string): string | undefined {
  return MOTIVOS_NC.find((item) => item.label === motivo)?.code;
}

/** "06 · Devolución total". Sin código conocido, solo la descripción. */
export function formatMotivoNota(nota: { motivo: string; motivoCodigo?: string }): string {
  const code = nota.motivoCodigo || getCodigoMotivoNc(nota.motivo);
  return code ? `${code} · ${nota.motivo}` : nota.motivo;
}

const round2 = (value: number) => Math.round(value * 100) / 100;

/**
 * Separa subtotal e IGV de un monto con IGV incluido. Si se conocen los
 * totales del comprobante original, usa su proporción de IGV (cubre
 * operaciones exoneradas o mixtas); si no, asume operación gravada al 18%.
 */
export function calcularMontosNota(
  total: number,
  original?: { taxTotal: number; grandTotal: number },
): { subtotal: number; igv: number; total: number } {
  const igvShare =
    original && original.grandTotal > 0
      ? original.taxTotal / original.grandTotal
      : IGV_RATE / (1 + IGV_RATE);

  const igv = round2(total * igvShare);

  return { subtotal: round2(total - igv), igv, total: round2(total) };
}
