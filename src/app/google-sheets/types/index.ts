/** Pasos del asistente de Google Sheets. */
export type SetupStep =
  | 'CONNECT_ACCOUNT'
  | 'SELECT_FILE'
  | 'CONFIGURE'
  | 'MAP_FIELDS'
  | 'REVIEW'
  | 'STATUS';

// ---------------------------------------------------------------------------
// Tipos espejo de ms-integrations (src/google)
// ---------------------------------------------------------------------------

export type GoogleIntegrationStatus = 'NEEDS_SETUP' | 'READY' | 'NEEDS_RECONNECT';
export type RunStatus = 'success' | 'partial' | 'error';

export interface RunSummary {
  created: number;
  drafts: number;
  duplicates: number;
  problems: number;
  tabsSkipped: number;
}

export interface GoogleTab {
  id: number;
  name: string;
}

export type FieldKey =
  | 'order_ref'
  | 'customer_name'
  | 'phone'
  | 'document_number'
  | 'district'
  | 'city'
  | 'province'
  | 'address'
  | 'product_name'
  | 'sku'
  | 'quantity'
  | 'unit_price'
  | 'total_amount'
  | 'advance_payment'
  | 'payment_method'
  | 'receipt_type'
  | 'delivery_type'
  | 'seller_name'
  | 'sale_status'
  | 'delivery_date'
  | 'notes';

export type FieldGroup = 'identity' | 'customer' | 'product' | 'financial' | 'delivery';

export interface FieldDef {
  key: FieldKey;
  label: string;
  group: FieldGroup;
  required: boolean;
  synonyms: string[];
}

/** Campo de Powip → encabezado de la pestaña. */
export type HeaderMapping = Partial<Record<FieldKey, string>>;

export interface GoogleFile {
  id: string;
  name: string;
}

export interface GoogleConfigView {
  connected: boolean;
  status: GoogleIntegrationStatus;
  file: GoogleFile | null;
  storeId: string | null;
  tabs: GoogleTab[];
  headerMapping: HeaderMapping | null;
  running: boolean;
  lastRun: { at: string; status: RunStatus; summary: RunSummary } | null;
  lastError: string | null;
  openIssues: number;
}

export interface PreviewTab {
  id: number;
  name: string;
  rawHeaders: string[];
  headers: string[];
  sampleRows: string[][];
  rowCount: number;
  suggestedMapping: HeaderMapping;
}

export interface PreviewResponse {
  fields: FieldDef[];
  tabs: PreviewTab[];
}

export interface ReviewProblem {
  orderRef: string | null;
  rowNumbers: number[];
  message: string;
}

export interface ReviewResult {
  dataRows: number;
  orders: number;
  valid: number;
  withProblems: number;
  overLimit: boolean;
  limit: number;
  problems: ReviewProblem[];
}

/** Problema abierto; los de pestaña tienen orderRef '(pestaña)' y rowNumbers []. */
export interface SyncIssue {
  orderRef: string | null;
  rowNumbers: number[];
  code: string;
  message: string;
  firstSeenAt: string;
  lastSeenAt: string;
}

export interface SaveConfigPayload {
  storeId: string;
  tabIds: number[];
  headerMapping: Record<string, string>;
}

export interface ActivateResponse {
  status: 'READY';
  mode: 'import' | 'baseline';
}

export interface AuthUrlResponse {
  url: string;
}
