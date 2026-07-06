import axios from "axios";
import axiosAuth from "@/lib/axiosAuth";
import { GATEWAY } from "@/lib/gateway";

export const fetchUserSubscription = async (): Promise<boolean | null> => {
  const url = `${GATEWAY.subscriptionFlow}/api/v1/subscriptions/me`;

  try {
    const { data } = await axiosAuth.get(url);

    return data.status === "ACTIVE";
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 404 || error.response?.status === 403) {
        return null;
      }
    }

    throw error;
  }
};