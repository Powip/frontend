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
  startSignup?: (input: { storeId: string; mode: "api" | "coex" }) => Promise<void>;
  saveContingency?: (values: ContingencyValues) => Promise<void>;
  markAssistedOpened?: (itemId: string) => Promise<void>;
  markAssistedSent?: (itemId: string) => Promise<void>;
  discardAssisted?: (input: { itemId: string; reason: string }) => Promise<void>;
}

export const CONNECTION_PENDING_REASON =
  "Pendiente de integración: la conexión con Meta todavía no está disponible en POWIP. No se cambió ni se envió nada.";

export const SIGNUP_UNAVAILABLE_REASON =
  "Falta configurar la app de Meta (Tech Provider, config_id y dominio permitido) y el servicio de conexión de POWIP. No se abrió ninguna ventana de Meta.";

export type ActionState =
  | { kind: "idle" }
  | { kind: "pending" }
  | { kind: "error"; message: string };

export function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}
