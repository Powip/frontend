"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { listWarehouses } from "@/services/warehousesService";

/**
 * Almacenes de la empresa (`GET /warehouses` de la fachada, JWT). Comparte la caché `company-warehouses` con
 * Stock y Recepciones. FEAT-24 H10: los reportes son de la empresa y filtran por uno de estos almacenes.
 */
export function useCompanyWarehouses() {
  const { auth } = useAuth();
  const companyId = auth?.company?.id ?? "";
  const query = useQuery({
    queryKey: ["company-warehouses", companyId],
    queryFn: () => listWarehouses(),
    enabled: Boolean(companyId && auth?.accessToken),
    retry: false,
    staleTime: 60_000,
  });
  const warehouses = useMemo(() => query.data?.warehouses ?? [], [query.data]);
  const nameOf = useMemo(() => {
    const names = new Map(warehouses.map((warehouse) => [warehouse.id, warehouse.name]));
    return (id: string) => names.get(id) ?? "su almacén";
  }, [warehouses]);
  return { warehouses, nameOf, isLoading: query.isPending && query.fetchStatus !== "idle", error: query.error };
}
