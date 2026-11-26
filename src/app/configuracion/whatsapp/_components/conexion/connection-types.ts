import type { WhatsAppConnectionType } from "@/features/whatsapp/enums/whatsapp.enums";
import type { WhatsAppTestRun } from "@/features/whatsapp/models/connection.model";
import type { ContingencyValues } from "@/features/whatsapp/schemas/connection.schema";

export interface ConnectionMutations {
  changeType?: (input: {
    accountId: string;
    connectionType: WhatsAppConnectionType;
  }) => Promise<void>;
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
    input: { storeId: string; mode: "api" | "coex" } & NumberRoleChoice,
  ) => Promise<void>;
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
  return error instanceof Error && error.message ? error.message : fallback;
}
