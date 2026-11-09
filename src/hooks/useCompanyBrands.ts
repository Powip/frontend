"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import axiosAuth from "@/lib/axiosAuth";
import { GATEWAY } from "@/lib/gateway";

export interface CompanyBrand {
  id: string;
  name: string;
}

const brandsApi = () => `${process.env.NEXT_PUBLIC_API_PRODUCTOS || GATEWAY.products}/brands`;

/** FEAT-24 H0 — marcas de la empresa del token (ms-products filtra por empresa). */
export function useCompanyBrands() {
  const { auth } = useAuth();
  const companyId = auth?.company?.id;
  const queryClient = useQueryClient();
  const queryKey = ["company-brands", companyId];
  const query = useQuery({
    queryKey,
    queryFn: async () => (await axiosAuth.get<CompanyBrand[]>(brandsApi())).data,
    enabled: Boolean(companyId && auth?.accessToken),
    staleTime: 60 * 1000,
  });
  const create = useMutation({
    mutationFn: async (name: string) => (await axiosAuth.post<CompanyBrand>(brandsApi(), { name })).data,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey }),
  });
  return {
    brands: query.data ?? [],
    isLoading: query.isPending,
    createBrand: (name: string) => create.mutateAsync(name),
  };
}
