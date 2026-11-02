import axiosAuth from "@/lib/axiosAuth";
import { GATEWAY } from "@/lib/gateway";

export type SettlementMethod = "transferencia" | "yape" | "efectivo" | "otro";
export interface CourierCollection {
  id: string;
  companyId: string;
  orderId: string;
  storeId: string;
  orderNumber: string;
  customerName: string;
  courierId: string;
  courierName: string;
  currency: string;
  amount: number;
  settledAmount: number;
  remainingAmount: number;
  reservedAmount: number;
  availableAmount: number;
  status: "POR_LIQUIDAR" | "EN_REVISION" | "LIQUIDADO";
  collectedAt: string;
  notes: string;
  createdAt: string;
  createdBy: string;
  providerEvidenceId?: string | null;
  providerEvidence?: { id: string; provider: string; reportedAmount: string | null } | null;
}
export interface CourierSettlement {
  id: string;
  companyId: string;
  courierId: string;
  courierName: string;
  currency: string;
  amountExpected: number;
  amountDeposited: number;
  amountAllocated: number;
  unallocatedAmount: number;
  difference: number;
  status: "PENDIENTE_REVISION" | "CONCILIADA" | "CON_DIFERENCIA" | "RECHAZADA";
  method: SettlementMethod;
  date: string;
  operationNumber: string | null;
  notes: string | null;
  createdBy: string;
  createdAt: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewNotes: string | null;
  version: number;
}
export interface SettlementProof {
  id: string;
  resourceType: "collections" | "settlements";
  resourceId: string;
  fileName: string;
  mimeType: string;
  size: number;
  createdBy: string;
  createdAt: string;
}
export interface SettlementAuditEvent {
  id: string;
  type: string;
  actorId: string;
  data: Record<string, unknown>;
  createdAt: string;
}
export interface CollectionDetail extends CourierCollection {
  proofs: SettlementProof[];
  events: SettlementAuditEvent[];
}
export interface SettlementDetail extends CourierSettlement {
  allocations: {
    collectionId: string;
    orderId: string;
    orderNumber: string;
    customerName: string;
    storeId: string;
    amount: number;
    amountExpected: number;
  }[];
  proofs: SettlementProof[];
  events: SettlementAuditEvent[];
}
export interface CourierSettlementWorkspace {
  capabilities: { canConfirm: boolean; canRegister: boolean; canReconcile: boolean };
  collections: CourierCollection[];
  history: CourierSettlement[];
}
export interface ConfirmCollectionInput {
  requestId: string;
  orderId: string;
  courierId: string;
  amount: number;
  collectedAt: string;
  notes: string;
  providerEvidenceId?: string;
}
export interface CreateSettlementInput {
  requestId: string;
  courierId: string;
  allocations: { collectionId: string; amount: number }[];
  amountDeposited: number;
  method: SettlementMethod;
  date: string;
  operationNumber?: string;
  notes?: string;
}
const courierBase = (process.env.NEXT_PUBLIC_API_COURIER || GATEWAY.courier).replace(/\/$/, "");
const base = (companyId: string) =>
  `${courierBase}/courier-settlements/company/${encodeURIComponent(companyId)}`;
const resource = (companyId: string, kind: "collections" | "settlements", id: string) =>
  `${base(companyId)}/${kind}/${encodeURIComponent(id)}`;

export async function getCourierSettlements(
  companyId: string,
  signal?: AbortSignal,
): Promise<CourierSettlementWorkspace> {
  const { data } = await axiosAuth.get<CourierSettlementWorkspace>(base(companyId), { signal });
  if (
    !data.capabilities ||
    !Array.isArray(data.collections) ||
    !Array.isArray(data.history) ||
    [...data.collections, ...data.history].some((item) => item.companyId !== companyId)
  )
    throw new Error("No se pudieron verificar las liquidaciones de esta empresa.");
  return data;
}
export async function confirmCourierCollection(
  companyId: string,
  input: ConfirmCollectionInput,
): Promise<CourierCollection> {
  return (await axiosAuth.post<CourierCollection>(`${base(companyId)}/collections`, input)).data;
}
export async function createCourierSettlement(
  companyId: string,
  input: CreateSettlementInput,
): Promise<SettlementDetail> {
  return (await axiosAuth.post<SettlementDetail>(`${base(companyId)}/settlements`, input)).data;
}
export async function getCourierCollection(
  companyId: string,
  id: string,
  signal?: AbortSignal,
): Promise<CollectionDetail> {
  return (await axiosAuth.get<CollectionDetail>(resource(companyId, "collections", id), { signal }))
    .data;
}
export async function getCourierSettlement(
  companyId: string,
  id: string,
  signal?: AbortSignal,
): Promise<SettlementDetail> {
  return (await axiosAuth.get<SettlementDetail>(resource(companyId, "settlements", id), { signal }))
    .data;
}
export async function reviewCourierSettlement(
  companyId: string,
  id: string,
  input: { accept: boolean; version: number; notes: string },
): Promise<SettlementDetail> {
  return (
    await axiosAuth.post<SettlementDetail>(
      `${resource(companyId, "settlements", id)}/reconcile`,
      input,
    )
  ).data;
}
export function validateSettlementProof(file: File) {
  if (file.size > 10 * 1024 * 1024) throw new Error("El comprobante debe pesar como máximo 10 MB.");
  if (
    !file.size ||
    !["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(file.type)
  )
    throw new Error("Adjunta un archivo JPG, PNG, WebP o PDF válido.");
}
export async function uploadSettlementProof(
  companyId: string,
  kind: "collections" | "settlements",
  id: string,
  file: File,
): Promise<SettlementProof> {
  validateSettlementProof(file);
  const body = new FormData();
  body.append("file", file);
  return (await axiosAuth.post<SettlementProof>(`${resource(companyId, kind, id)}/proofs`, body))
    .data;
}
export async function getSettlementProofUrl(
  companyId: string,
  proofId: string,
): Promise<{ url: string; expiresIn: number }> {
  const { data } = await axiosAuth.get<{ url: string; expiresIn: number }>(
    `${base(companyId)}/proofs/${encodeURIComponent(proofId)}/url`,
  );
  if (new URL(data.url).protocol !== "https:")
    throw new Error("No se pudo verificar el enlace del comprobante.");
  return data;
}

export const settlementMethodLabels: Record<SettlementMethod, string> = {
  transferencia: "Transferencia",
  yape: "Yape",
  efectivo: "Efectivo",
  otro: "Otro",
};
export const settlementStatusLabels: Record<CourierSettlement["status"], string> = {
  PENDIENTE_REVISION: "Pendiente de revisión",
  CONCILIADA: "Depósito conciliado",
  CON_DIFERENCIA: "Aceptada con diferencia",
  RECHAZADA: "Rechazada",
};
export const collectionStatusLabels: Record<CourierCollection["status"], string> = {
  POR_LIQUIDAR: "Por liquidar",
  EN_REVISION: "En revisión",
  LIQUIDADO: "Liquidado al negocio",
};
export function settlementMoney(amount: number, currency: string) {
  return `${currency} ${Number.isFinite(amount) ? amount.toFixed(2) : "Por verificar"}`;
}
export function positiveMoney(value: string): number | null {
  if (!/^\d+(?:\.\d{1,2})?$/.test(value.trim())) return null;
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 && amount <= 9999999999.99 ? amount : null;
}
