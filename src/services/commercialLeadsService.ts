import axios from "axios";
import axiosAuth from "@/lib/axiosAuth";
import { GATEWAY } from "@/lib/gateway";
import type {
  AddLeadActivityInput,
  ChangeLeadClosureInput,
  ConfirmCommercialLeadInput,
  CreateLeadInput,
  CreateLeadTypeInput,
  Lead,
  LeadCapabilities,
  LeadConfirmationCapabilities,
  LeadConfirmationResponse,
  LeadDetail,
  LeadCommercialContext,
  LeadListParams,
  LeadListResponse,
  LeadType,
  UpdateLeadInput,
  UpdateLeadTypeInput,
} from "@/types/leads";

const BASE = `${GATEWAY.ventas}/leads`;
const leadPath = (id: string) => `${BASE}/${encodeURIComponent(id)}`;
const typePath = (code: string) => `${BASE}/types/${encodeURIComponent(code)}`;

export async function getCommercialLeadCapabilities(): Promise<LeadCapabilities> {
  return (await axiosAuth.get<LeadCapabilities>(`${BASE}/capabilities`)).data;
}

export async function getCommercialLeadConfirmationCapabilities(): Promise<LeadConfirmationCapabilities> {
  return (
    await axiosAuth.get<LeadConfirmationCapabilities>(
      `${BASE}/confirmation-capabilities`,
    )
  ).data;
}

export async function listCommercialLeadTypes(): Promise<LeadType[]> {
  return (await axiosAuth.get<LeadType[]>(`${BASE}/types`)).data;
}

export async function createCommercialLeadType(
  input: CreateLeadTypeInput,
): Promise<LeadType> {
  return (await axiosAuth.post<LeadType>(`${BASE}/types`, input)).data;
}

export async function updateCommercialLeadType(
  code: string,
  input: UpdateLeadTypeInput,
): Promise<LeadType> {
  return (await axiosAuth.patch<LeadType>(typePath(code), input)).data;
}

/** Explicit setup only: reads and capture never bootstrap or activate the module. */
export async function bootstrapCommercialLeadTypes(): Promise<LeadType[]> {
  return (await axiosAuth.post<LeadType[]>(`${BASE}/types/bootstrap`, {})).data;
}

export async function listCommercialLeads(
  params: LeadListParams = {},
): Promise<LeadListResponse> {
  return (await axiosAuth.get<LeadListResponse>(BASE, { params })).data;
}

export async function getCommercialLead(id: string): Promise<LeadDetail> {
  return (await axiosAuth.get<LeadDetail>(leadPath(id))).data;
}

export async function getCommercialLeadContext(
  id: string,
): Promise<LeadCommercialContext> {
  return (await axiosAuth.get<LeadCommercialContext>(`${leadPath(id)}/context`))
    .data;
}

export async function createCommercialLead(
  input: CreateLeadInput,
): Promise<Lead> {
  return (await axiosAuth.post<Lead>(BASE, input)).data;
}

export async function updateCommercialLead(
  id: string,
  input: UpdateLeadInput,
): Promise<Lead> {
  return (await axiosAuth.patch<Lead>(leadPath(id), input)).data;
}

export async function addCommercialLeadActivity(
  id: string,
  input: AddLeadActivityInput,
): Promise<Lead> {
  return (await axiosAuth.post<Lead>(`${leadPath(id)}/activities`, input)).data;
}

export async function loseCommercialLead(
  id: string,
  input: ChangeLeadClosureInput,
): Promise<Lead> {
  return (await axiosAuth.post<Lead>(`${leadPath(id)}/lose`, input)).data;
}

export async function reopenCommercialLead(
  id: string,
  input: ChangeLeadClosureInput,
): Promise<Lead> {
  return (await axiosAuth.post<Lead>(`${leadPath(id)}/reopen`, input)).data;
}

export async function confirmCommercialLead(
  id: string,
  input: ConfirmCommercialLeadInput,
): Promise<LeadConfirmationResponse> {
  return (
    await axiosAuth.post<LeadConfirmationResponse>(
      `${leadPath(id)}/confirm-purchase`,
      input,
    )
  ).data;
}

export function commercialLeadError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const message: unknown = error.response?.data?.message;
    if (Array.isArray(message)) return message.join(". ");
    if (typeof message === "string") return message;
  }
  return error instanceof Error
    ? error.message
    : "No se pudo completar la acción. Intenta de nuevo.";
}
