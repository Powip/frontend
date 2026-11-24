export type ConversationStatus = "open" | "closed";
export type MessageDirection = "in" | "out";
export type MessageStatus =
  | "received"
  | "sending"
  | "sent"
  | "delivered"
  | "read"
  | "failed";
export type MessageSenderKind = "customer" | "agent" | "pau" | "system";

export type ConversationChannel = "whatsapp" | "messenger" | "instagram" | "tiktok";

export interface Conversation {
  id: string;
  channel: ConversationChannel;
  /**
   * En WhatsApp es el teléfono del contacto. En Messenger e Instagram NO es un
   * teléfono: es el identificador del contacto en ese canal.
   */
  contactPhone: string;
  /** Teléfono real del cliente cuando el canal no lo da (null = aún no se conoce). */
  customerPhone: string | null;
  contactName: string | null;
  status: ConversationStatus;
  assignedUserId: string | null;
  assignedUserName: string | null;
  /** Cliente de Core vinculado (null = aún sin vincular). */
  clientId: string | null;
  unreadCount: number;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  lastMessageDirection: MessageDirection | null;
  lastInboundAt: string | null;
  /** Último mensaje con señal de compra (zona, talla o color). */
  hotAt?: string | null;
  windowExpiresAt: string | null;
  createdAt: string;
  /** Embudo y etapa actuales (null = aún sin etapa). */
  pipelineId: string | null;
  stageId: string | null;
  stageChangedAt: string | null;
  lostReason: string | null;
  /** Pidió no recibir promociones (difusiones ni seguimientos de venta/postventa). */
  marketingOptOut: boolean;
  /** Pau atiende este chat (solo cuenta si el modo de Pau es «auto»). */
  pauEnabled: boolean;
  /** Motivo con el que Pau pidió ayuda humana (null = no pidió). */
  pauHelpReason: string | null;
  /** Índice del paso del guion en que va el chat (null = ninguno). */
  scriptStep: number | null;
  /** «Lo está pensando»: cuándo retomar el chat (null = no está en pausa). */
  resumeAt: string | null;
  resumeNote: string | null;
  /** Etiquetas del chat (máx. 10, cada una ≤ 30 caracteres). */
  tags: string[];
  /** Tienda del canal por el que entró el chat (null = canal sin tienda). */
  storeId?: string | null;
}

/** Nivel del usuario en el CRM; lo decide el servidor (`GET /crm/me`). */
export type CrmLevel = "admin" | "supervisor" | "agent";

export interface CrmStore {
  id: string;
  name: string;
}

export interface CrmMe {
  userId: string;
  email: string | null;
  companyId: string;
  level: CrmLevel;
  stores: CrmStore[];
  /** `true` si este usuario ve el teléfono del cliente oculto («951 *** 245»). */
  phoneMasked?: boolean;
}

export interface Message {
  id: string;
  conversationId: string;
  direction: MessageDirection;
  type: string;
  body: string | null;
  status: MessageStatus;
  senderKind: MessageSenderKind;
  senderUserId: string | null;
  senderName: string | null;
  errorMessage: string | null;
  createdAt: string;
  /** Instagram/Messenger: id del mensaje en Meta, id del mensaje al que reacciona, adjunto y transcripción. */
  externalId?: string | null;
  contextExternalId?: string | null;
  mediaUrl?: string | null;
  mediaId?: string | null;
  /** WhatsApp: tipo y nombre del adjunto entrante; mediaUrl apunta al GET autenticado de ms-crm. */
  mediaMime?: string | null;
  mediaName?: string | null;
  transcript?: string | null;
  /** Comentario oculto al público (teléfono o insulto). No se borra. */
  hiddenAt?: string | null;
}

export type AssignedFilter = "all" | "me" | "unassigned";

export interface ConversationListParams {
  status: ConversationStatus;
  assigned: AssignedFilter;
  /** Sin valor = todos los canales. */
  channel?: ConversationChannel;
  search?: string;
  /** Indicadores de la Bandeja (solo se envían cuando valen true). */
  unanswered?: boolean;
  overSla?: boolean;
  pauHelp?: boolean;
  thinking?: boolean;
  /** Solo chats que nacieron de un comentario público. */
  comments?: boolean;
  tag?: string;
  /** Sin valor = todas las tiendas. */
  storeId?: string;
  page?: number;
  limit?: number;
}

/** Conteos de los indicadores de la Bandeja. */
export interface InboxSummary {
  slaMinutes: number;
  open: number;
  unanswered: number;
  overSla: number;
  mineUnanswered: number;
  unassigned: number;
  pauHelp: number;
  thinking: number;
  /** POWIP Links sin pagar y su monto. */
  pendingLinks?: number;
  pendingLinksAmount?: number;
  /** Cobrado hoy en pedidos nacidos del chat. */
  collectedToday?: number;
}

export interface SendTemplateInput {
  templateName: string;
  templateLanguage: string;
  variables?: string[];
}

export interface ConversationFollowup {
  ruleId: string;
  ruleName: string;
  objective: RuleObjective;
  target: RuleTarget;
  dueAt: string;
  /** Para esa hora la ventana de 24 h ya habrá cerrado: sale por plantilla. */
  viaTemplate: boolean;
}

export interface ConversationListResponse {
  items: Conversation[];
  total: number;
  page: number;
  limit: number;
}

export interface MessagePage {
  items: Message[];
  hasMore: boolean;
}

export interface UpdateConversationInput {
  assignedUserId?: string | null;
  /** Nombre visible de la persona asignada (al reasignar a otra persona). */
  assignedUserName?: string;
  status?: ConversationStatus;
  clientId?: string | null;
  stageId?: string;
  /** Solo al mover a una etapa de tipo «lost». */
  lostReason?: string;
  marketingOptOut?: boolean;
  /** Teléfono real del cliente (≤ 32 caracteres); null lo quita. */
  customerPhone?: string | null;
  /** Devolver el chat a Pau (true) o tomarlo una persona (false). */
  pauEnabled?: boolean;
  /** Paso del guion en que va el chat (null lo quita). */
  scriptStep?: number | null;
  /** «Lo está pensando»: fecha para retomar (ISO); null lo quita. */
  resumeAt?: string | null;
  /** Nota de «Lo está pensando» (≤ 200 caracteres). */
  resumeNote?: string;
  /** Etiquetas del chat (máx. 10, cada una ≤ 30 caracteres). */
  tags?: string[];
}

export interface ConversationOrder {
  id: string;
  conversationId: string;
  orderId: string;
  orderNumber: string | null;
  createdByUserId: string | null;
  createdByName: string | null;
  createdAt: string;
}

/** POWIP Link (cotización de Core) armado desde la conversación. */
export interface ConversationQuote {
  id: string;
  conversationId: string;
  quotationId: string;
  quotationNumber: string | null;
  publicUrl: string | null;
  createdByName: string | null;
  createdAt: string;
  /** Estado que el servidor mantiene con los eventos de Core. */
  storeId?: string | null;
  status?: string | null;
  total?: number | null;
  paidAmount?: number | null;
  orderId?: string | null;
  verifiedAt?: string | null;
}

export interface ChatQuoteLineInput {
  productVariantId?: string;
  sku?: string;
  name: string;
  variant?: string;
  quantity: number;
  unitPrice: number;
  isManual?: boolean;
  isPack?: boolean;
  isGift?: boolean;
  imageUrl?: string;
}

/** Pedido armado en el chat; el servidor del CRM crea la cotización en Core. */
export interface CreateChatQuoteInput {
  storeId: string;
  inventoryId?: string;
  customerName: string;
  customerPhone: string;
  address?: {
    address: string;
    district: string;
    department?: string;
    province?: string;
    reference?: string;
    documentNumber?: string;
  };
  paymentType?: "COMPLETO" | "ADELANTO";
  suggestedDeposit?: number;
  validityHours?: number;
  lines: ChatQuoteLineInput[];
}

export interface LinkQuoteInput {
  quotationId: string;
  quotationNumber?: string;
  publicUrl?: string;
}

export interface LinkOrderInput {
  orderId: string;
  orderNumber?: string;
}

export type StageKind = "open" | "won" | "lost";

export interface Stage {
  id: string;
  pipelineId: string;
  name: string;
  /** Color hexadecimal, p. ej. «#22c55e». */
  color: string;
  position: number;
  kind: StageKind;
}

export interface Pipeline {
  id: string;
  name: string;
  isDefault: boolean;
  /** Ordenadas por `position`. */
  stages: Stage[];
}

export interface BoardColumn {
  stage: Stage;
  /** Total real en la etapa (puede superar las 50 tarjetas devueltas). */
  total: number;
  conversations: Conversation[];
}

export interface Board {
  pipeline: Pipeline;
  columns: BoardColumn[];
}

export interface StageInput {
  name: string;
  color?: string;
  kind?: StageKind;
}

export interface UpdateStageInput {
  name?: string;
  color?: string;
  position?: number;
}

export type TaskType = "message" | "call" | "other";
export type TaskStatus = "pending" | "done";

export interface Task {
  id: string;
  conversationId: string | null;
  contactName: string | null;
  contactPhone: string | null;
  type: TaskType;
  title: string;
  note: string | null;
  dueAt: string;
  status: TaskStatus;
  doneAt: string | null;
  assignedUserId: string | null;
  assignedUserName: string | null;
  createdByUserId: string | null;
  createdAt: string;
}

export interface TaskListParams {
  assigned: "me" | "all";
  status: TaskStatus;
  conversationId?: string;
}

export interface CreateTaskInput {
  conversationId?: string;
  type: TaskType;
  title: string;
  note?: string;
  dueAt: string;
}

export interface UpdateTaskInput {
  title?: string;
  note?: string | null;
  dueAt?: string;
  type?: TaskType;
  status?: TaskStatus;
}

export type CrmEvent =
  | {
      type: "message.created";
      data: { conversation: Conversation; message: Message };
    }
  | {
      type: "message.status";
      data: {
        conversationId: string;
        messageId: string;
        status: MessageStatus;
        errorMessage: string | null;
        hiddenAt?: string | null;
      };
    }
  | { type: "conversation.updated"; data: { conversation: Conversation } }
  | { type: "conversation.removed"; data: { id: string } }
  | {
      type: "order.linked";
      data: { conversationId: string; order: ConversationOrder };
    }
  | { type: "sale.updated"; data: { conversationId: string } }
  | { type: "task.updated"; data: { task: Task } }
  | { type: "task.deleted"; data: { id: string } }
  | { type: "broadcast.updated"; data: { broadcast: Broadcast } }
  | { type: "call.permission"; data: { conversationId: string | null } }
  | { type: "call.updated"; data: unknown };

// --- Plantillas de WhatsApp ---

export type TemplateCategory = "MARKETING" | "UTILITY" | "AUTHENTICATION" | "SERVICE";
export type TemplateStatus = "APPROVED" | "PENDING" | "REJECTED" | "DISABLED" | "PAUSED";

export interface Template {
  name: string;
  language: string;
  category: TemplateCategory;
  status: TemplateStatus;
  bodyText: string | null;
  variableCount: number;
}

// --- Seguimientos ---

export type RuleObjective = "sale" | "collection" | "aftersale";
export type RuleTrigger = "customer_silent" | "agent_silent" | "stage_idle";
export type RuleTarget = "customer" | "agent";

export interface FollowupRule {
  id: string;
  name: string;
  objective: RuleObjective;
  trigger: RuleTrigger;
  stageId: string | null;
  /** 5 a 86400 minutos. */
  waitMinutes: number;
  target: RuleTarget;
  message: string;
  templateName: string | null;
  templateLanguage: string | null;
  templateVariables: string[];
  active: boolean;
  createdAt: string;
}

export type FollowupRuleInput = Omit<FollowupRule, "id" | "createdAt" | "active"> & {
  active?: boolean;
};

export type RunResult =
  | "pending"
  | "sent"
  | "sent_template"
  | "task"
  | "skipped_window"
  | "skipped_limit"
  | "skipped_opt_out"
  | "skipped_unassigned"
  | "failed";

export interface FollowupRun {
  id: string;
  ruleId: string;
  ruleName: string;
  conversationId: string;
  contactName: string | null;
  contactPhone: string;
  objective: RuleObjective;
  result: RunResult;
  detail: string | null;
  createdAt: string;
}

export interface FollowupStats {
  days: number;
  sentFree: number;
  sentTemplate: number;
  tasks: number;
  skipped: number;
  failed: number;
  limits: Record<RuleObjective, number>;
  /** Mes calendario en curso (hora de Lima). */
  month?: FollowupMonthStats;
}

export interface FollowupMonthStats {
  since: string;
  sent: number;
  sentFree: number;
  sentTemplate: number;
  /** Costo aproximado de las plantillas en soles; Meta lo cobra en la cuenta del negocio. */
  templateCost: number;
  recoveredSales: number;
  recoveredAmount: number;
}

// --- Difusiones ---

export type AudienceType = "all" | "stage" | "inactive";

export interface Audience {
  type: AudienceType;
  stageId?: string;
  inactiveDays?: number;
}

export type BroadcastStatus =
  | "draft"
  | "scheduled"
  | "sending"
  | "paused"
  | "sent"
  | "cancelled";

export interface Broadcast {
  id: string;
  name: string;
  templateName: string;
  templateLanguage: string;
  templateVariables: string[];
  audience: Audience;
  status: BroadcastStatus;
  scheduledAt: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  total: number;
  sentCount: number;
  failedCount: number;
  deliveredCount: number;
  readCount: number;
  createdByName: string | null;
  createdAt: string;
}

export interface BroadcastInput {
  name: string;
  templateName: string;
  templateLanguage: string;
  templateVariables?: string[];
  audience: Audience;
}

// --- Pau (agente de ventas con IA) ---

export type PauMode = "off" | "copilot" | "auto";

export interface PauSettings {
  mode: PauMode;
  instructions: string;
  knowledge: string;
  monthlyTokenCap: number | null;
  hasProvider: boolean;
}

export interface PauSettingsInput {
  mode?: PauMode;
  instructions?: string;
  knowledge?: string;
  /** null quita el tope. */
  monthlyTokenCap?: number | null;
}

export type PauProviderKind = "anthropic" | "openai" | "openai_compatible";

/** La llave nunca vuelve del servidor: solo `keyHint` (p. ej. «••••a1b2»). */
export interface PauProvider {
  id: string;
  provider: PauProviderKind;
  label: string;
  keyHint: string;
  model: string;
  /** Solo `openai_compatible`. */
  baseUrl: string | null;
  isDefault: boolean;
  lastTestOk: boolean | null;
  lastTestAt: string | null;
  lastTestError: string | null;
  createdAt: string;
}

export interface PauProviderInput {
  provider: PauProviderKind;
  label: string;
  apiKey: string;
  model?: string;
  baseUrl?: string;
}

export interface PauProviderUpdate {
  label?: string;
  apiKey?: string;
  model?: string;
  isDefault?: boolean;
}

export interface PauProviderTest {
  ok: boolean;
  error: string | null;
  models: string[];
  provider: PauProvider;
}

export type PauUsageKind = "suggest" | "auto" | "sandbox" | "test";

export interface PauUsage {
  since: string;
  calls: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  monthlyTokenCap: number | null;
  byKind: Array<{
    kind: PauUsageKind;
    calls: number;
    inputTokens: number;
    outputTokens: number;
  }>;
}

export interface PauSandboxTurn {
  role: "user" | "assistant";
  text: string;
}

export interface PauSandboxToolCall {
  name: string;
  input: Record<string, unknown>;
}

export interface PauSandboxResult {
  text: string;
  refused: boolean;
  model: string;
  toolCalls: PauSandboxToolCall[];
}
