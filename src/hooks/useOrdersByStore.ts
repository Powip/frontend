import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import axiosAuth from "@/lib/axiosAuth";
import { useAuth } from "@/contexts/AuthContext";
import type { OrderHeader } from "@/interfaces/IOrder";

export function useOrdersByStore(storeId: string | null | undefined) {
  const { auth } = useAuth();
  const companyId = auth?.company?.id;
  const userId = auth?.user?.id;
  const queryClient = useQueryClient();
  useEffect(() => {
    const changed = (event: Event) => {
      const detail = (event as CustomEvent<{ companyId: string }>).detail;
      if (detail?.companyId === companyId)
        void queryClient.invalidateQueries({ queryKey: ["orders"] });
    };
    window.addEventListener("commercial-leads:changed", changed);
    return () =>
      window.removeEventListener("commercial-leads:changed", changed);
  }, [companyId, queryClient]);
  return useQuery({
    queryKey: ["orders", "store", companyId, userId, storeId],
    queryFn: async () => {
      const res = await axiosAuth.get<OrderHeader[]>(
        `${process.env.NEXT_PUBLIC_API_VENTAS}/order-header/store/${storeId}`,
      );
      return res.data;
    },
    enabled: !!storeId && !!companyId && !!userId,
  });
}
