import axios from "axios";
import { API } from "@/lib/api";
import type { ProgramPreferencesCommand } from "../models/program-preferences";
import {
  programPreferencesCommandSchema,
  programPreferencesResponseSchema,
} from "../schemas/program-preferences.schema";

export const programPreferencesClient = axios.create({ timeout: 10_000 });

export interface ProgramPreferencesReadRequest {
  accessToken: string;
  signal?: AbortSignal;
}

export interface ProgramPreferencesWriteRequest extends ProgramPreferencesReadRequest {
  command: ProgramPreferencesCommand;
  idempotencyKey: string;
}

const endpoint = () => `${API.partners}/me/program-preferences`;

function requireCurrentSession(accessToken: string) {
  if (!accessToken || accessToken.trim() !== accessToken) {
    throw new Error("A current session is required");
  }
}

function canonicalDecimal(value: string) {
  return value.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
}

export async function requestProgramPreferences(request: ProgramPreferencesReadRequest) {
  requireCurrentSession(request.accessToken);
  const { data } = await programPreferencesClient.get<unknown>(endpoint(), {
    headers: { Authorization: `Bearer ${request.accessToken}` },
    signal: request.signal,
  });
  return programPreferencesResponseSchema.parse(data);
}

export async function requestUpdateProgramPreferences(request: ProgramPreferencesWriteRequest) {
  requireCurrentSession(request.accessToken);
  if (!/^[A-Za-z0-9._:-]{8,200}$/.test(request.idempotencyKey)) {
    throw new Error("A stable retry key is required");
  }
  const command = programPreferencesCommandSchema.parse(request.command);
  if (command.expectedVersion === Number.MAX_SAFE_INTEGER) {
    throw new Error("The program preferences version cannot be advanced");
  }
  const { data } = await programPreferencesClient.post<unknown>(endpoint(), command, {
    headers: {
      Authorization: `Bearer ${request.accessToken}`,
      "Idempotency-Key": request.idempotencyKey,
    },
    signal: request.signal,
  });
  const response = programPreferencesResponseSchema.parse(data);
  const expectedVersion = command.expectedVersion === null ? 0 : command.expectedVersion + 1;
  if (
    !response.settings ||
    response.settings.optionCode !== command.optionCode ||
    canonicalDecimal(response.settings.discountPct) !== canonicalDecimal(command.discountPct) ||
    response.settings.version !== expectedVersion
  ) {
    throw new Error("The saved program preferences do not match the requested operation");
  }
  return response;
}
