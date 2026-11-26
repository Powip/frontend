import type { WhatsAppTestRun } from "@/features/whatsapp/models/connection.model";
import type { ContingencyValues } from "@/features/whatsapp/schemas/connection.schema";

export interface ConnectionMutations {
  refresh?: (accountId: string) => Promise<void>;
  disconnect?: (accountId: string) => Promise<void>;
  sendTest?: (input: {
    accountId: string;
    phone: string;
    templateId: string;
  }) => Promise<WhatsAppTestRun>;
  /** C-07 · GET /wa/messages/:id: estado actualizado de la prueba (enviado → entregado → leído). */
  refreshTest?: (messageId: string) => Promise<WhatsAppTestRun>;
  startSignup?: (
    input: {
      storeId: string;
      mode: "api" | "coex";
      /** Número que la persona dice que conecta (opcional): Powip no adivina cuál es. */
      expectedPhoneNumber?: string;
      /** Reconexión: el número conserva su vendedora y su marca de principal. */
      keepRole?: boolean;
    } & NumberRoleChoice,
  ) => Promise<void>;
  /**
   * Segundo paso de «Conectar con Facebook» sin abrir Meta otra vez: el número elegido de la
   * lista, o el mismo número tras confirmar un aviso. El token queda en el servidor.
   */
  selectSignupPhone?: (
    input: {
      storeId: string;
      selectionId: string;
      phoneNumberId?: string;
      confirmReassign?: boolean;
      keepRole?: boolean;
    } & NumberRoleChoice,
  ) => Promise<void>;
  /** Pasa un número conectado a «Solo app» (Powip olvida la llave de Meta). */
  switchToApp?: (accountId: string) => Promise<void>;
  /** Alta manual: suma un número a la tienda con los datos de WhatsApp Manager. */
  connectManual?: (
    input: {
      storeId: string;
      wabaId: string;
      phoneNumberId: string;
      accessToken: string;
      /** Opcional: Powip lee el número de Meta; el escrito solo se compara con ese. */
      businessPhoneNumber?: string;
    } & NumberRoleChoice,
  ) => Promise<void>;
  /** «Solo app»: guarda el número que vive solo en el celular. No consulta a Meta. */
  connectAppOnly?: (input: {
    storeId: string;
    phoneNumber: string;
    role: "store" | "seller";
    seller: { id: string; name: string } | null;
    confirmReassign?: boolean;
  }) => Promise<void>;
  assignNumber?: (input: {
    accountId: string;
    userId: string | null;
    userName: string | null;
  }) => Promise<void>;
  setPrimary?: (accountId: string) => Promise<void>;
  /** Coexistencia: trae contactos e historial del celular. */
  syncAppData?: (accountId: string) => Promise<void>;
  saveContingency?: (values: ContingencyValues) => Promise<void>;
  markAssistedOpened?: (itemId: string) => Promise<void>;
  markAssistedSent?: (itemId: string) => Promise<void>;
  discardAssisted?: (input: { itemId: string; reason: string }) => Promise<void>;
}

/**
 * Tipo del número al darlo de alta:
 * - company: número principal de la empresa (lo usan las tiendas sin número propio);
 * - store: número principal de la tienda (envía sus avisos automáticos);
 * - seller: número de una vendedora (sus chats le llegan a ella).
 */
export type NumberRole = "company" | "store" | "seller";

export interface NumberRoleChoice {
  role?: NumberRole;
  seller?: { id: string; name: string } | null;
  /** La persona aceptó que un número sin coexistencia deja la app del celular. */
  confirmNoCoexistence?: boolean;
  /** La persona vio que el número escrito no es el de Meta y aceptó guardar el de Meta. */
  confirmPhoneFromMeta?: boolean;
}

/** Código del backend cuando el número escrito no es el que Meta tiene para ese Phone number ID. */
export const PHONE_MISMATCH_CODE = "WHATSAPP.PHONE_NUMBER_MISMATCH";

/** Los dos números (solo dígitos) cuando el escrito no coincide con el de Meta. */
export interface PhoneMismatch {
  typed: string;
  meta: string;
}

/** Devuelve ambos números si el backend avisó que el número escrito no es el de Meta. */
export function phoneMismatch(error: unknown): PhoneMismatch | null {
  const data = (
    error as {
      response?: {
        data?: {
          code?: unknown;
          details?: { typedPhoneNumber?: unknown; metaPhoneNumber?: unknown };
        };
      };
    }
  )?.response?.data;
  if (data?.code !== PHONE_MISMATCH_CODE) return null;
  const typed = data.details?.typedPhoneNumber;
  const meta = data.details?.metaPhoneNumber;
  if (typeof typed !== "string" || typeof meta !== "string") return null;
  return { typed, meta };
}

/** Código del backend cuando el número no tiene coexistencia y falta la confirmación. */
export const COEXISTENCE_CONFIRMATION_CODE = "WHATSAPP.COEXISTENCE_CONFIRMATION_REQUIRED";

/** El número no tiene coexistencia: hay que preguntar antes de conectarlo. */
export class CoexistenceConfirmationRequired extends Error {
  constructor() {
    super("Este número no tiene coexistencia.");
    this.name = "CoexistenceConfirmationRequired";
  }
}

/** true si el error del backend pide confirmar el número sin coexistencia. */
export function needsCoexistenceConfirmation(error: unknown): boolean {
  if (error instanceof CoexistenceConfirmationRequired) return true;
  const data = (error as { response?: { data?: { code?: unknown } } })?.response?.data;
  return data?.code === COEXISTENCE_CONFIRMATION_CODE;
}

/** Un número que Meta compartió en «Conectar con Facebook». */
export interface SignupPhoneCandidate {
  phoneNumberId: string;
  displayPhoneNumber: string | null;
  verifiedName: string | null;
  wabaId: string;
  isOnBizApp: boolean | null;
}

export const PHONE_SELECTION_CODE = "WHATSAPP.PHONE_SELECTION_REQUIRED";
export const PHONE_REASSIGN_CODE = "WHATSAPP.PHONE_REASSIGN_CONFIRMATION_REQUIRED";

interface BackendErrorBody {
  code?: unknown;
  message?: unknown;
  details?: Record<string, unknown>;
}

function backendError(error: unknown): BackendErrorBody | undefined {
  return (error as { response?: { data?: BackendErrorBody } })?.response?.data;
}

/** Meta compartió varios números: la persona elige uno de la lista (número y nombre). */
export interface SignupPhoneChoice {
  selectionId: string;
  candidates: SignupPhoneCandidate[];
}

export function signupPhoneChoice(error: unknown): SignupPhoneChoice | null {
  const data = backendError(error);
  if (data?.code !== PHONE_SELECTION_CODE) return null;
  const selectionId = data.details?.selectionId;
  const candidates = data.details?.candidates;
  if (typeof selectionId !== "string" || !Array.isArray(candidates)) return null;
  return { selectionId, candidates: candidates as SignupPhoneCandidate[] };
}

/** El número ya está en otra tienda (o reemplaza al de la empresa): se pregunta antes. */
export interface SignupReassign {
  selectionId: string | null;
  reason: "other_store" | "replaces_company_default";
  displayPhoneNumber: string | null;
  replacedPhoneNumber: string | null;
}

export function signupReassign(error: unknown): SignupReassign | null {
  const data = backendError(error);
  if (data?.code !== PHONE_REASSIGN_CODE) return null;
  const d = data.details ?? {};
  return {
    selectionId: typeof d.selectionId === "string" ? d.selectionId : null,
    reason: d.reason === "replaces_company_default" ? "replaces_company_default" : "other_store",
    displayPhoneNumber: typeof d.displayPhoneNumber === "string" ? d.displayPhoneNumber : null,
    replacedPhoneNumber: typeof d.replacedPhoneNumber === "string" ? d.replacedPhoneNumber : null,
  };
}

/** Conexión con Facebook pendiente que guarda el servidor (para confirmar sin abrir Meta). */
export function signupSelectionId(error: unknown): string | null {
  const id = backendError(error)?.details?.selectionId;
  return typeof id === "string" ? id : null;
}

/** «+51 987 000 111» o el número en dígitos con +. */
export function formatSignupPhone(phone: string | null | undefined): string {
  if (!phone) return "Número sin nombre";
  return phone.trim().startsWith("+") ? phone.trim() : `+${phone.replace(/\D/g, "")}`;
}

export const CONNECTION_PENDING_REASON =
  "Pendiente de integración: la conexión con Meta todavía no está disponible en POWIP. No se cambió ni se envió nada.";

export const SIGNUP_UNAVAILABLE_REASON =
  "Falta configurar la app de Meta (Tech Provider, config_id y dominio permitido) y el servicio de conexión de POWIP. No se abrió ninguna ventana de Meta.";

/** Motivo exacto cuando el servidor dice qué variables faltan (solo nombres, nunca valores). */
export function signupUnavailableReason(missing?: string[] | null): string {
  if (!missing?.length) return SIGNUP_UNAVAILABLE_REASON;
  return `Falta configurar en el servidor: ${missing.join(", ")}. No se abrió ninguna ventana de Meta.`;
}

export type ActionState =
  | { kind: "idle" }
  | { kind: "pending" }
  | { kind: "error"; message: string };

export function errorMessage(error: unknown, fallback: string): string {
  // El backend explica en español qué pasó (p. ej. qué números encontró en Meta).
  const message = backendError(error)?.message;
  if (typeof message === "string" && message) return message;
  return error instanceof Error && error.message ? error.message : fallback;
}
