import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";

export const useSaasMetrics = (token?: string) => {
  return useQuery({
    queryKey: ["saas-metrics"],
    queryFn: async () => {
      const config = token ? { headers: { Authorization: `Bearer ${token}` } } : {};
      const response = await axios.get("/api/superadmin/saas-metrics", config);
      return response.data;
    },
    enabled: !!token,
  });
};

export const useChurnAlerts = (token?: string) => {
  return useQuery({
    queryKey: ["churn-alerts"],
    queryFn: async () => {
      const config = token ? { headers: { Authorization: `Bearer ${token}` } } : {};
      const response = await axios.get("/api/superadmin/churn-alerts", config);
      return response.data;
    },
    enabled: !!token,
  });
};
