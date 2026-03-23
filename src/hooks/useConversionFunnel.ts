import { useQuery } from "@tanstack/react-query";
import axios from "axios";

export const useConversionFunnel = (token?: string) => {
  return useQuery({
    queryKey: ["conversion-funnel"],
    queryFn: async () => {
      const config = token ? { headers: { Authorization: `Bearer ${token}` } } : {};
      const response = await axios.get("/api/superadmin/conversion-funnel", config);
      return response.data;
    },
    enabled: !!token,
  });
};
