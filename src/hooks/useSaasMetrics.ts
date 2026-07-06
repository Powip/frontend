import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axiosAuth from "@/lib/axiosAuth";

export const useSaasMetrics = (from?: string, to?: string) => {
  return useQuery({
    queryKey: ["saas-metrics", from, to],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (from) params.append("from", from);
      if (to) params.append("to", to);

      const url = `/api/superadmin/saas-metrics${params.toString() ? '?' + params.toString() : ''}`;
      const response = await axiosAuth.get(url);
      return response.data;
    },
    enabled: true,
  });
};

export const useChurnAlerts = () => {
  return useQuery({
    queryKey: ["churn-alerts"],
    queryFn: async () => {
      const response = await axiosAuth.get("/api/superadmin/churn-alerts");
      return response.data;
    },
    enabled: true,
  });
};
