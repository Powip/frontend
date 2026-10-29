import axios from "axios";
import axiosAuth from "@/lib/axiosAuth";
import { GATEWAY } from "@/lib/gateway";
import type {
  ConvertQuotationInput,
  CreateQuotationInput,
  PublicQuotation,
  Quotation,
  QuotationAddress,
  QuotationCatalogItem,
  QuotationCatalogPage,
  QuotationCustomer,
  QuotationInventory,
  QuotationListParams,
  QuotationListResponse,
  QuotationPaymentInput,
  QuotationPaymentStatus,
  ReconcileQuotationLeadPaymentInput,
  ReconciledQuotationLeadPayment,
} from "@/types/quotations";

const BASE = `${GATEWAY.ventas}/quotations`;
const PUBLIC_BASE = `${GATEWAY.ventas}/public/quotations`;
const publicPath = (token: string) => `${PUBLIC_BASE}/${encodeURIComponent(token)}`;

export async function listQuotations(
  params: QuotationListParams,
  options?: { signal?: AbortSignal },
) {
  return (
    await axiosAuth.get<QuotationListResponse>(BASE, {
      params,
      ...(options?.signal ? { signal: options.signal } : {}),
    })
  ).data;
}
export async function getQuotation(id: string, options?: { signal?: AbortSignal }) {
  if (options?.signal)
    return (await axiosAuth.get<Quotation>(`${BASE}/${id}`, { signal: options.signal })).data;
  return (await axiosAuth.get<Quotation>(`${BASE}/${id}`)).data;
}
export async function getQuotationCatalog(
  params: { storeId: string; inventoryId?: string; search?: string; page?: number; limit?: number },
  signal?: AbortSignal,
) {
  return (
    await axiosAuth.get<QuotationCatalogItem[]>(`${BASE}/catalog`, {
      params,
      ...(signal ? { signal } : {}),
    })
  ).data;
}
export async function getQuotationInventories(storeId: string, signal?: AbortSignal) {
  return (
    await axiosAuth.get<QuotationInventory[]>(`${BASE}/inventories`, {
      params: { storeId },
      ...(signal ? { signal } : {}),
    })
  ).data;
}
export async function searchQuotationCustomers(
  params: { storeId: string; search: string },
  signal?: AbortSignal,
) {
  return (
    await axiosAuth.get<QuotationCustomer[]>(`${BASE}/customers`, {
      params,
      ...(signal ? { signal } : {}),
    })
  ).data;
}
export async function uploadQuotationLineImage(storeId: string, file: File): Promise<string> {
  if (file.size > 5 * 1024 * 1024) throw new Error("La foto debe pesar como máximo 5 MB.");
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
    throw new Error("Adjunta una foto JPG, PNG o WebP.");
  const form = new FormData();
  form.append("file", file);
  const { data } = await axiosAuth.post<{ imageUrl: string }>(`${BASE}/line-image`, form, {
    params: { storeId },
  });
  return data.imageUrl;
}
export async function createQuotation(input: CreateQuotationInput) {
  return (await axiosAuth.post<Quotation>(BASE, input)).data;
}
export async function updateQuotation(id: string, input: Partial<CreateQuotationInput>) {
  return (await axiosAuth.patch<Quotation>(`${BASE}/${id}`, input)).data;
}
export async function deleteQuotation(id: string) {
  await axiosAuth.delete(`${BASE}/${id}`);
}
export async function renewQuotation(id: string) {
  return (await axiosAuth.post<Quotation>(`${BASE}/${id}/renew`, {})).data;
}
export async function registerQuotationPayment(id: string, input: QuotationPaymentInput) {
  return (await axiosAuth.post<Quotation>(`${BASE}/${id}/payments`, input)).data;
}
export async function reviewQuotationPayment(
  id: string,
  paymentId: string,
  status: Exclude<QuotationPaymentStatus, "PENDIENTE">,
) {
  return (await axiosAuth.patch<Quotation>(`${BASE}/${id}/payments/${paymentId}`, { status })).data;
}
export async function reconcileQuotationLeadPayment(
  id: string,
  paymentId: string,
  input: ReconcileQuotationLeadPaymentInput,
): Promise<ReconciledQuotationLeadPayment> {
  return (
    await axiosAuth.post<ReconciledQuotationLeadPayment>(
      `${BASE}/${encodeURIComponent(id)}/payments/${encodeURIComponent(paymentId)}/reconcile-lead`,
      input,
    )
  ).data;
}
type QuotationConversionInput = ConvertQuotationInput & {
  commandId?: string;
  leadId?: string;
  leadVersion?: number;
};

const conversionAttempts = new Map<string, { selection: string; commandId: string }>();

export async function convertQuotation(id: string, input: QuotationConversionInput) {
  const { commandId, leadVersion: _leadVersion, leadId: _leadId, ...selection } = input;
  const selectionKey = JSON.stringify(
    Object.fromEntries(
      Object.entries(selection).sort(([left], [right]) => left.localeCompare(right)),
    ),
  );
  const previous = conversionAttempts.get(id);
  const attempt =
    previous?.selection === selectionKey &&
    (commandId === undefined || commandId === previous.commandId)
      ? previous
      : { selection: selectionKey, commandId: commandId ?? crypto.randomUUID() };
  conversionAttempts.set(id, attempt);

  // Legacy also accepts commandId. Always send it rather than racing a flag read.
  // Keep it after failures and concurrent requests; callers may reconstruct input
  // on each click. A different selection starts a different conversion attempt.
  const { data } = await axiosAuth.post<Quotation>(`${BASE}/${encodeURIComponent(id)}/convert`, {
    ...input,
    commandId: attempt.commandId,
  });
  if (conversionAttempts.get(id) === attempt) conversionAttempts.delete(id);
  return data;
}
export async function getPublicQuotation(token: string, options?: { signal?: AbortSignal }) {
  return (
    await axios.get<PublicQuotation>(publicPath(token), {
      withCredentials: false,
      ...(options?.signal ? { signal: options.signal } : {}),
    })
  ).data;
}
export async function getPublicQuotationCatalog(
  token: string,
  options?: { signal?: AbortSignal; search?: string; page?: number; limit?: number },
): Promise<QuotationCatalogItem[] | QuotationCatalogPage> {
  const params = {
    ...(options?.search !== undefined ? { search: options.search } : {}),
    ...(options?.page !== undefined ? { page: options.page } : {}),
    ...(options?.limit !== undefined ? { limit: options.limit } : {}),
  };
  return (
    await axios.get<QuotationCatalogItem[] | QuotationCatalogPage>(`${publicPath(token)}/catalog`, {
      withCredentials: false,
      ...(options?.signal ? { signal: options.signal } : {}),
      ...(Object.keys(params).length ? { params } : {}),
    })
  ).data;
}
export async function confirmPublicQuotation(token: string) {
  return (
    await axios.post<PublicQuotation>(
      `${publicPath(token)}/confirm`,
      {},
      { withCredentials: false },
    )
  ).data;
}
export async function savePublicQuotationAddress(token: string, input: QuotationAddress) {
  return (
    await axios.post<PublicQuotation>(`${publicPath(token)}/address`, input, {
      withCredentials: false,
    })
  ).data;
}
export async function registerPublicQuotationPayment(token: string, input: QuotationPaymentInput) {
  return (
    await axios.post<PublicQuotation>(`${publicPath(token)}/payments`, input, {
      withCredentials: false,
    })
  ).data;
}
export async function addPublicQuotationLine(
  token: string,
  productVariantId: string,
  quantity = 1,
) {
  return (
    await axios.post<PublicQuotation>(
      `${publicPath(token)}/lines`,
      { productVariantId, quantity },
      { withCredentials: false },
    )
  ).data;
}
export async function removePublicQuotationLine(token: string, lineId: string) {
  return (
    await axios.delete<PublicQuotation>(
      `${publicPath(token)}/lines/${encodeURIComponent(lineId)}`,
      { withCredentials: false },
    )
  ).data;
}

function proofForm(file: File) {
  if (file.size > 5 * 1024 * 1024) throw new Error("El comprobante debe pesar como máximo 5 MB.");
  if (!["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(file.type)) {
    throw new Error("Adjunta un comprobante JPG, PNG, WebP o PDF.");
  }
  const form = new FormData();
  form.append("file", file);
  return form;
}
export async function uploadQuotationProof(id: string, file: File): Promise<string> {
  const { data } = await axiosAuth.post<{ url: string }>(
    `${BASE}/${id}/payments/proof`,
    proofForm(file),
  );
  return data.url;
}
export async function uploadPublicQuotationProof(token: string, file: File): Promise<string> {
  const { data } = await axios.post<{ url: string }>(
    `${publicPath(token)}/payments/proof`,
    proofForm(file),
    { withCredentials: false },
  );
  return data.url;
}

export function quotationError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const message: unknown = error.response?.data?.message;
    if (Array.isArray(message)) return message.join(". ");
    if (typeof message === "string") return message;
  }
  return error instanceof Error
    ? error.message
    : "No se pudo completar la acción. Intenta de nuevo.";
}
export function quotationMoney(value: number) {
  return `S/${Number(value || 0).toFixed(2)}`;
}
