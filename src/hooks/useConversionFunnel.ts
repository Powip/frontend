import { useQuery } from "@tanstack/react-query";
import axios from "axios";

export const useConversionFunnel = (token?: string, from?: string, to?: string) => {
  return useQuery({
    queryKey: ["conversion-funnel", from, to],
    queryFn: async () => {
      const config = token ? { headers: { Authorization: `Bearer ${token}` } } : {};
      const params = new URLSearchParams();
      if (from) params.append("from", from);
      if (to) params.append("to", to);
      
      const url = `/api/superadmin/conversion-funnel${params.toString() ? '?' + params.toString() : ''}`;
      const response = await axios.get(url, config);
      return response.data;
    },
    enabled: !!token,
  });
};
