import axiosAuth from "@/lib/axiosAuth";
import { GATEWAY } from "@/lib/gateway";
import type { QuotationPaymentDestination, QuotationSettings } from "@/types/quotations";

const base = `${GATEWAY.ventas}/quotation-settings`;
export async function getQuotationSettings(storeId: string, signal?: AbortSignal) {
  return (
    await axiosAuth.get<QuotationSettings>(`${base}/${encodeURIComponent(storeId)}`, { signal })
  ).data;
}
export async function saveQuotationSettings(
  storeId: string,
  version: number,
  destinations: QuotationPaymentDestination[],
) {
  return (
    await axiosAuth.put<QuotationSettings>(`${base}/${encodeURIComponent(storeId)}`, {
      version,
      destinations,
    })
  ).data;
}
export async function uploadQuotationPaymentQr(storeId: string, file: File) {
  if (
    file.size > 2 * 1024 * 1024 ||
    !["image/png", "image/jpeg", "image/webp"].includes(file.type)
  ) {
    throw new Error("Elige un QR PNG, JPG o WebP de hasta 2 MB.");
  }
  const form = new FormData();
  form.append("file", file);
  return (
    await axiosAuth.post<{ qrUrl: string }>(`${base}/${encodeURIComponent(storeId)}/qr`, form)
  ).data.qrUrl;
}
