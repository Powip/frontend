/**
 * Dominio de Facturación SUNAT (comprobantes, guías de remisión, notas de
 * crédito/débito, certificado digital y series).
 *
 * Los catálogos de códigos (ERRORES_SUNAT, ERRORES_GRE) son códigos oficiales
 * SUNAT y no dependen del backend. Los de la guía de remisión real (motivos,
 * modalidades, estados) están en features/sunat/despatch-advice (FEAT-24 H12).
 */

export type EstadoComprobante =
  | "SIN_EMITIR"
  | "PENDIENTE_FIRMA"
  | "ENVIADO_OSE"
  | "ACEPTADO"
  | "ACEPTADO_CON_OBS"
  | "RECHAZADO"
  | "BAJA";

export interface EstadoComprobanteMeta {
  label: string;
  badgeClassName: string;
  description: string;
  who: string;
}

export const ESTADOS_COMPROBANTE: Record<EstadoComprobante, EstadoComprobanteMeta> = {
  SIN_EMITIR: {
    label: "Sin Emitir",
    badgeClassName: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
    description: "Venta ENTREGADO lista para facturar. No se ha generado ningún XML.",
    who: "Automático al pasar a ENTREGADO",
  },
  PENDIENTE_FIRMA: {
    label: "Pendiente de Firma",
    badgeClassName: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
    description: "XML generado, esperando firma digital del certificado del negocio.",
    who: "Sistema interno",
  },
  ENVIADO_OSE: {
    label: "Enviado a OSE",
    badgeClassName: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 animate-pulse",
    description: "XML firmado enviado al OSE para reenvío a SUNAT.",
    who: "Sistema interno",
  },
  ACEPTADO: {
    label: "Aceptado",
    badgeClassName: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
    description: "CDR recibido con estado 0. Comprobante válido ante SUNAT.",
    who: "SUNAT vía OSE",
  },
  ACEPTADO_CON_OBS: {
    label: "Aceptado c/ Obs.",
    badgeClassName:
      "bg-gradient-to-r from-green-100 to-amber-100 text-green-700 border-amber-200 dark:from-green-950 dark:to-amber-950 dark:text-green-300 dark:border-amber-800",
    description: "CDR aceptado pero con observaciones. Válido, con advertencias.",
    who: "SUNAT vía OSE",
  },
  RECHAZADO: {
    label: "Rechazado",
    badgeClassName: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
    description: "CDR con código de error. El comprobante no es válido.",
    who: "SUNAT vía OSE",
  },
  BAJA: {
    label: "Anulado (Baja)",
    badgeClassName: "bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
    description: "Comprobante anulado mediante comunicación de baja (tipo 09).",
    who: "Operador + SUNAT",
  },
};

export interface ErrorSunat {
  code: string;
  desc: string;
  sol: string;
}

export const ERRORES_SUNAT: ErrorSunat[] = [
  { code: "0", desc: "Aceptado sin observaciones", sol: "Ninguna — comprobante válido" },
  { code: "2000", desc: "Aceptado con observaciones", sol: "Válido, pero revisar la observación en el CDR" },
  { code: "0156", desc: "La fecha de emisión está fuera del rango permitido", sol: "Verificar que la fecha no sea mayor a 7 días desde la entrega" },
  { code: "1033", desc: "El comprobante fue registrado previamente con otros datos", sol: "Ese número ya existe en SUNAT con otros datos: probablemente la serie la usa otro sistema de facturación. Usa una serie nueva o inicia esta serie por encima del último número emitido fuera de Powip" },
  { code: "2335", desc: "El RUC del receptor no es válido o no existe", sol: "Re-verificar el RUC en sunat.gob.pe antes de reenviar" },
  { code: "2800", desc: "El número de DNI del receptor no es válido", sol: "Verificar DNI en RENIEC antes de reenviar" },
  { code: "2801", desc: "El nombre del receptor no coincide con el documento", sol: "Usar el nombre exacto de RENIEC/SUNAT" },
  { code: "3010", desc: "El monto del IGV no cuadra con el subtotal", sol: "Recalcular con exactamente 18% y 2 decimales" },
  { code: "3030", desc: "Falta el código de local anexo del emisor", sol: "En Emisores (RUC), pulsa «Editar código» del emisor, completa el código de establecimiento (usa 0000 si es la casa matriz) y vuelve a emitir" },
  { code: "3100", desc: "El XML no tiene firma digital o la firma no es válida", sol: "El certificado P12 puede haber expirado o la contraseña es incorrecta" },
  { code: "3101", desc: "El certificado digital ha expirado", sol: "Renovar el certificado en la entidad certificadora" },
];

export const ERRORES_GRE: ErrorSunat[] = [
  { code: "0", desc: "Aceptada sin observaciones", sol: "Ninguna — guía válida" },
  { code: "3452", desc: "Falta Tarjeta Única de Circulación o Certificado de Habilitación vehicular", sol: "Solo aplica a modalidad Transporte Público — completa los datos del transportista" },
  { code: "2554", desc: "Tipo y número de documento de identidad del destinatario inválido", sol: "Verificar el documento del cliente destinatario" },
  { code: "3419", desc: "Falta número de bultos o pallets", sol: "Indica cuántos bultos se están trasladando" },
  { code: "3406", desc: "La fecha de inicio de traslado no es válida", sol: "La fecha de inicio de traslado no puede ser posterior a la fecha de entrega" },
];

export interface Serie {
  serie: string;
  tipo: string;
  ultimo: number;
  activa: boolean;
}

export interface ItemComprobante {
  desc: string;
  qty: number;
  price: number;
}

export interface NotaItem {
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
  importe: number;
}

export interface Nota {
  fecha: string;
  num: string;
  original: string;
  /** Tipo del comprobante que modifica: 01 factura, 03 boleta. */
  tipoOriginal?: "01" | "03";
  cliente: string;
  motivo: string;
  /** Código del motivo según catálogo SUNAT 09 (p. ej. "06" = Devolución total). */
  motivoCodigo?: string;
  /** Monto total de la nota, IGV incluido. */
  monto: number;
  subtotal?: number;
  igv?: number;
  items?: NotaItem[];
  /** RUC que emitió el comprobante original (multi-RUC). */
  rucEmisor?: string;
  estado: string;
}

export interface Certificado {
  configurado: boolean;
  razon: string;
  ruc: string;
  desde: string;
  hasta: string;
  diasParaVencer: number;
}
