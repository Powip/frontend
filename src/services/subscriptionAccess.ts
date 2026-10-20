import axios from "axios";
import { GATEWAY } from "@/lib/gateway";
import type { AccessState, SubscriptionAccess } from "@/types/subscriptionAccess";

export const ACCESS_TIMEOUT_MS = 5000;

const STATES: readonly AccessState[] = ["OK", "AVISO", "BLOQUEADO"];
const isDateOrNull = (value: unknown) => value === null || typeof value === "string";

function toAccess(data: unknown): SubscriptionAccess | null {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const record = data as Record<string, unknown>;
  if (
    !STATES.includes(record.state as AccessState) ||
    !isDateOrNull(record.deadline) ||
    !isDateOrNull(record.firstChargeDate) ||
    typeof record.owner !== "boolean"
  )
    return null;
  return {
    state: record.state as AccessState,
    deadline: record.deadline as string | null,
    firstChargeDate: record.firstChargeDate as string | null,
    owner: record.owner,
  };
}

/**
 * Estado de acceso de la empresa del usuario (FEAT-25). null ante cualquier error, timeout o
 * respuesta rara: quien lo usa lo toma como OK, porque nunca se bloquea por infraestructura.
 */
export async function fetchSubscriptionAccess(token: string): Promise<SubscriptionAccess | null> {
  try {
    const { data } = await axios.get<unknown>(`${GATEWAY.subscription}/subscriptions/access`, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: ACCESS_TIMEOUT_MS,
    });
    return toAccess(data);
  } catch {
    return null;
  }
}
