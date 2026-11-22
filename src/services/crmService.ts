import axios from "axios";
import axiosAuth from "@/lib/axiosAuth";
import { API } from "@/lib/api";
import type {
  AssignedFilter,
  Audience,
  Board,
  Broadcast,
  BroadcastInput,
  FollowupRule,
  FollowupRuleInput,
  FollowupRun,
  FollowupStats,
  Template,
  Conversation,
  ConversationFollowup,
  CreateTaskInput,
  InboxSummary,
  SendTemplateInput,
  Pipeline,
  StageInput,
  Task,
  TaskListParams,
  UpdateStageInput,
  UpdateTaskInput,
  ConversationListParams,
  CreateChatQuoteInput,
  CrmMe,
  ConversationOrder,
  LinkOrderInput,
  ConversationQuote,
  LinkQuoteInput,
  ConversationListResponse,
  Message,
  MessagePage,
  PauProvider,
  PauProviderInput,
  PauProviderTest,
  PauProviderUpdate,
  PauSandboxResult,
  PauSandboxTurn,
  PauSettings,
  PauSettingsInput,
  PauUsage,
  UpdateConversationInput,
} from "@/types/crm";
import type { QuotationCatalogItem, QuotationInventory } from "@/types/quotations";

const BASE = `${API.crm}/crm`;
const conv = (id: string) => `${BASE}/conversations/${encodeURIComponent(id)}`;

export async function listConversations(
  params: ConversationListParams,
  signal?: AbortSignal,
): Promise<ConversationListResponse> {
  const query: Record<string, string | number> = {
    status: params.status,
    assigned: params.assigned,
    page: params.page ?? 1,
    limit: params.limit ?? 30,
  };
  if (params.search?.trim()) query.search = params.search.trim();
  if (params.channel) query.channel = params.channel;
  if (params.unanswered) query.unanswered = "true";
  if (params.overSla) query.overSla = "true";
  if (params.pauHelp) query.pauHelp = "true";
  if (params.thinking) query.thinking = "true";
  if (params.tag?.trim()) query.tag = params.tag.trim();
  if (params.storeId) query.storeId = params.storeId;
  return (
    await axiosAuth.get<ConversationListResponse>(`${BASE}/conversations`, {
      params: query,
      signal,
    })
  ).data;
}

export async function getConversation(id: string): Promise<Conversation> {
  return (await axiosAuth.get<Conversation>(conv(id))).data;
}

export async function listMessages(
  id: string,
  opts: { before?: string; limit?: number } = {},
): Promise<MessagePage> {
  return (
    await axiosAuth.get<MessagePage>(`${conv(id)}/messages`, {
      params: {
        limit: opts.limit ?? 50,
        ...(opts.before ? { before: opts.before } : {}),
      },
    })
  ).data;
}

export async function sendMessage(id: string, body: string): Promise<Message> {
  return (await axiosAuth.post<Message>(`${conv(id)}/messages`, { body })).data;
}

/** Nota interna: la ve solo el equipo, no se envía al cliente. Sirve con la ventana cerrada. */
export async function sendNote(id: string, body: string): Promise<Message> {
  return (await axiosAuth.post<Message>(`${conv(id)}/notes`, { body })).data;
}

/**
 * Plantilla de WhatsApp desde el chat (solo WhatsApp). 400 si el canal no es
 * WhatsApp o faltan variables; 502 si WhatsApp la rechaza.
 */
export async function sendConversationTemplate(
  id: string,
  input: SendTemplateInput,
): Promise<Message> {
  return (await axiosAuth.post<Message>(`${conv(id)}/template`, input)).data;
}

/** Conteos de los indicadores de la Bandeja. */
export async function getInboxSummary(storeId?: string): Promise<InboxSummary> {
  return (
    await axiosAuth.get<InboxSummary>(`${BASE}/inbox/summary`, {
      params: storeId ? { storeId } : undefined,
    })
  ).data;
}

/** Nivel del usuario en el CRM y tiendas activas de su empresa. */
export async function getCrmMe(): Promise<CrmMe> {
  return (await axiosAuth.get<CrmMe>(`${BASE}/me`)).data;
}

/** Almacenes de la tienda (el CRM consulta a Core). */
export async function getCrmSalesInventories(
  storeId: string,
  signal?: AbortSignal,
): Promise<QuotationInventory[]> {
  return (
    await axiosAuth.get<QuotationInventory[]>(`${BASE}/sales/inventories`, {
      params: { storeId },
      ...(signal ? { signal } : {}),
    })
  ).data;
}

/** Productos con precio y stock del almacén elegido. */
export async function getCrmSalesCatalog(
  params: { storeId: string; inventoryId?: string; search?: string; page?: number; limit?: number },
  signal?: AbortSignal,
): Promise<QuotationCatalogItem[]> {
  const query: Record<string, string | number> = { storeId: params.storeId };
  if (params.inventoryId) query.inventoryId = params.inventoryId;
  if (params.search?.trim()) query.search = params.search.trim();
  if (params.page) query.page = params.page;
  if (params.limit) query.limit = params.limit;
  return (
    await axiosAuth.get<QuotationCatalogItem[]>(`${BASE}/sales/catalog`, {
      params: query,
      ...(signal ? { signal } : {}),
    })
  ).data;
}

/**
 * Crea el POWIP Link en el servidor y lo vincula al chat. 502
 * `QUOTE_CREATED_NOT_LINKED` trae `quotationId`, `quotationNumber` y
 * `publicUrl`: se reintenta solo el vínculo con `linkConversationQuote`.
 */
export async function createChatQuote(
  id: string,
  input: CreateChatQuoteInput,
): Promise<ConversationQuote> {
  return (await axiosAuth.post<ConversationQuote>(`${conv(id)}/quotations`, input)).data;
}

/** Pide al servidor releer en Core las cotizaciones y pedidos del chat. */
export async function refreshConversationSales(id: string): Promise<void> {
  await axiosAuth.post(`${conv(id)}/sales/refresh`);
}

/** Etiquetas ya usadas por la empresa (para sugerir). */
export async function listTags(): Promise<string[]> {
  return (await axiosAuth.get<{ items: string[] }>(`${BASE}/tags`)).data.items;
}

/** Seguimientos automáticos que se dispararán si el cliente no responde. */
export async function listConversationFollowups(id: string): Promise<ConversationFollowup[]> {
  return (
    await axiosAuth.get<{ items: ConversationFollowup[] }>(`${conv(id)}/followups`)
  ).data.items;
}

export async function markConversationRead(id: string): Promise<Conversation> {
  return (await axiosAuth.post<Conversation>(`${conv(id)}/read`)).data;
}

export async function updateConversation(
  id: string,
  input: UpdateConversationInput,
): Promise<Conversation> {
  return (await axiosAuth.patch<Conversation>(conv(id), input)).data;
}

export async function listConversationOrders(
  id: string,
): Promise<ConversationOrder[]> {
  return (
    await axiosAuth.get<{ items: ConversationOrder[] }>(`${conv(id)}/orders`)
  ).data.items;
}

/** Idempotente: si el pedido ya estaba vinculado devuelve el existente. */
export async function linkConversationOrder(
  id: string,
  input: LinkOrderInput,
): Promise<ConversationOrder> {
  return (await axiosAuth.post<ConversationOrder>(`${conv(id)}/orders`, input))
    .data;
}

export async function listConversationQuotes(
  id: string,
): Promise<ConversationQuote[]> {
  return (
    await axiosAuth.get<{ items: ConversationQuote[] }>(`${conv(id)}/quotes`)
  ).data.items;
}

/** Idempotente: deja una nota «POWIP Link … creado» en el chat; no envía nada al cliente. */
export async function linkConversationQuote(
  id: string,
  input: LinkQuoteInput,
): Promise<ConversationQuote> {
  return (await axiosAuth.post<ConversationQuote>(`${conv(id)}/quotes`, input))
    .data;
}

const pipe = (id: string) => `${BASE}/pipelines/${encodeURIComponent(id)}`;
const stage = (id: string) => `${BASE}/stages/${encodeURIComponent(id)}`;
const taskUrl = (id: string) => `${BASE}/tasks/${encodeURIComponent(id)}`;

// --- Embudos ---

export async function listPipelines(): Promise<Pipeline[]> {
  return (await axiosAuth.get<{ items: Pipeline[] }>(`${BASE}/pipelines`)).data.items;
}

export async function createPipeline(name: string): Promise<Pipeline> {
  return (await axiosAuth.post<Pipeline>(`${BASE}/pipelines`, { name })).data;
}

export async function renamePipeline(id: string, name: string): Promise<Pipeline> {
  return (await axiosAuth.patch<Pipeline>(pipe(id), { name })).data;
}

/** 409 `PIPELINE_DEFAULT` / `PIPELINE_NOT_EMPTY` si no se puede eliminar. */
export async function deletePipeline(id: string): Promise<void> {
  await axiosAuth.delete(pipe(id));
}

export async function createStage(
  pipelineId: string,
  input: StageInput,
): Promise<Pipeline> {
  return (await axiosAuth.post<Pipeline>(`${pipe(pipelineId)}/stages`, input)).data;
}

/** Devuelve el embudo ya reordenado. */
export async function updateStage(
  id: string,
  input: UpdateStageInput,
): Promise<Pipeline> {
  return (await axiosAuth.patch<Pipeline>(stage(id), input)).data;
}

/** 409 `STAGE_NOT_EMPTY` / `STAGE_LAST_OPEN` si no se puede eliminar. */
export async function deleteStage(id: string): Promise<Pipeline> {
  return (await axiosAuth.delete<Pipeline>(stage(id))).data;
}

export async function getBoard(
  pipelineId: string,
  assigned: AssignedFilter = "all",
  storeId?: string,
): Promise<Board> {
  return (
    await axiosAuth.get<Board>(`${pipe(pipelineId)}/board`, {
      params: storeId ? { assigned, storeId } : { assigned },
    })
  ).data;
}

// --- Agenda ---

export async function listTasks(params: TaskListParams): Promise<Task[]> {
  const query: Record<string, string> = {
    assigned: params.assigned,
    status: params.status,
  };
  if (params.conversationId) query.conversationId = params.conversationId;
  return (await axiosAuth.get<{ items: Task[] }>(`${BASE}/tasks`, { params: query }))
    .data.items;
}

export async function createTask(input: CreateTaskInput): Promise<Task> {
  return (await axiosAuth.post<Task>(`${BASE}/tasks`, input)).data;
}

export async function updateTask(id: string, input: UpdateTaskInput): Promise<Task> {
  return (await axiosAuth.patch<Task>(taskUrl(id), input)).data;
}

export async function deleteTask(id: string): Promise<void> {
  await axiosAuth.delete(taskUrl(id));
}

// --- Plantillas de WhatsApp ---

/** Puede responder 502 `TEMPLATES_UNAVAILABLE` si el servicio de WhatsApp no responde. */
export async function listTemplates(): Promise<Template[]> {
  return (await axiosAuth.get<{ items: Template[] }>(`${BASE}/templates`)).data.items;
}

// --- Seguimientos ---

const ruleUrl = (id: string) => `${BASE}/followup-rules/${encodeURIComponent(id)}`;

export async function listFollowupRules(): Promise<FollowupRule[]> {
  return (await axiosAuth.get<{ items: FollowupRule[] }>(`${BASE}/followup-rules`)).data
    .items;
}

export async function createFollowupRule(input: FollowupRuleInput): Promise<FollowupRule> {
  return (await axiosAuth.post<FollowupRule>(`${BASE}/followup-rules`, input)).data;
}

export async function updateFollowupRule(
  id: string,
  input: Partial<FollowupRuleInput>,
): Promise<FollowupRule> {
  return (await axiosAuth.patch<FollowupRule>(ruleUrl(id), input)).data;
}

export async function deleteFollowupRule(id: string): Promise<void> {
  await axiosAuth.delete(ruleUrl(id));
}

/** Últimas 50 ejecuciones. */
export async function listFollowupRuns(): Promise<FollowupRun[]> {
  return (await axiosAuth.get<{ items: FollowupRun[] }>(`${BASE}/followup-rules/runs`))
    .data.items;
}

export async function getFollowupStats(): Promise<FollowupStats> {
  return (await axiosAuth.get<FollowupStats>(`${BASE}/followup-rules/stats`)).data;
}

// --- Difusiones ---

const bcUrl = (id: string) => `${BASE}/broadcasts/${encodeURIComponent(id)}`;

export async function listBroadcasts(): Promise<Broadcast[]> {
  return (await axiosAuth.get<{ items: Broadcast[] }>(`${BASE}/broadcasts`)).data.items;
}

/** Crea un borrador. */
export async function createBroadcast(input: BroadcastInput): Promise<Broadcast> {
  return (await axiosAuth.post<Broadcast>(`${BASE}/broadcasts`, input)).data;
}

/** Solo borradores (409 `BROADCAST_STATUS` si ya salió). */
export async function updateBroadcast(
  id: string,
  input: Partial<BroadcastInput>,
): Promise<Broadcast> {
  return (await axiosAuth.patch<Broadcast>(bcUrl(id), input)).data;
}

/** Solo borrador o cancelada (409 `BROADCAST_STATUS`). */
export async function deleteBroadcast(id: string): Promise<void> {
  await axiosAuth.delete(bcUrl(id));
}

export async function countAudience(audience: Audience): Promise<number> {
  return (
    await axiosAuth.post<{ count: number }>(`${BASE}/broadcasts/audience/count`, {
      audience,
    })
  ).data.count;
}

/** Sin `scheduledAt` se envía ahora. 400 si el público está vacío o la fecha ya pasó. */
export async function sendBroadcast(id: string, scheduledAt?: string): Promise<Broadcast> {
  return (
    await axiosAuth.post<Broadcast>(
      `${bcUrl(id)}/send`,
      scheduledAt ? { scheduledAt } : {},
    )
  ).data;
}

export async function pauseBroadcast(id: string): Promise<Broadcast> {
  return (await axiosAuth.post<Broadcast>(`${bcUrl(id)}/pause`)).data;
}

export async function resumeBroadcast(id: string): Promise<Broadcast> {
  return (await axiosAuth.post<Broadcast>(`${bcUrl(id)}/resume`)).data;
}

export async function cancelBroadcast(id: string): Promise<Broadcast> {
  return (await axiosAuth.post<Broadcast>(`${bcUrl(id)}/cancel`)).data;
}

// --- Pau ---

const PAU = `${BASE}/pau`;
/** El modelo puede tardar hasta ~60 s. */
export const PAU_TIMEOUT_MS = 90_000;

/** Lectura abierta a cualquier usuario; cambiar es solo de administrador (403). */
export async function getPauSettings(): Promise<PauSettings> {
  return (await axiosAuth.get<PauSettings>(`${PAU}/settings`)).data;
}

/** 409 `PAU_NO_PROVIDER` si se enciende sin proveedor. */
export async function updatePauSettings(input: PauSettingsInput): Promise<PauSettings> {
  return (await axiosAuth.patch<PauSettings>(`${PAU}/settings`, input)).data;
}

export async function listPauProviders(): Promise<PauProvider[]> {
  return (await axiosAuth.get<{ items: PauProvider[] }>(`${PAU}/providers`)).data.items;
}

/** 503 `ENCRYPTION_NOT_CONFIGURED` si el servidor no puede cifrar la llave. */
export async function createPauProvider(input: PauProviderInput): Promise<PauProvider> {
  return (await axiosAuth.post<PauProvider>(`${PAU}/providers`, input)).data;
}

export async function updatePauProvider(
  id: string,
  input: PauProviderUpdate,
): Promise<PauProvider> {
  return (
    await axiosAuth.patch<PauProvider>(`${PAU}/providers/${encodeURIComponent(id)}`, input)
  ).data;
}

/** Si era el último proveedor, Pau se apaga. */
export async function deletePauProvider(id: string): Promise<void> {
  await axiosAuth.delete(`${PAU}/providers/${encodeURIComponent(id)}`);
}

/** Prueba la llave y lista los modelos disponibles en esa cuenta. */
export async function testPauProvider(id: string): Promise<PauProviderTest> {
  return (
    await axiosAuth.post<PauProviderTest>(`${PAU}/providers/${encodeURIComponent(id)}/test`)
  ).data;
}

export async function getPauUsage(): Promise<PauUsage> {
  return (await axiosAuth.get<PauUsage>(`${PAU}/usage`)).data;
}

/** Ensayo: no envía nada ni cambia datos. El último turno debe ser del cliente. */
export async function pauSandbox(turns: PauSandboxTurn[]): Promise<PauSandboxResult> {
  return (
    await axiosAuth.post<PauSandboxResult>(`${PAU}/sandbox`, { turns }, { timeout: PAU_TIMEOUT_MS })
  ).data;
}

/** Pau redacta una respuesta para la vendedora; no la envía. */
export async function suggestPauReply(conversationId: string): Promise<{ text: string }> {
  return (
    await axiosAuth.post<{ text: string }>(`${conv(conversationId)}/pau/suggest`, undefined, {
      timeout: PAU_TIMEOUT_MS,
    })
  ).data;
}

export interface CrmError {
  status: number | null;
  code: string | null;
  message: string;
  /** true si no hubo respuesta del servicio (caído o sin red). */
  unreachable: boolean;
}

export function crmError(err: unknown): CrmError {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as
      | { code?: string; message?: string | string[] }
      | undefined;
    const msg = Array.isArray(data?.message)
      ? data?.message.join(", ")
      : data?.message;
    return {
      status: err.response?.status ?? null,
      code: data?.code ?? null,
      message: msg || err.message || "Error desconocido",
      unreachable: !err.response,
    };
  }
  return {
    status: null,
    code: null,
    message: err instanceof Error ? err.message : "Error desconocido",
    unreachable: false,
  };
}
