import axios from "axios";
import axiosAuth from "@/lib/axiosAuth";
import { GATEWAY } from "@/lib/gateway";

const API_SUBS = GATEWAY.subscriptionFlow;

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
  initPoint?: string;
}

export const getExpiringSubscriptionsAlert = async (
  days: number = 7,
): Promise<SubscriptionDetail[]> => {
  const response = await axiosAuth.get(
    `${API_SUBS}/api/v1/subscriptions/expiring-soon`,
    {
      params: { days },
    },
  );
  return response.data;
};

export const getSubscriptionUser = async (): Promise<SubscriptionDetail[]> => {
  try {
    const response = await axiosAuth.get(`${API_SUBS}/api/v1/subscriptions/me`);
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

export const getAllPlans = async (): Promise<Plan[]> => {
  const response = await axiosAuth.get(`${API_SUBS}/api/v1/plans`);
  return response.data;
};

export const updateSubscription = async (
  subscriptionId: string,
  data: { planId?: string; status?: string; autoRenewal?: boolean },
): Promise<SubscriptionDetail> => {
  const response = await axiosAuth.put(
    `${API_SUBS}/api/v1/subscriptions/${subscriptionId}`,
    data,
  );
  return response.data;
};

export const cancelSubscription = async (
  subscriptionId: string,
): Promise<void> => {
  await axiosAuth.delete(`${API_SUBS}/api/v1/subscriptions/${subscriptionId}`);
};

export const createSubscription = async (data: {
  userId: string;
  planId: string;
  payerEmail: string;
  status?: string;
}): Promise<SubscriptionDetail> => {
  const response = await axiosAuth.post(
    `${API_SUBS}/api/v1/subscriptions`,
    data,
  );
  return response.data;
};
