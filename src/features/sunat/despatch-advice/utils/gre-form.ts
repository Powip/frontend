import { formatVariantLabel } from "@/lib/variantAttributes";
import type {
  DespatchAdviceStatus,
  DespatchIdentityDocumentType,
  DespatchRelatedDocumentType,
  DespatchTransferReason,
  DespatchTransportMode,
  IssueDespatchAdviceRequest,
} from "../types/despatch-advice.types";

// FEAT-24 H12 — formulario de la guía de remisión remitente: precarga desde un
// pedido (motivo 01) o un traslado (motivo 04), las mismas reglas SUNAT que
// valida ms-sunat (src/domain/despatch-advice/despatch-advice.rules.ts) con
// mensajes en español, el cuerpo del POST y la traducción de los errores del
// backend. Funciones puras.

export const GRE_REASON = { SALE: "01", TRANSFER: "04" } as const satisfies Record<string, DespatchTransferReason>;
export const GRE_MODE = { PUBLIC: "01", PRIVATE: "02" } as const satisfies Record<string, DespatchTransportMode>;

export const GRE_REASON_LABEL: Record<DespatchTransferReason, string> = {
  "01": "Venta",
  "04": "Traslado entre establecimientos",
};

export const GRE_MODE_LABEL: Record<DespatchTransportMode, string> = {
  "01": "Transporte público",
  "02": "Transporte privado",
};

export const GRE_STATUS_LABEL: Record<DespatchAdviceStatus, string> = {
  PENDING: "Pendiente de envío",
  SENT: "Enviada a SUNAT",
  ACCEPTED: "Aceptada",
  ACCEPTED_WITH_OBSERVATION: "Aceptada con observaciones",
  REJECTED: "Rechazada",
};

export const GRE_STATUS_CLASS: Record<DespatchAdviceStatus, string> = {
  PENDING: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  SENT: "bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200",
  ACCEPTED: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
  ACCEPTED_WITH_OBSERVATION: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
  REJECTED: "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200",
};

export const GRE_DOCUMENT_TYPE_LABEL: Record<DespatchIdentityDocumentType, string> = {
  "1": "DNI",
  "4": "Carné de extranjería",
  "6": "RUC",
  "7": "Pasaporte",
};

/** Estados de pedido desde los que se ofrece emitir la guía: el paquete existe y todavía no llegó. */
export const GRE_ELIGIBLE_ORDER_STATUSES = ["PREPARADO", "LLAMADO", "ASIGNADO_A_GUIA", "EN_ENVIO", "DESPACHADO"] as const;

export const isGreEligibleOrderStatus = (status: string | null | undefined): boolean =>
  (GRE_ELIGIBLE_ORDER_STATUSES as readonly string[]).includes((status ?? "").toUpperCase());

/** Traslados para los que tiene sentido la guía: antes de salir o en camino. */
export const isGreEligibleTransferStatus = (status: string | null | undefined): boolean =>
  status === "borrador" || status === "en_camino";

/** Una guía «viva» (no rechazada) de la misma referencia avisa antes de emitir otra. */
export const isLiveDespatchAdvice = (status: DespatchAdviceStatus): boolean => status !== "REJECTED";

export interface GrePlace {
  ubigeo: string;
  address: string;
  establishmentCode: string;
}

export interface GreFormState {
  sunatProfileId: string;
  transferReason: DespatchTransferReason;
  transportMode: DespatchTransportMode;
  /** yyyy-mm-dd */
  transferStartDate: string;
  grossWeightKg: string;
  packageCount: string;
  note: string;
  recipient: { documentType: DespatchIdentityDocumentType; documentNumber: string; name: string };
  /** Ubigeo vacío = sin confirmar: el campo de ubigeo solo escribe códigos INEI válidos. */
  origin: GrePlace;
  destination: GrePlace;
  carrier: { ruc: string; name: string; mtcRegistrationNumber: string };
  vehicle: { plate: string };
  driver: { documentType: DespatchIdentityDocumentType; documentNumber: string; firstName: string; familyName: string; licenseNumber: string };
  relatedDocument: { documentType: DespatchRelatedDocumentType; number: string } | null;
  items: Array<{ description: string; quantity: number; code: string | null }>;
  externalReference: string;
}

export interface GreWarehouseInput {
  name?: string | null;
  ubigeo?: string | null;
  address?: string | null;
  sunatEstablishmentCode?: string | null;
}

export interface GreOrderInput {
  orderNumber: string;
  customer?: {
    fullName?: string | null;
    documentType?: string | null;
    documentNumber?: string | null;
    /** En los pedidos, `city` es el departamento. */
    city?: string | null;
    province?: string | null;
    district?: string | null;
    address?: string | null;
  } | null;
  items?: Array<{
    sku?: string | null;
    productName?: string | null;
    attributes?: Record<string, unknown> | null;
    quantity?: number | string | null;
  }> | null;
}

export interface GreTransferInput {
  number: string;
  lines: Array<{ sku?: string | null; productName?: string | null; quantitySent: number }>;
}

/** Nombres de la dirección del cliente, para resolverlos al ubigeo INEI. */
export interface GreAddressNames {
  department: string;
  province: string;
  district: string;
}

const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");

export function emptyGreForm(today: string): GreFormState {
  return {
    sunatProfileId: "",
    transferReason: GRE_REASON.SALE,
    transportMode: GRE_MODE.PUBLIC,
    transferStartDate: today,
    grossWeightKg: "",
    packageCount: "1",
    note: "",
    recipient: { documentType: "1", documentNumber: "", name: "" },
    origin: { ubigeo: "", address: "", establishmentCode: "" },
    destination: { ubigeo: "", address: "", establishmentCode: "" },
    carrier: { ruc: "", name: "", mtcRegistrationNumber: "" },
    vehicle: { plate: "" },
    driver: { documentType: "1", documentNumber: "", firstName: "", familyName: "", licenseNumber: "" },
    relatedDocument: null,
    items: [],
    externalReference: "",
  };
}

/** Tipo de documento SUNAT (catálogo 06) del cliente del pedido. */
export function greDocumentTypeFor(documentType: string | null | undefined, documentNumber: string | null | undefined): DespatchIdentityDocumentType {
  const kind = text(documentType).toUpperCase();
  const number = text(documentNumber);
  if (kind === "RUC") return "6";
  if (kind === "CARNET" || kind === "CE") return "4";
  if (kind === "PASAPORTE") return "7";
  if (kind === "DNI") return "1";
  return /^\d{11}$/.test(number) ? "6" : "1";
}

/** Punto de la ficha del almacén. Un ubigeo que no tenga 6 dígitos queda vacío (hay que elegirlo). */
export function grePlaceFromWarehouse(warehouse: GreWarehouseInput | null | undefined): GrePlace {
  const ubigeo = text(warehouse?.ubigeo);
  return {
    ubigeo: /^\d{6}$/.test(ubigeo) ? ubigeo : "",
    address: text(warehouse?.address),
    establishmentCode: text(warehouse?.sunatEstablishmentCode),
  };
}

/** Motivo 01: destinatario, llegada e ítems del pedido; partida = su almacén. */
export function greFormFromOrder(
  order: GreOrderInput,
  warehouse: GreWarehouseInput | null | undefined,
  today: string,
): { form: GreFormState; destinationNames: GreAddressNames } {
  const customer = order.customer ?? {};
  const form = emptyGreForm(today);
  form.transferReason = GRE_REASON.SALE;
  form.externalReference = order.orderNumber;
  form.recipient = {
    documentType: greDocumentTypeFor(customer.documentType, customer.documentNumber),
    documentNumber: text(customer.documentNumber),
    name: text(customer.fullName),
  };
  form.origin = grePlaceFromWarehouse(warehouse);
  form.destination = { ubigeo: "", address: text(customer.address), establishmentCode: "" };
  form.items = (order.items ?? [])
    .map((item) => {
      const attributes = formatVariantLabel(item.attributes ?? null);
      return {
        description: [text(item.productName) || "Producto", attributes].filter(Boolean).join(" · "),
        quantity: Number(item.quantity ?? 0),
        code: text(item.sku) || null,
      };
    })
    .filter((item) => item.quantity > 0);
  return {
    form,
    destinationNames: { department: text(customer.city), province: text(customer.province), district: text(customer.district) },
  };
}

/** Motivo 04: partida y llegada desde las fichas de los dos almacenes. */
export function greFormFromTransfer(
  transfer: GreTransferInput,
  origin: GreWarehouseInput | null | undefined,
  destination: GreWarehouseInput | null | undefined,
  today: string,
): GreFormState {
  const form = emptyGreForm(today);
  form.transferReason = GRE_REASON.TRANSFER;
  form.externalReference = transfer.number;
  form.origin = grePlaceFromWarehouse(origin);
  form.destination = grePlaceFromWarehouse(destination);
  form.items = transfer.lines
    .filter((line) => line.quantitySent > 0)
    .map((line) => ({ description: text(line.productName) || "Producto", quantity: line.quantitySent, code: text(line.sku) || null }));
  return form;
}

/* ---------------------------------------------------------------------------
   Reglas (las mismas que ms-sunat, antes de tomar número)
--------------------------------------------------------------------------- */

const RUC = /^\d{11}$/;
const DNI = /^\d{8}$/;
const FOREIGN_DOCUMENT = /^[A-Za-z0-9]{1,12}$/;
const UBIGEO = /^\d{6}$/;
const ESTABLISHMENT = /^\d{4}$/;
const PLATE = /^[A-Z0-9]{6,8}$/;
const LICENSE = /^[A-Z0-9]{9,10}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const RELATED_NUMBER = /^[A-Z0-9]{4}-\d{1,8}$/;

/** Placas y licencias se comparan sin mayúsculas, espacios ni guiones. */
export const compactCode = (value: string) => value.toUpperCase().replace(/[\s-]/g, "");

function isValidDate(value: string): boolean {
  if (!DATE.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function hasAtMostDecimals(value: number, decimals: number): boolean {
  const factor = 10 ** decimals;
  return Number.isFinite(value) && Math.abs(Math.round(value * factor) - value * factor) < 1e-6;
}

const normalizeAddress = (value: string) => value.trim().toLowerCase().replace(/\s+/g, " ");

function documentProblem(type: DespatchIdentityDocumentType, number: string, who: string): string | null {
  const value = number.trim();
  if (!value) return `Ingresa el documento ${who}.`;
  if (type === "1" && !DNI.test(value)) return `El DNI ${who} tiene 8 dígitos.`;
  if (type === "6" && !RUC.test(value)) return `El RUC ${who} tiene 11 dígitos.`;
  if ((type === "4" || type === "7") && !FOREIGN_DOCUMENT.test(value)) return `El documento ${who} tiene de 1 a 12 letras o números.`;
  return null;
}

export interface GreFormContext {
  /** Hoy en Perú (yyyy-mm-dd): la fecha de emisión de la guía. */
  today: string;
  /** RUC del perfil elegido, si se conoce. */
  issuerRuc: string | null;
}

/** Problemas del formulario por campo (ruta del cuerpo); vacío = se puede emitir. */
export function greFormProblems(form: GreFormState, context: GreFormContext): Record<string, string> {
  const problems: Record<string, string> = {};
  const add = (path: string, message: string) => {
    if (!problems[path]) problems[path] = message;
  };
  const isTransfer = form.transferReason === GRE_REASON.TRANSFER;

  if (!form.sunatProfileId) add("sunatProfileId", "Elige el RUC que emite la guía.");

  if (!isValidDate(form.transferStartDate)) add("transferStartDate", "Ingresa la fecha de inicio del traslado.");
  else if (form.transferStartDate < context.today) add("transferStartDate", "La fecha de inicio del traslado no puede ser anterior a hoy.");

  const weight = Number(form.grossWeightKg.replace(",", "."));
  if (!form.grossWeightKg.trim() || !(weight > 0) || !hasAtMostDecimals(weight, 3))
    add("grossWeightKg", "Ingresa el peso bruto en kg: mayor que 0 y con hasta 3 decimales.");

  const packages = Number(form.packageCount);
  if (!Number.isInteger(packages) || packages < 1) add("packageCount", "Los bultos son un número entero desde 1.");

  if (form.note.length > 250) add("note", "La nota tiene como máximo 250 caracteres.");

  if (!isTransfer) {
    const problem = documentProblem(form.recipient.documentType, form.recipient.documentNumber, "del destinatario");
    if (problem) add("recipient.identityDocumentNumber", problem);
    else if (context.issuerRuc && form.recipient.documentType === "6" && form.recipient.documentNumber.trim() === context.issuerRuc)
      add("recipient.identityDocumentNumber", "En una venta el destinatario no puede ser tu propio RUC.");
    if (!form.recipient.name.trim()) add("recipient.name", "Ingresa el nombre o la razón social del destinatario.");
    else if (form.recipient.name.length > 250) add("recipient.name", "El nombre del destinatario tiene como máximo 250 caracteres.");
  }

  for (const [key, place, label] of [
    ["origin", form.origin, "de partida"],
    ["destination", form.destination, "de llegada"],
  ] as const) {
    if (!UBIGEO.test(place.ubigeo)) add(`${key}.ubigeo`, `Elige departamento, provincia y distrito del punto ${label}.`);
    if (!place.address.trim()) add(`${key}.address`, `Ingresa la dirección del punto ${label}.`);
    else if (place.address.length > 500) add(`${key}.address`, `La dirección del punto ${label} tiene como máximo 500 caracteres.`);
    if (place.establishmentCode.trim() && !ESTABLISHMENT.test(place.establishmentCode.trim()))
      add(`${key}.establishmentCode`, `El código de establecimiento ${label} tiene 4 dígitos (por ejemplo, 0001).`);
    else if (isTransfer && !place.establishmentCode.trim())
      add(`${key}.establishmentCode`, `En un traslado entre establecimientos falta el código SUNAT del establecimiento ${label}: cárgalo en la ficha del almacén.`);
  }

  const sameAddress =
    UBIGEO.test(form.origin.ubigeo) &&
    form.origin.ubigeo === form.destination.ubigeo &&
    form.origin.address.trim() !== "" &&
    normalizeAddress(form.origin.address) === normalizeAddress(form.destination.address);
  const sameEstablishment = form.origin.establishmentCode.trim() !== "" && form.origin.establishmentCode.trim() === form.destination.establishmentCode.trim();
  if (sameAddress || sameEstablishment) add("destination", "El punto de llegada no puede ser el mismo que el de partida.");

  if (form.items.length === 0) add("items", "La guía necesita al menos un producto.");
  form.items.forEach((item, index) => {
    if (!item.description.trim()) add(`items.${index}.description`, `Ítem ${index + 1}: falta la descripción.`);
    if (!(item.quantity > 0)) add(`items.${index}.quantity`, `Ítem ${index + 1}: la cantidad tiene que ser mayor que 0.`);
  });

  if (form.relatedDocument && form.relatedDocument.number.trim() && !RELATED_NUMBER.test(form.relatedDocument.number.trim().toUpperCase()))
    add("relatedDocuments.0.number", "El comprobante relacionado se escribe como B001-123.");

  if (form.transportMode === GRE_MODE.PUBLIC) {
    const ruc = form.carrier.ruc.trim();
    if (!RUC.test(ruc)) add("carrier.ruc", "El RUC del transportista tiene 11 dígitos.");
    else if (context.issuerRuc && ruc === context.issuerRuc)
      add("carrier.ruc", "Con transporte público el transportista no puede ser tu propio RUC: usa transporte privado.");
    if (!form.carrier.name.trim()) add("carrier.name", "Ingresa la razón social del transportista.");
    if (form.carrier.mtcRegistrationNumber.trim() && !/^[A-Za-z0-9-]{1,20}$/.test(form.carrier.mtcRegistrationNumber.trim()))
      add("carrier.mtcRegistrationNumber", "El registro MTC tiene hasta 20 letras o números.");
  } else {
    if (!PLATE.test(compactCode(form.vehicle.plate))) add("vehicle.plate", "La placa tiene de 6 a 8 letras o números, sin guion (por ejemplo, ABC123).");
    if (form.driver.documentType === "6") add("drivers.0.identityDocumentNumber", "El conductor se identifica con DNI, carné de extranjería o pasaporte, no con RUC.");
    else {
      const problem = documentProblem(form.driver.documentType, form.driver.documentNumber, "del conductor");
      if (problem) add("drivers.0.identityDocumentNumber", problem);
    }
    if (!form.driver.firstName.trim()) add("drivers.0.firstName", "Ingresa los nombres del conductor.");
    if (!form.driver.familyName.trim()) add("drivers.0.familyName", "Ingresa los apellidos del conductor.");
    if (!LICENSE.test(compactCode(form.driver.licenseNumber))) add("drivers.0.licenseNumber", "La licencia de conducir tiene 9 o 10 letras o números (por ejemplo, Q12345678).");
  }

  return problems;
}

/** Cuerpo del POST /despatch-advices (asume un formulario sin problemas). */
export function greFormToRequest(form: GreFormState): IssueDespatchAdviceRequest {
  const isTransfer = form.transferReason === GRE_REASON.TRANSFER;
  const place = (value: GrePlace) => ({
    ubigeo: value.ubigeo,
    address: value.address.trim(),
    ...(value.establishmentCode.trim() ? { establishmentCode: value.establishmentCode.trim() } : {}),
  });
  const relatedNumber = form.relatedDocument?.number.trim().toUpperCase() ?? "";

  return {
    sunatProfileId: form.sunatProfileId,
    externalReference: form.externalReference.trim() || null,
    transferReason: form.transferReason,
    transportMode: form.transportMode,
    transferStartDate: form.transferStartDate,
    grossWeightKg: Number(form.grossWeightKg.replace(",", ".")),
    packageCount: Number(form.packageCount),
    ...(form.note.trim() ? { note: form.note.trim() } : {}),
    // Con 04 el destinatario es el propio emisor: lo completa ms-sunat.
    ...(isTransfer
      ? {}
      : {
          recipient: {
            identityDocumentType: form.recipient.documentType,
            identityDocumentNumber: form.recipient.documentNumber.trim(),
            name: form.recipient.name.trim(),
          },
        }),
    origin: place(form.origin),
    destination: place(form.destination),
    ...(form.transportMode === GRE_MODE.PUBLIC
      ? {
          carrier: {
            ruc: form.carrier.ruc.trim(),
            name: form.carrier.name.trim(),
            ...(form.carrier.mtcRegistrationNumber.trim() ? { mtcRegistrationNumber: form.carrier.mtcRegistrationNumber.trim() } : {}),
          },
        }
      : {
          vehicle: { plate: compactCode(form.vehicle.plate) },
          drivers: [
            {
              identityDocumentType: form.driver.documentType,
              identityDocumentNumber: form.driver.documentNumber.trim(),
              firstName: form.driver.firstName.trim(),
              familyName: form.driver.familyName.trim(),
              licenseNumber: compactCode(form.driver.licenseNumber),
            },
          ],
        }),
    ...(form.relatedDocument && relatedNumber ? { relatedDocuments: [{ documentType: form.relatedDocument.documentType, number: relatedNumber }] } : {}),
    items: form.items.map((item) => ({ description: item.description.trim(), quantity: item.quantity, unitCode: "NIU" as const, ...(item.code ? { code: item.code.slice(0, 30) } : {}) })),
  };
}

/* ---------------------------------------------------------------------------
   Errores del backend → español
--------------------------------------------------------------------------- */

const FIELD_LABEL: Record<string, string> = {
  sunatProfileId: "RUC emisor",
  transferStartDate: "Fecha de inicio del traslado",
  grossWeightKg: "Peso bruto",
  packageCount: "Bultos",
  note: "Nota",
  recipient: "Destinatario",
  "recipient.identityDocumentNumber": "Documento del destinatario",
  "recipient.name": "Nombre del destinatario",
  origin: "Punto de partida",
  "origin.ubigeo": "Ubigeo de partida",
  "origin.address": "Dirección de partida",
  "origin.establishmentCode": "Código de establecimiento de partida",
  destination: "Punto de llegada",
  "destination.ubigeo": "Ubigeo de llegada",
  "destination.address": "Dirección de llegada",
  "destination.establishmentCode": "Código de establecimiento de llegada",
  carrier: "Transportista",
  "carrier.ruc": "RUC del transportista",
  "carrier.name": "Razón social del transportista",
  "carrier.mtcRegistrationNumber": "Registro MTC",
  vehicle: "Vehículo",
  "vehicle.plate": "Placa",
  drivers: "Conductor",
  items: "Productos",
};

export function greFieldLabel(path: string): string {
  if (FIELD_LABEL[path]) return FIELD_LABEL[path];
  const item = /^items\.(\d+)(?:\.(\w+))?$/.exec(path);
  if (item) return `Ítem ${Number(item[1]) + 1}`;
  const driver = /^drivers\.\d+\.(\w+)$/.exec(path);
  if (driver) {
    const field: Record<string, string> = {
      identityDocumentNumber: "Documento del conductor",
      identityDocumentType: "Documento del conductor",
      licenseNumber: "Licencia del conductor",
      firstName: "Nombres del conductor",
      familyName: "Apellidos del conductor",
    };
    return field[driver[1]] ?? "Conductor";
  }
  if (path.startsWith("relatedDocuments")) return "Comprobante relacionado";
  return path;
}

interface ApiErrorShape {
  response?: { status?: number; data?: { code?: string; message?: unknown; errors?: Array<{ path?: unknown[] }> } };
  code?: string;
}

/** Status HTTP de un error de axios (o `undefined`). */
export function greErrorStatus(error: unknown): number | undefined {
  return (error as ApiErrorShape | null)?.response?.status;
}

function uniqueLabels(paths: string[]): string {
  return [...new Set(paths.map(greFieldLabel))].join(", ");
}

/** Mensaje en español para un error de ms-sunat al emitir, reenviar o guardar credenciales. */
export function greErrorMessage(error: unknown, fallback = "No se pudo completar la acción. Inténtalo de nuevo."): string {
  const shape = (error ?? {}) as ApiErrorShape;
  const status = shape.response?.status;
  const data = shape.response?.data;
  const code = data?.code;

  if (!shape.response) return "No hubo respuesta del servidor de facturación. Revisa tu conexión e inténtalo de nuevo.";

  switch (code) {
    case "GRE_NO_HABILITADA":
      return GRE_NOT_ENABLED_NOTICE;
    case "GRE_CREDENTIALS_NOT_CONFIGURED":
      return "Faltan credenciales GRE (client_id y client_secret de SOL). Cárgalas en Facturación › Certificado Digital.";
    case "GRE_CREDENTIALS_NOT_FOUND":
      return "Este RUC todavía no tiene credenciales GRE.";
    case "GRE_SEQUENCE_CANNOT_MOVE_BACK":
      return "Ese número ya se usó en la serie: el próximo número no puede ser menor que el actual.";
    case "SUNAT_PROFILE_NOT_FOUND":
    case "SUNAT_DEFAULT_PROFILE_NOT_FOUND":
      return "No se encontró el RUC emisor. Revisa tus certificados en Facturación › Certificado Digital.";
    case "SUNAT_PROFILE_INACTIVE":
      return "El RUC elegido está inactivo y no puede emitir.";
    case "DESPATCH_ADVICE_CERTIFICATE_UNUSABLE":
      return "El certificado digital de este RUC no puede firmar la guía (¿venció?). Reemplázalo en Certificado Digital.";
    case "DESPATCH_ADVICE_NOT_SENDABLE":
      return "La guía ya no está pendiente (o se está enviando ahora): actualiza la lista.";
    case "DESPATCH_ADVICE_NOT_FOUND":
      return "No se encontró la guía.";
    case "DESPATCH_ADVICE_FILE_NOT_FOUND":
      return "Ese archivo todavía no está disponible para esta guía.";
    case "DESPATCH_ADVICE_RULE_VIOLATION": {
      const message = typeof data?.message === "string" ? data.message : "";
      const paths = message
        .replace(/^[^:]*:\s*/, "")
        .split(";")
        .map((part) => part.split(":")[0]?.trim())
        .filter((path): path is string => Boolean(path));
      return paths.length ? `SUNAT no aceptaría la guía. Revisa: ${uniqueLabels(paths)}.` : "SUNAT no aceptaría la guía con estos datos.";
    }
    default:
      break;
  }

  if (status === 400 && Array.isArray(data?.errors) && data.errors.length) {
    const paths = data.errors.map((issue) => (Array.isArray(issue.path) ? issue.path.join(".") : "")).filter(Boolean);
    if (paths.length) return `Revisa estos datos: ${uniqueLabels(paths)}.`;
  }
  if (status === 401 || status === 403) return "Tu sesión no tiene permiso para esta acción. Vuelve a iniciar sesión.";
  if (status !== undefined && status >= 500) return "El servicio de facturación tuvo un error. Inténtalo de nuevo en unos minutos.";
  return fallback;
}

/* ---------------------------------------------------------------------------
   Habilitación (H12-D6: la emisión real se habilita con la empresa piloto)
--------------------------------------------------------------------------- */

export interface GreSettingsLike {
  sunatConnection: "NOT_CONFIGURED" | "SUNAT_PRODUCTION" | "OTHER";
  enabledForCompany: boolean;
  autoEnableByCredentials?: boolean;
  profiles: Array<{ sunatProfileId: string; configured: boolean; isActive: boolean }>;
}

/**
 * La empresa no puede emitir solo porque está fuera de la lista de
 * habilitadas (modo solo lista). Con la habilitación automática, no estar
 * habilitada significa que faltan credenciales GRE.
 */
export function greBlockedByList(settings: GreSettingsLike): boolean {
  return !settings.enabledForCompany && settings.autoEnableByCredentials !== true;
}

export const GRE_PILOT_NOTICE = "La emisión real de guías de remisión se habilita con la empresa piloto.";

/** Texto del 403 GRE_NO_HABILITADA de ms-sunat (modo solo lista y la empresa no está en ella). */
export const GRE_NOT_ENABLED_NOTICE = "La guía de remisión electrónica todavía no está habilitada para tu empresa.";

/**
 * Por qué no se puede emitir ahora (o `null`). Sin conexión configurada,
 * ms-sunat numeraría y firmaría la guía sin mandarla: se consumiría un número
 * real de la serie para una guía que no sirve, así que no se ofrece.
 */
export function greEmissionBlockReason(settings: GreSettingsLike | null | undefined): string | null {
  if (!settings) return "Cargando la configuración de guías de remisión…";
  if (settings.sunatConnection === "NOT_CONFIGURED")
    return `Powip todavía no envía guías de remisión a SUNAT. ${GRE_PILOT_NOTICE}`;
  if (greBlockedByList(settings)) return GRE_NOT_ENABLED_NOTICE;
  if (!settings.enabledForCompany || !settings.profiles.some((profile) => profile.isActive && profile.configured))
    return "Primero carga las credenciales GRE (client_id y client_secret de SOL) de tu RUC en Facturación › Certificado Digital.";
  return null;
}

/** Texto del último error de envío (viene en inglés del backend). */
export function greLastErrorText(lastError: string | null | undefined): string | null {
  const value = text(lastError);
  if (!value) return null;
  if (/is not configured/i.test(value)) return "La conexión con SUNAT no está configurada (modo de pruebas): la guía no salió de Powip.";
  if (/credential|unauthori[sz]ed|invalid_client|401/i.test(value)) return "SUNAT no aceptó las credenciales GRE de este RUC: revisa el client_id, el client_secret y el usuario SOL.";
  if (/timed? ?out|ECONN|network|ENOTFOUND|EAI_AGAIN|5\d\d/i.test(value)) return "SUNAT no respondió. La guía conserva su número: reenvíala en unos minutos.";
  return `No se pudo enviar a SUNAT (detalle técnico: ${value}).`;
}
