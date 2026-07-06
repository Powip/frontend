import { useQuery } from "@tanstack/react-query";
import axiosAuth from "@/lib/axiosAuth";

export const useConversionFunnel = (from?: string, to?: string) => {
  return useQuery({
    queryKey: ["conversion-funnel", from, to],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (from) params.append("from", from);
      if (to) params.append("to", to);

      const url = `/api/superadmin/conversion-funnel${params.toString() ? '?' + params.toString() : ''}`;
      const response = await axiosAuth.get(url);
      return response.data;
    },
    enabled: true,
  });
};
