import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";

export const useSaasMetrics = (token?: string, from?: string, to?: string) => {
  return useQuery({
    queryKey: ["saas-metrics", from, to],
    queryFn: async () => {
      const config = token ? { headers: { Authorization: `Bearer ${token}` } } : {};
      const params = new URLSearchParams();
      if (from) params.append("from", from);
      if (to) params.append("to", to);
      
      const url = `/api/superadmin/saas-metrics${params.toString() ? '?' + params.toString() : ''}`;
      const response = await axios.get(url, config);
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
