import axios from "axios";
import { API } from "@/lib/api";
import {
  type PayoutSettingsCommand,
  payoutSettingsCommandSchema,
  payoutSettingsResponseSchema,
} from "../schemas/update-payout-settings.schema";

export const payoutSettingsClient = axios.create({ timeout: 10_000 });
export type PayoutSettingsWriteRequest = {
  accessToken: string;
  signal?: AbortSignal;
  command: PayoutSettingsCommand;
  idempotencyKey: string;
};
const endpoint = () => `${API.partners}/me/payout-settings`;

export async function requestPayoutSettings(accessToken: string, signal?: AbortSignal) {
  if (!accessToken) throw new Error("A current session is required");
  const { data } = await payoutSettingsClient.get<unknown>(endpoint(), {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal,
  });
  return payoutSettingsResponseSchema.parse(data).settings;
}

export async function requestUpdatePayoutSettings(request: PayoutSettingsWriteRequest) {
  if (!request.accessToken || !/^[A-Za-z0-9._:-]{8,200}$/.test(request.idempotencyKey))
    throw new Error("A current session and retry key are required");
  const { data } = await payoutSettingsClient.post<unknown>(
    endpoint(),
    payoutSettingsCommandSchema.parse(request.command),
    {
      headers: {
        Authorization: `Bearer ${request.accessToken}`,
        "Idempotency-Key": request.idempotencyKey,
      },
      signal: request.signal,
    },
  );
  const settings = payoutSettingsResponseSchema.parse(data).settings;
  if (!settings) throw new Error("Invalid saved payout settings response");
  return settings;
}
