import axiosAuth from "@/lib/axiosAuth";
import { GATEWAY } from "@/lib/gateway";
import type {
  CaptureLeadPaymentInput,
  ChangeLeadPaymentAmountInput,
  ChangeLeadPaymentProofInput,
  LeadPayment,
  LeadPaymentCapabilities,
  LeadPaymentList,
  LeadPaymentQuery,
  ReviewLeadPaymentInput,
} from "@/types/leadPayments";

const BASE = `${GATEWAY.ventas}/leads`;
const paymentsPath = (leadId: string) =>
  `${BASE}/${encodeURIComponent(leadId)}/payments`;
const paymentPath = (leadId: string, paymentId: string) =>
  `${paymentsPath(leadId)}/${encodeURIComponent(paymentId)}`;

export async function getLeadPaymentCapabilities(): Promise<LeadPaymentCapabilities> {
  return (
    await axiosAuth.get<LeadPaymentCapabilities>(`${BASE}/payment-capabilities`)
  ).data;
}
export async function listLeadPayments(
  params: LeadPaymentQuery = {},
): Promise<LeadPaymentList> {
  return (await axiosAuth.get<LeadPaymentList>(`${BASE}/payments`, { params }))
    .data;
}
export async function getLeadPayments(
  leadId: string,
): Promise<LeadPaymentList> {
  return (await axiosAuth.get<LeadPaymentList>(paymentsPath(leadId))).data;
}
export async function captureLeadPayment(
  leadId: string,
  input: CaptureLeadPaymentInput,
): Promise<LeadPayment> {
  return (await axiosAuth.post<LeadPayment>(paymentsPath(leadId), input)).data;
}
export async function approveLeadPayment(
  leadId: string,
  paymentId: string,
  input: ReviewLeadPaymentInput,
): Promise<LeadPayment> {
  return (
    await axiosAuth.patch<LeadPayment>(
      `${paymentPath(leadId, paymentId)}/approve`,
      input,
    )
  ).data;
}
export async function rejectLeadPayment(
  leadId: string,
  paymentId: string,
  input: ReviewLeadPaymentInput,
): Promise<LeadPayment> {
  return (
    await axiosAuth.patch<LeadPayment>(
      `${paymentPath(leadId, paymentId)}/reject`,
      input,
    )
  ).data;
}
export async function changeLeadPaymentAmount(
  leadId: string,
  paymentId: string,
  input: ChangeLeadPaymentAmountInput,
): Promise<LeadPayment> {
  return (
    await axiosAuth.patch<LeadPayment>(
      `${paymentPath(leadId, paymentId)}/amount`,
      input,
    )
  ).data;
}
export async function changeLeadPaymentProof(
  leadId: string,
  paymentId: string,
  input: ChangeLeadPaymentProofInput,
): Promise<LeadPayment> {
  return (
    await axiosAuth.patch<LeadPayment>(
      `${paymentPath(leadId, paymentId)}/proof`,
      input,
    )
  ).data;
}

export async function uploadLeadPaymentProof(
  leadId: string,
  paymentId: string,
  version: number,
  file: File,
): Promise<LeadPayment> {
  const data = new FormData();
  data.append("version", String(version));
  data.append("file", file);
  return (
    await axiosAuth.patch<LeadPayment>(
      `${paymentPath(leadId, paymentId)}/upload-proof`,
      data,
    )
  ).data;
}
