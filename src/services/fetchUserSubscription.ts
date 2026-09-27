import axios from "axios";
import { GATEWAY } from "@/lib/gateway";

export interface UserSubscription {
  id: string;
  status: string;
  plan: {
    id: string;
    name: string;
  };
}

type RawSubscription = { id: string; status: string; plan: { id: string; name: string } };

const PRIORITY = ["ACTIVE", "PENDING_RENEWAL", "PENDING_PAYMENT"];

const toUserSubscription = (sub: RawSubscription): UserSubscription => ({
  id: sub.id,
  status: sub.status,
  plan: { id: sub.plan.id, name: sub.plan.name },
});

/**
 * Suscripción vigente del usuario.
 *
 * Fuente principal: GET /subscription/subscriptions/me (gateway → ms-subscription,
 * FEAT-11), que ya aplica la regla ACTIVE > PENDING_RENEWAL > PENDING_PAYMENT.
 * Si ese endpoint todavía no existe (ms-subscription sin deployar) cae a la lista
 * por usuario de siempre, eligiendo con la misma regla en vez de tomar la [0].
 *
 * null = sin suscripción (normal para personal operativo, que usa la de su empresa).
 */
export const fetchUserSubscription = async (
  userId: string,
  token: string,
): Promise<UserSubscription | null> => {
  const headers = { Authorization: `Bearer ${token}` };
  try {
    const { data } = await axios.get<RawSubscription | null>(`${GATEWAY.subscription}/subscriptions/me`, { headers });
    return data ? toUserSubscription(data) : null;
  } catch {
    // Fallback a la API previa a FEAT-11.
  }

  try {
    const { data } = await axios.get<RawSubscription[]>(
      `${process.env.NEXT_PUBLIC_API_SUBS}/subscriptions/user/${userId}`,
      { headers },
    );
    if (!Array.isArray(data) || data.length === 0) return null;
    const ranked = [...data].sort((a, b) => {
      const ra = PRIORITY.indexOf(a.status);
      const rb = PRIORITY.indexOf(b.status);
      return (ra === -1 ? PRIORITY.length : ra) - (rb === -1 ? PRIORITY.length : rb);
    });
    return toUserSubscription(ranked[0]);
  } catch {
    return null;
  }
};
