import axios from "axios";

export const fetchUserSubscription = async (userId: string, token: string) => {
  try {
    const response = await axios.get(
      `${process.env.NEXT_PUBLIC_API_SUBS}/subscriptions/user/${userId}`
    );

    const subscriptions = response.data;

    // Si no tiene ninguna suscripción
    if (!Array.isArray(subscriptions) || subscriptions.length === 0) {
      return null;
    }

    const sub = subscriptions[0]; // tomamos la activa o la más reciente

    return {
      id: sub.id,
      status: sub.status,
      plan: {
        id: sub.plan.id,
        name: sub.plan.name,
      },
    };
  } catch (error) {
    console.error("Error obteniendo suscripción:", error);
    return null;
  }
};
