export interface ConversationMutations {
  sendReply?: (input: { conversationId: string; text: string; version: number }) => Promise<void>;
  sendTemplate?: (input: {
    conversationId: string;
    templateId: string;
    version: number;
  }) => Promise<void>;
  addNote?: (input: { conversationId: string; text: string }) => Promise<void>;
  reassign?: (input: {
    conversationId: string;
    assigneeId: string;
    version: number;
  }) => Promise<void>;
  retry?: (input: { conversationId: string; messageId: string }) => Promise<void>;
  markAttended?: (input: { conversationId: string; version: number }) => Promise<void>;
  optOut?: (input: {
    conversationId: string;
    phone: string;
    storeId: string;
    reason: string | null;
  }) => Promise<void>;
}

export const CONVERSATION_PENDING_REASON =
  "Pendiente de integración: el servicio de conversaciones de POWIP todavía no está disponible. No se envió ni se guardó nada.";

export type ActionStatus =
  | { kind: "idle" }
  | { kind: "pending" }
  | { kind: "error"; message: string };

export const IDLE: ActionStatus = { kind: "idle" };

export function toActionError(error: unknown, fallback: string): ActionStatus {
  return {
    kind: "error",
    message: error instanceof Error && error.message ? error.message : fallback,
  };
}
