import type { OrderHeader } from "@/interfaces/IOrder";

/** Commercial opportunities for stores; separate from Powip's Superadmin CRM. */
export type LeadStatus =
  | "NUEVO"
  | "CONTACTADO"
  | "SEGUIMIENTO"
  | "PERDIDO"
  | "CONVERTIDO";

export type LeadConfirmationBasis =
  | "SELLER"
  | "WEB_PREPAID"
  | "LEGACY_VERIFIED";
export type LeadFieldType = "text" | "number" | "boolean" | "date";

export interface LeadFieldDefinition {
  key: string;
  label: string;
  type: LeadFieldType;
  required?: boolean;
}

/** Codes are extensible per company; they are not restricted to the initial types. */
export interface LeadType {
  companyId: string;
  code: string;
  name: string;
  active: boolean;
  fields: LeadFieldDefinition[];
  schemaVersion: number;
}

export interface LeadActivity {
  id: string;
  companyId: string;
  leadId: string;
  actorId: string;
  kind: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface Lead {
  id: string;
  companyId: string;
  storeId: string | null;
  typeCode: string;
  type?: LeadType;
  status: LeadStatus;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  initialChannel: string | null;
  createdBy: string;
  assignedSellerId: string | null;
  receivedAt: string;
  sourceCreatedAt: string | null;
  /** PostgreSQL numeric is returned as a string; unknown amounts remain null. */
  estimatedAmount: string | null;
  currency: string | null;
  customFields: Record<string, unknown>;
  version: number;
  lostReason: string | null;
  nextActionAt: string | null;
  legacyOrderId: string | null;
  convertedOrderId: string | null;
  confirmedAt: string | null;
  confirmedBy: string | null;
  confirmationBasis: LeadConfirmationBasis | null;
  conversionCommandId: string | null;
  conversionSnapshot: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface LeadDetail extends Lead {
  activities: LeadActivity[];
}

export interface LeadSourceReference extends Required<LeadSourceInput> {
  id: string;
  createdAt: string;
}

/** Read-only canonical documents; changing contact or payments never recreates the order. */
export interface LeadCommercialContext {
  leadId: string;
  sources: LeadSourceReference[];
  order: OrderHeader | null;
  quotationId: string | null;
  liveCheckoutId: string | null;
}

export interface LeadCapabilities {
  enabled: boolean;
  phase: "foundation";
  canView: boolean;
  canManage: boolean;
  canManageTypes: boolean;
}

export interface LeadConfirmationCapabilities {
  enabled: boolean;
  canConfirm: boolean;
}

export interface LeadListParams {
  statusGroup?: "OPEN" | "CLOSED";
  storeId?: string;
  status?: LeadStatus;
  typeCode?: string;
  search?: string;
  initialChannel?: string;
  assignedSellerId?: string;
  assignment?: "MINE" | "UNASSIGNED";
  followUp?: "OVERDUE" | "TODAY" | "UPCOMING" | "NONE";
  fromDate?: string;
  toDate?: string;
  page?: number;
  limit?: number;
}

export interface LeadListResponse {
  items: Lead[];
  total: number;
  page: number;
  limit: number;
}

export interface CreateLeadTypeInput {
  code: string;
  name: string;
  fields?: LeadFieldDefinition[];
}

/** The field schema cannot be edited during the foundation phase. */
export interface UpdateLeadTypeInput {
  name?: string;
  active?: boolean;
}

export interface LeadSourceInput {
  provider: string;
  instanceId: string;
  objectType: string;
  externalId: string;
  kind?: "IDENTITY" | "CONTEXT";
}

export interface CreateLeadInput {
  /** Generate once per capture and reuse on retries; the service never replaces it. */
  captureId: string;
  typeCode: string;
  storeId?: string | null;
  contactName?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
  initialChannel?: string | null;
  estimatedAmount?: number | null;
  currency?: string | null;
  customFields?: Record<string, unknown>;
  sourceCreatedAt?: string | null;
  source?: LeadSourceInput;
}

export interface UpdateLeadInput {
  version: number;
  contactName?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
  estimatedAmount?: number | null;
  currency?: string | null;
  customFields?: Record<string, unknown>;
  nextActionAt?: string | null;
}

export interface AddLeadActivityInput {
  version: number;
  kind: "CONTACTADO" | "SEGUIMIENTO" | "NOTA";
  note?: string;
  nextActionAt?: string | null;
}

export interface ChangeLeadClosureInput {
  version: number;
  reason: string;
}

export interface ConfirmCommercialLeadInput {
  /** Keep this identifier and the selected order unchanged when retrying. */
  commandId: string;
  version: number;
  /** New order data, validated by the sales API; omit when adopting an existing order. */
  order?: Record<string, unknown>;
  /** Existing order updated_at seen by the seller; rejects a stale order summary. */
  expectedOrderUpdatedAt?: string;
}

export interface ConfirmCommercialOrderPurchaseInput {
  /** Keep the same command and reviewed order snapshot when retrying. */
  commandId: string;
  leadId?: string;
  version?: number;
  expectedOrderUpdatedAt?: string;
}

export interface LeadConfirmationResponse {
  lead: Lead;
  order: OrderHeader;
  replayed: boolean;
}
