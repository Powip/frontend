import type { DespatchAdvice } from "@/features/sunat/despatch-advice/types/despatch-advice.types";
import { GRE_DOCUMENT_TYPE_LABEL, GRE_MODE_LABEL, GRE_REASON_LABEL, GRE_STATUS_LABEL } from "@/features/sunat/despatch-advice/utils/gre-form";
import type { PdfDocSpec } from "./document";

// FEAT-24 H12 — representación impresa de la guía de remisión remitente, armada
// con el helper común de H10-B a partir de lo que guardó ms-sunat (el backend no
// devuelve PDF). El QR (link de SUNAT del CDR) va solo cuando SUNAT la aceptó.

const day = (value: string) => {
  const [year, month, date] = value.split("-");
  return year && month && date ? `${date}/${month}/${year}` : value;
};

const place = (value: { address: string; establishmentCode?: string | null } | undefined) => value?.address ?? "—";

/** Emisor de la guía: RUC, razón social y dirección del perfil SUNAT que la emitió. */
export interface DespatchAdviceIssuer {
  ruc: string;
  razonSocial: string;
  direccion?: string | null;
}

export interface DespatchAdvicePdfOptions {
  /**
   * Emisor (multi-RUC: puede no ser la empresa de la sesión). Va en el encabezado en lugar de la
   * empresa; se ignora si su RUC no es el de la guía.
   */
  issuer?: DespatchAdviceIssuer | null;
  /** QR del link de SUNAT como data URL PNG. */
  qrDataUrl?: string | null;
}

export function despatchAdvicePdfSpec(advice: DespatchAdvice, options: DespatchAdvicePdfOptions = {}): PdfDocSpec {
  const payload = advice.payload;
  const issuer = options.issuer && options.issuer.ruc === advice.rucIssuer ? options.issuer : null;
  const accepted = advice.status === "ACCEPTED" || advice.status === "ACCEPTED_WITH_OBSERVATION";
  const recipient = payload.recipient
    ? `${GRE_DOCUMENT_TYPE_LABEL[payload.recipient.identityDocumentType] ?? "Doc."} ${payload.recipient.identityDocumentNumber} · ${payload.recipient.name}`
    : "La propia empresa";
  const related = (payload.relatedDocuments ?? []).map((document) => `${document.documentType === "01" ? "Factura" : "Boleta"} ${document.number}`).join(", ");

  const transportRows: Array<[string, string]> =
    payload.transportMode === "01"
      ? [
          ["Transportista", payload.carrier ? `RUC ${payload.carrier.ruc} · ${payload.carrier.name}` : "—"],
          ...(payload.carrier?.mtcRegistrationNumber ? ([["Registro MTC", payload.carrier.mtcRegistrationNumber]] as Array<[string, string]>) : []),
        ]
      : [
          ["Placa", payload.vehicle?.plate ?? "—"],
          ...(payload.drivers ?? []).map(
            (driver, index): [string, string] => [
              index === 0 ? "Conductor" : `Conductor ${index + 1}`,
              `${GRE_DOCUMENT_TYPE_LABEL[driver.identityDocumentType] ?? "Doc."} ${driver.identityDocumentNumber} · ${driver.firstName} ${driver.familyName} · Licencia ${driver.licenseNumber}`,
            ],
          ),
        ];

  return {
    title: "Guía de remisión remitente",
    number: advice.number,
    date: day(advice.issueDate),
    meta: [
      ["Emisor", issuer ? `${issuer.razonSocial} · RUC ${advice.rucIssuer}` : `RUC ${advice.rucIssuer}`],
      ["Estado SUNAT", GRE_STATUS_LABEL[advice.status] ?? advice.status],
      ["Motivo", `${advice.transferReason} · ${GRE_REASON_LABEL[advice.transferReason] ?? ""}`],
      ["Modalidad", `${advice.transportMode} · ${GRE_MODE_LABEL[advice.transportMode] ?? ""}`],
      [advice.transportMode === "01" ? "Entrega al transportista" : "Inicio del traslado", day(payload.transferStartDate)],
      ["Peso bruto / bultos", `${payload.grossWeightKg} kg · ${payload.packageCount} bulto(s)`],
      ["Destinatario", recipient],
      ["Referencia", advice.externalReference ?? "—"],
      ["Comprobante relacionado", related || "—"],
    ],
    tables: [
      {
        title: "Partida y llegada",
        head: ["Punto", "Dirección", "Ubigeo", "Establecimiento"],
        rows: [
          ["Partida", place(payload.origin), payload.origin?.ubigeo, payload.origin?.establishmentCode ?? "—"],
          ["Llegada", place(payload.destination), payload.destination?.ubigeo, payload.destination?.establishmentCode ?? "—"],
        ],
      },
      { title: "Transporte", head: ["Dato", "Detalle"], rows: transportRows },
      {
        title: "Bienes trasladados",
        head: ["#", "Código", "Descripción", "Cantidad", "Unidad"],
        rows: payload.items.map((item, index) => [String(index + 1), item.code ?? "—", item.description, String(item.quantity), item.unitCode]),
        align: ["right", "left", "left", "right", "left"],
      },
    ],
    note: accepted
      ? `Representación impresa de la guía de remisión electrónica remitente.${payload.note ? ` Nota: ${payload.note}` : ""}`
      : `Sin validez para trasladar mercadería: SUNAT todavía no aceptó esta guía (${(GRE_STATUS_LABEL[advice.status] ?? advice.status).toLowerCase()}).`,
    ...(accepted && options.qrDataUrl ? { image: { dataUrl: options.qrDataUrl, caption: "Consulta esta guía en SUNAT escaneando el código QR." } } : {}),
    fileName: `GRE-${advice.rucIssuer}-${advice.number}`,
    ...(issuer ? { issuer: { name: issuer.razonSocial, ruc: advice.rucIssuer, address: issuer.direccion || null } } : {}),
  };
}
