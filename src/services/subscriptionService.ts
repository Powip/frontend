import axios from "axios";

const API_SUBS =
  process.env.NEXT_PUBLIC_API_SUBS || "http://localhost:8081/api/v1";

export interface SubscriptionDetail {
  id: string;
  userId: string;
  plan: {
    id: string;
    name: string;
    description: string;
    price: number;
    durationInDays: number;
  };
  startDate: string;
  endDate: string;
  status: string;
  autoRenewal: boolean;
}

export const getExpiringSubscriptionsAlert = async (
  accessToken: string,
  days: number = 7,
): Promise<SubscriptionDetail[]> => {
  const response = await axios.get(`${API_SUBS}/subscriptions/expiring-soon`, {
    params: { days },
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  return response.data;
};

export const getSubscriptionByUserId = async (
  accessToken: string,
  userId: string,
): Promise<SubscriptionDetail[]> => {
  try {
    const response = await axios.get(
      `${API_SUBS}/subscriptions/user/${userId}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      return [];
    }
    throw error;
  }
};
export interface Plan {
  id: string;
  name: string;
  description: string;
  price: number;
  durationInDays: number;
}

export const getAllPlans = async (accessToken: string): Promise<Plan[]> => {
  const response = await axios.get(`${API_SUBS}/plans`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  return response.data;
};

export const updateSubscription = async (
  accessToken: string,
  subscriptionId: string,
  data: { planId?: string; status?: string; autoRenewal?: boolean },
): Promise<SubscriptionDetail> => {
  const response = await axios.put(
    `${API_SUBS}/subscriptions/${subscriptionId}`,
    data,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );
  return response.data;
};

export const cancelSubscription = async (
  accessToken: string,
  subscriptionId: string,
): Promise<void> => {
  await axios.delete(`${API_SUBS}/subscriptions/${subscriptionId}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
};

export const createSubscription = async (
  accessToken: string,
  data: { userId: string; planId: string },
): Promise<SubscriptionDetail> => {
  const response = await axios.post(`${API_SUBS}/subscriptions`, data, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  return response.data;
};
