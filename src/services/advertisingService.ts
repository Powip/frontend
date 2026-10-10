import axios from "axios";
import type { EffectiveAdvertisingSpendWire } from "@/types/advertisingEffective";

export type AdvertisingProviderWire = "meta" | "tiktok";
export type AdvertisingConnectionStatusWire =
  | "disconnected"
  | "connected"
  | "needs-auth"
  | "paused";

export interface AdvertisingHistoryImportState {
  id: string;
  status: "queued" | "running" | "succeeded" | "failed" | "paused";
  availableFrom: string | null;
  availableTo: string | null;
  completedWindows: number;
  totalWindows: number | null;
  errorCode: string | null;
}

export interface AdvertisingHistoryImport extends AdvertisingHistoryImportState {
  accountId: string;
}

export type AdvertisingManualStatusWire =
  | "pending"
  | "represented"
  | "fallback"
  | "additional"
  | "excluded";
export type AdvertisingManualExclusionKind = "payment" | "service" | "allocation";

export interface AdvertisingAccountWire {
  id: string;
  provider: AdvertisingProviderWire;
  externalId: string;
  name: string;
  currency: string;
  timeZone: string;
  enabled: boolean;
  connectionId: string | null;
  syncFrom: string | null;
  lastAttemptAt: string | null;
  lastSuccessfulAt: string | null;
  updatedAt: string | null;
  historyImport?: AdvertisingHistoryImportState | null;
}

export interface AdvertisingDayWire {
  accountId: string;
  date: string;
  /** Decimal reported by the backend, preserved without conversion or rounding. */
  amount: string | null;
  currency: string;
  provisional: boolean;
  sourceRevision: string | null;
  updatedAt: string;
}

export interface AdvertisingManualRecordWire {
  id: string;
  source: string;
  browserKey: string;
  sourceId: string;
  date: string;
  amount: string | null;
  currency: string | null;
  status: AdvertisingManualStatusWire;
  importedAccountId: string | null;
  classificationCurrency?: string | null;
  exclusionKind?: AdvertisingManualExclusionKind | null;
  resolutionVersion: number;
  updatedAt?: string | null;
}

export interface AdvertisingLocalManualRecord {
  source: "pauta" | "cierre";
  browserKey: string;
  sourceId: string;
  date: string;
  amount: string | null;
  currency: string | null;
  payload: Record<string, unknown>;
}

export interface AdvertisingManualImportPreview {
  entries: Array<
    Omit<AdvertisingLocalManualRecord, "payload"> & {
      state: "new" | "existing" | "conflict";
      id?: string;
    }
  >;
  counts: { new: number; existing: number; conflict: number; total: number };
}

export interface AdvertisingManualResolutionPayload {
  action: "represented" | "reopened" | "fallback" | "additional" | "excluded";
  expectedVersion: number;
  reason: string;
  accountId?: string;
  currency?: string;
  exclusionKind?: AdvertisingManualExclusionKind;
  additionalConsumptionConfirmed?: true;
}

export interface AdvertisingManualAuditEntry {
  id: string;
  manualRecordId: string;
  actorId: string;
  action: AdvertisingManualResolutionPayload["action"];
  reason: string;
  resolutionVersion: number;
  accountId: string | null;
  classificationCurrency: string | null;
  exclusionKind: AdvertisingManualExclusionKind | null;
  amount: string | null;
  importedAmount: string | null;
  createdAt: string;
}

export interface AdvertisingSnapshotWire {
  accounts: AdvertisingAccountWire[];
  days: AdvertisingDayWire[];
  manualRecords: AdvertisingManualRecordWire[];
  providers: Record<
    AdvertisingProviderWire,
    {
      available: boolean;
      status: AdvertisingConnectionStatusWire;
    }
  >;
  capabilities: { canManage: boolean; canReconcile: boolean };
  today: string;
  effective?: EffectiveAdvertisingSpendWire;
}

export interface AdvertisingManualResolutionPreview {
  recordId: string;
  expectedVersion: number;
  beforeStatus?: AdvertisingManualStatusWire;
  afterStatus?: AdvertisingManualStatusWire;
  before: EffectiveAdvertisingSpendWire;
  after: EffectiveAdvertisingSpendWire;
}

export interface AdvertisingDiscoveredAccount {
  externalId: string;
  name: string;
  currency: string;
  timeZone: string;
  enabled?: boolean;
}

export interface AdvertisingSelectionPayload {
  externalIds: string[];
}

export interface AdvertisingSyncRun {
  accountId: string;
  from: string;
  to: string;
  status: "succeeded" | "failed" | "busy" | "paused";
  errorCode?: string;
}

export class AdvertisingApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "AdvertisingApiError";
  }
}

export function advertisingApiBase(): string {
  const configured = process.env.NEXT_PUBLIC_API_INTEGRATIONS;
  try {
    if (!configured?.trim()) throw new Error("Missing integration origin");
    const url = new URL(configured);
    const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if (
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      (url.protocol !== "https:" &&
        !(url.protocol === "http:" && loopback && process.env.NODE_ENV !== "production"))
    ) {
      throw new Error("Invalid integration origin");
    }
    return url.toString().replace(/\/+$/, "");
  } catch {
    throw new AdvertisingApiError("La conexión de publicidad aún no está configurada.", 503);
  }
}

function companyUrl(companyId: string): string {
  return `${advertisingApiBase()}/advertising/companies/${encodeURIComponent(companyId)}`;
}

function providerUrl(companyId: string, provider: AdvertisingProviderWire): string {
  if (provider !== "meta" && provider !== "tiktok") {
    throw new AdvertisingApiError("Esta plataforma no está disponible.", 400);
  }
  return `${companyUrl(companyId)}/${provider}`;
}

function requestOptions(token: string, signal?: AbortSignal, timeout = 30_000) {
  if (!token || token.length > 16_384 || /\s/.test(token)) {
    throw new AdvertisingApiError("Vuelve a iniciar sesión para continuar.", 401);
  }
  return {
    headers: { Authorization: `Bearer ${token}` },
    timeout,
    withCredentials: false,
    signal,
  };
}

export async function getAdvertisingSnapshot(
  token: string,
  companyId: string,
  from: string,
  to: string,
  signal?: AbortSignal,
): Promise<AdvertisingSnapshotWire> {
  const response = await axios.get<AdvertisingSnapshotWire>(`${companyUrl(companyId)}/snapshot`, {
    ...requestOptions(token, signal),
    params: { from, to },
  });
  return response.data;
}

export async function startAdvertisingAuthorization(
  token: string,
  companyId: string,
  provider: AdvertisingProviderWire,
): Promise<{ url: string }> {
  const response = await axios.post<{ url: string }>(
    `${providerUrl(companyId, provider)}/authorization`,
    {},
    requestOptions(token),
  );
  return response.data;
}

export async function completeAdvertisingAuthorization(
  token: string,
  companyId: string,
  provider: AdvertisingProviderWire,
  payload: { state: string; code: string },
): Promise<{ connected: true }> {
  const response = await axios.post<{ connected: true }>(
    `${providerUrl(companyId, provider)}/callback`,
    payload,
    requestOptions(token),
  );
  return response.data;
}

export async function discoverAdvertisingAccounts(
  token: string,
  companyId: string,
  provider: AdvertisingProviderWire,
  signal?: AbortSignal,
): Promise<{ accounts: AdvertisingDiscoveredAccount[] }> {
  const response = await axios.get<{ accounts: AdvertisingDiscoveredAccount[] }>(
    `${providerUrl(companyId, provider)}/accounts`,
    requestOptions(token, signal),
  );
  return response.data;
}

export async function selectAdvertisingAccounts(
  token: string,
  companyId: string,
  provider: AdvertisingProviderWire,
  payload: AdvertisingSelectionPayload,
): Promise<{ selectedCount: number; imports: AdvertisingHistoryImport[] }> {
  const response = await axios.put<{ selectedCount: number; imports: AdvertisingHistoryImport[] }>(
    `${providerUrl(companyId, provider)}/accounts`,
    { externalIds: payload.externalIds },
    requestOptions(token),
  );
  return response.data;
}

export async function importAdvertisingHistory(
  token: string,
  companyId: string,
  provider: AdvertisingProviderWire,
): Promise<{ imports: AdvertisingHistoryImport[] }> {
  const response = await axios.post<{ imports: AdvertisingHistoryImport[] }>(
    `${providerUrl(companyId, provider)}/history-import`,
    {},
    requestOptions(token),
  );
  return response.data;
}

export async function pauseAdvertisingUpdates(
  token: string,
  companyId: string,
  provider: AdvertisingProviderWire,
): Promise<{ paused: true }> {
  const response = await axios.post<{ paused: true }>(
    `${providerUrl(companyId, provider)}/pause`,
    {},
    requestOptions(token),
  );
  return response.data;
}

export async function syncAdvertisingSpend(
  token: string,
  companyId: string,
  provider: AdvertisingProviderWire,
  payload: { from: string; to: string },
): Promise<{ runs: AdvertisingSyncRun[] }> {
  const response = await axios.post<{ runs: AdvertisingSyncRun[] }>(
    `${providerUrl(companyId, provider)}/sync`,
    payload,
    requestOptions(token, undefined, 60_000),
  );
  return response.data;
}

function utf8Bytes(value: string): number {
  let bytes = 0;
  for (const character of value) {
    const point = character.codePointAt(0) ?? 0;
    bytes += point <= 0x7f ? 1 : point <= 0x7ff ? 2 : point <= 0xffff ? 3 : 4;
  }
  return bytes;
}

export const ADVERTISING_MANUAL_REQUEST_BYTES = 90 * 1024;

export function batchAdvertisingManualRecords(
  records: AdvertisingLocalManualRecord[],
): AdvertisingLocalManualRecord[][] {
  const batches: AdvertisingLocalManualRecord[][] = [];
  let current: AdvertisingLocalManualRecord[] = [];
  let bytes = 14;
  for (const record of records) {
    const recordBytes = utf8Bytes(JSON.stringify(record)) + 1;
    if (recordBytes + 14 > ADVERTISING_MANUAL_REQUEST_BYTES)
      throw new AdvertisingApiError("Este registro excede el tamaño permitido.", 400);
    if (current.length === 200 || bytes + recordBytes > ADVERTISING_MANUAL_REQUEST_BYTES) {
      batches.push(current);
      current = [];
      bytes = 14;
    }
    current.push(record);
    bytes += recordBytes;
  }
  if (current.length) batches.push(current);
  return batches;
}

function manualBatch(records: AdvertisingLocalManualRecord[]) {
  if (records.length === 0 || records.length > 200) {
    throw new AdvertisingApiError("Elige entre 1 y 200 registros por operación.", 400);
  }
  if (utf8Bytes(JSON.stringify({ records })) > ADVERTISING_MANUAL_REQUEST_BYTES) {
    throw new AdvertisingApiError(
      "Los registros exceden el tamaño permitido. Usa un lote menor.",
      400,
    );
  }
  return { records };
}

export async function previewAdvertisingManualImport(
  token: string,
  companyId: string,
  records: AdvertisingLocalManualRecord[],
  signal?: AbortSignal,
): Promise<AdvertisingManualImportPreview> {
  const response = await axios.post<AdvertisingManualImportPreview>(
    `${companyUrl(companyId)}/manual/preview`,
    manualBatch(records),
    requestOptions(token, signal),
  );
  return response.data;
}

export async function importAdvertisingManualRecords(
  token: string,
  companyId: string,
  records: AdvertisingLocalManualRecord[],
): Promise<AdvertisingManualImportPreview> {
  const response = await axios.post<AdvertisingManualImportPreview>(
    `${companyUrl(companyId)}/manual/import`,
    manualBatch(records),
    requestOptions(token),
  );
  return response.data;
}

export async function resolveAdvertisingManualRecord(
  token: string,
  companyId: string,
  recordId: string,
  payload: AdvertisingManualResolutionPayload,
): Promise<{ record: AdvertisingManualRecordWire }> {
  const response = await axios.post<{ record: AdvertisingManualRecordWire }>(
    `${companyUrl(companyId)}/manual/${encodeURIComponent(recordId)}/resolve`,
    payload,
    requestOptions(token),
  );
  return response.data;
}

export async function previewAdvertisingManualResolution(
  token: string,
  companyId: string,
  recordId: string,
  payload: AdvertisingManualResolutionPayload,
  signal?: AbortSignal,
): Promise<AdvertisingManualResolutionPreview> {
  const response = await axios.post<AdvertisingManualResolutionPreview>(
    `${companyUrl(companyId)}/manual/${encodeURIComponent(recordId)}/resolution-preview`,
    payload,
    requestOptions(token, signal),
  );
  return response.data;
}

export async function getAdvertisingManualAudit(
  token: string,
  companyId: string,
  recordId: string,
  signal?: AbortSignal,
): Promise<{ entries: AdvertisingManualAuditEntry[] }> {
  const response = await axios.get<{ entries: AdvertisingManualAuditEntry[] }>(
    `${companyUrl(companyId)}/manual/${encodeURIComponent(recordId)}/audit`,
    requestOptions(token, signal),
  );
  return response.data;
}

export function advertisingErrorStatus(failure: unknown): number | undefined {
  if (failure instanceof AdvertisingApiError) return failure.status;
  return axios.isAxiosError(failure) ? failure.response?.status : undefined;
}

export function advertisingErrorMessage(failure: unknown): string {
  if (failure instanceof AdvertisingApiError) return failure.message;
  switch (advertisingErrorStatus(failure)) {
    case 401:
      return "Vuelve a iniciar sesión para continuar.";
    case 403:
      return "No tienes permiso para continuar.";
    case 409:
      return "La configuración cambió. Actualiza e inténtalo de nuevo.";
    case 429:
      return "Espera un momento e inténtalo de nuevo.";
    case 503:
      return "Publicidad no está disponible. Inténtalo de nuevo.";
    default:
      return "No pudimos cargar la publicidad. Inténtalo de nuevo.";
  }
}

export function advertisingManualErrorMessage(failure: unknown): string {
  if (advertisingErrorStatus(failure) === 400)
    return "Revisa los datos del registro e inténtalo de nuevo.";
  if (advertisingErrorStatus(failure) === 409)
    return "El registro cambió. Vuelve a revisar la vista previa.";
  if (advertisingErrorStatus(failure) === 413)
    return "El lote es demasiado grande. Importa menos registros.";
  return advertisingErrorMessage(failure);
}
