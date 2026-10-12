import axios from "axios";
import z from "zod";
import { API } from "@/lib/api";
import {
  type ReferralRejectionCommand,
  referralRejectionCommandSchema,
  referralRejectionResultSchema,
} from "../schemas/referral-rejection.schema";
import type { AdminReadRequest } from "./admin-partners.api";

export const referralRejectionClient = axios.create({ timeout: 10_000 });
export async function requestReferralRejection(
  request: AdminReadRequest & {
    referralId: string;
    command: ReferralRejectionCommand;
    idempotencyKey: string;
  },
) {
  const referralId = z
    .uuid()
    .refine((value) => value === value.toLowerCase())
    .parse(request.referralId);
  const command = referralRejectionCommandSchema.parse(request.command);
  const key = z
    .string()
    .regex(/^[A-Za-z0-9._:-]{8,200}$/)
    .parse(request.idempotencyKey);
  const { data } = await referralRejectionClient.post<unknown>(
    `${API.partners}/admin/review-queue/${referralId}/reject`,
    command,
    {
      signal: request.signal,
      headers: { Authorization: `Bearer ${request.accessToken}`, "Idempotency-Key": key },
    },
  );
  return referralRejectionResultSchema
    .refine(
      (result) => result.id === referralId && result.version === command.expectedVersion + 1,
      "La confirmación no coincide con el rechazo solicitado.",
    )
    .parse(data);
}
