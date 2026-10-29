import axios from "axios";
import z from "zod";
import { API } from "@/lib/api";
import {
  adminInvitationsPageSchema,
  invitationPageParamsSchema,
  invitationCreateCommandSchema,
  invitationCreateReceiptSchema,
  invitationResendCommandSchema,
  invitationResendReceiptSchema,
  type InvitationCreateCommand,
  type InvitationResendCommand,
  invitationTokenSchema,
  invitationAcceptReceiptSchema,
  invitationStateFilterSchema,
  type InvitationStateFilter,
} from "../schemas/admin-invitations.schema";
import type { AdminPageRequest, AdminReadRequest } from "./admin-partners.api";

export const adminInvitationsClient = axios.create({ timeout: 10_000 });
const keySchema = z.string().regex(/^[A-Za-z0-9._:-]{8,200}$/);
export type CreateInvitationRequest = AdminReadRequest & {
  command: InvitationCreateCommand;
  idempotencyKey: string;
};
export type ResendInvitationRequest = AdminReadRequest & {
  invitationId: string;
  command: InvitationResendCommand;
  idempotencyKey: string;
};

export async function requestCreateInvitation(request: CreateInvitationRequest) {
  const command = invitationCreateCommandSchema.parse(request.command);
  const key = keySchema.parse(request.idempotencyKey);
  const { data } = await adminInvitationsClient.post<unknown>(
    `${API.partners}/admin/invitations`,
    command,
    {
      signal: request.signal,
      headers: { Authorization: `Bearer ${request.accessToken}`, "Idempotency-Key": key },
    },
  );
  return invitationCreateReceiptSchema.parse(data);
}
export async function requestResendInvitation(request: ResendInvitationRequest) {
  const id = z
    .uuid()
    .refine((value) => value === value.toLowerCase())
    .parse(request.invitationId);
  const command = invitationResendCommandSchema.parse(request.command);
  const key = keySchema.parse(request.idempotencyKey);
  const { data } = await adminInvitationsClient.post<unknown>(
    `${API.partners}/admin/invitations/${id}/resend`,
    command,
    {
      signal: request.signal,
      headers: { Authorization: `Bearer ${request.accessToken}`, "Idempotency-Key": key },
    },
  );
  return invitationResendReceiptSchema.refine((value) => value.invitationId === id).parse(data);
}
export async function requestPendingInvitations(
  request: AdminPageRequest & { state?: InvitationStateFilter },
) {
  const page = invitationPageParamsSchema.parse({ cursor: request.cursor, limit: request.limit });
  const state = invitationStateFilterSchema.parse(request.state ?? "ALL");
  const { data } = await adminInvitationsClient.get<unknown>(`${API.partners}/admin/invitations`, {
    signal: request.signal,
    headers: { Authorization: `Bearer ${request.accessToken}` },
    params: {
      state,
      ...(page.cursor ? { cursor: page.cursor } : {}),
      ...(page.limit !== undefined ? { limit: page.limit } : {}),
    },
  });
  return adminInvitationsPageSchema
    .refine((result) => result.items.length <= (page.limit ?? 20))
    .parse(data);
}

export async function requestAcceptInvitation(
  request: AdminReadRequest & { token: string; idempotencyKey: string },
) {
  const token = invitationTokenSchema.parse(request.token);
  const key = keySchema.parse(request.idempotencyKey);
  const { data } = await adminInvitationsClient.post<unknown>(
    `${API.partners}/invitations/accept`,
    { token },
    {
      signal: request.signal,
      headers: { Authorization: `Bearer ${request.accessToken}`, "Idempotency-Key": key },
    },
  );
  return invitationAcceptReceiptSchema.parse(data);
}
