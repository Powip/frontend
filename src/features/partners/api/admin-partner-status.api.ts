import axios from "axios";
import z from "zod";
import { API } from "@/lib/api";
import {
  type AdminPartnerStatusCommand,
  type AdminPartnerStatusOperation,
  adminPartnerStatusCommandSchema,
  adminPartnerStatusOperationSchema,
  adminPartnerStatusResultSchema,
} from "../schemas/admin-partner-status.schema";
import type { AdminReadRequest } from "./admin-partners.api";

export const adminPartnerStatusClient = axios.create({ timeout: 10_000 });
type StatusRequest = AdminReadRequest & {
  partnerId: string;
  operation: AdminPartnerStatusOperation;
  command: AdminPartnerStatusCommand;
  idempotencyKey: string;
};

export async function requestAdminPartnerStatus(request: StatusRequest) {
  const partnerId = z
    .uuid()
    .refine((value) => value === value.toLowerCase())
    .parse(request.partnerId);
  const operation = adminPartnerStatusOperationSchema.parse(request.operation);
  const command = adminPartnerStatusCommandSchema.parse(request.command);
  const key = z
    .string()
    .regex(/^[A-Za-z0-9._:-]{8,200}$/)
    .parse(request.idempotencyKey);
  const { data } = await adminPartnerStatusClient.post<unknown>(
    `${API.partners}/admin/partners/${partnerId}/${operation}`,
    command,
    {
      signal: request.signal,
      headers: { Authorization: `Bearer ${request.accessToken}`, "Idempotency-Key": key },
    },
  );
  return adminPartnerStatusResultSchema
    .refine(
      (result) =>
        result.id === partnerId &&
        result.status === (operation === "suspend" ? "SUSPENDED" : "ACTIVE") &&
        result.version === command.expectedVersion + 1,
      "La confirmación no coincide con la operación solicitada.",
    )
    .parse(data);
}
