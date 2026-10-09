export interface WhatsAppListFilters {
  storeId?: string | null;
  search?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}

export const whatsappKeys = {
  all: ["whatsapp"] as const,

  company: (companyId: string) => [...whatsappKeys.all, "company", companyId] as const,

  store: (companyId: string, storeId: string) =>
    [...whatsappKeys.company(companyId), "store", storeId] as const,

  connectionStatus: (companyId: string, storeId: string) =>
    [...whatsappKeys.store(companyId, storeId), "connection-status"] as const,

  accounts: (companyId: string) => [...whatsappKeys.company(companyId), "accounts"] as const,

  templates: (companyId: string, filters: WhatsAppListFilters = {}) =>
    [...whatsappKeys.company(companyId), "templates", filters] as const,

  template: (companyId: string, templateId: string) =>
    [...whatsappKeys.company(companyId), "template", templateId] as const,

  rules: (companyId: string, storeId: string) =>
    [...whatsappKeys.store(companyId, storeId), "rules"] as const,

  settings: (companyId: string, storeId: string) =>
    [...whatsappKeys.store(companyId, storeId), "settings"] as const,

  campaigns: (companyId: string, filters: WhatsAppListFilters = {}) =>
    [...whatsappKeys.company(companyId), "campaigns", filters] as const,

  threads: (companyId: string, filters: WhatsAppListFilters = {}) =>
    [...whatsappKeys.company(companyId), "threads", filters] as const,

  thread: (companyId: string, threadId: string) =>
    [...whatsappKeys.company(companyId), "thread", threadId] as const,

  threadsByOrder: (companyId: string, orderId: string) =>
    [...whatsappKeys.company(companyId), "threads-by-order", orderId] as const,

  messages: (companyId: string, filters: WhatsAppListFilters = {}) =>
    [...whatsappKeys.company(companyId), "messages", filters] as const,

  optOuts: (companyId: string, filters: WhatsAppListFilters = {}) =>
    [...whatsappKeys.company(companyId), "opt-outs", filters] as const,

  courierCatalog: (companyId: string) =>
    [...whatsappKeys.company(companyId), "courier-catalog"] as const,

  rulePreview: (companyId: string, ruleId: string, scopeHash: string) =>
    [...whatsappKeys.company(companyId), "rule-preview", ruleId, scopeHash] as const,

  upcomingQueue: (companyId: string, storeId: string) =>
    [...whatsappKeys.store(companyId, storeId), "upcoming-queue"] as const,

  segmentCount: (companyId: string, segmentHash: string) =>
    [...whatsappKeys.company(companyId), "segment-count", segmentHash] as const,

  conversations: (companyId: string, view: string, query: Record<string, unknown>) =>
    [...whatsappKeys.company(companyId), "conversations", view, query] as const,

  storeAgents: (companyId: string, storeId: string) =>
    [...whatsappKeys.store(companyId, storeId), "agents"] as const,

  auditLog: (companyId: string, filters: WhatsAppListFilters = {}) =>
    [...whatsappKeys.company(companyId), "audit-log", filters] as const,
};
