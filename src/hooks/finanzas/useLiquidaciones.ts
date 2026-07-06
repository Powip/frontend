import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import * as courierApi from "@/api/Courier";

function useToken(): string | undefined {
  const { auth } = useAuth();
  return auth?.accessToken;
}

// ---- Top metrics (combines 3 endpoints) ----

export function useEnAgencia(storeId: string | null) {
  const token = useToken();
  return useQuery({
    queryKey: ["finanzas", "en-agencia", storeId],
    queryFn: () => courierApi.getEnAgencia(storeId!, token),
    enabled: !!storeId,
  });
}

export function useReassigned(storeId: string | null) {
  const token = useToken();
  return useQuery({
    queryKey: ["finanzas", "reassigned", storeId],
    queryFn: () => courierApi.getReassigned(storeId!, token),
    enabled: !!storeId,
  });
}

export function useTopMetrics(storeId: string | null) {
  const token = useToken();
  return useQuery({
    queryKey: ["finanzas", "top-metrics", storeId],
    queryFn: () => courierApi.getTopMetrics(storeId!, token),
    enabled: !!storeId,
  });
}

// ---- Courier performance cards ----

export function useCourierPerformance(storeId: string | null) {
  const token = useToken();
  return useQuery({
    queryKey: ["finanzas", "courier-performance", storeId],
    queryFn: () => courierApi.getCourierPerformance(storeId!, token),
    enabled: !!storeId,
  });
}

// ---- Guides table ----

export function useLiquidationsTable(storeId: string | null) {
  const token = useToken();
  return useQuery({
    queryKey: ["finanzas", "table", storeId],
    queryFn: () => courierApi.getLiquidationsTable(storeId!, token),
    enabled: !!storeId,
  });
}

// ---- Single liquidation details ----

export function useLiquidationDetails(liquidationId: string | null) {
  const token = useToken();
  return useQuery({
    queryKey: ["finanzas", "liquidation", liquidationId],
    queryFn: () => courierApi.getLiquidationDetails(liquidationId!, token),
    enabled: !!liquidationId,
  });
}

// ---- Mutations ----

export function useCreateLiquidation(storeId: string) {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: courierApi.CreateLiquidationPayload) =>
      courierApi.createLiquidation(storeId, payload, token),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["finanzas", "table", storeId] });
      qc.invalidateQueries({ queryKey: ["finanzas", "top-metrics", storeId] });
    },
  });
}

export function useCreateLiquidationPayment(storeId: string, liquidationId: string) {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: courierApi.CreatePaymentPayload) =>
      courierApi.createLiquidationPayment(liquidationId, payload, token),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["finanzas", "table", storeId] });
      qc.invalidateQueries({ queryKey: ["finanzas", "top-metrics", storeId] });
      qc.invalidateQueries({ queryKey: ["finanzas", "liquidation", liquidationId] });
    },
  });
}

export function useCreateFreightPayment(storeId: string, liquidationId: string) {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: courierApi.CreatePaymentPayload) =>
      courierApi.createFreightPayment(liquidationId, payload, token),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["finanzas", "table", storeId] });
      qc.invalidateQueries({ queryKey: ["finanzas", "top-metrics", storeId] });
      qc.invalidateQueries({ queryKey: ["finanzas", "liquidation", liquidationId] });
    },
  });
}

export function useUpdateLiquidation(storeId: string, liquidationId: string) {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: courierApi.UpdateLiquidationPayload) =>
      courierApi.updateLiquidation(storeId, liquidationId, payload, token),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["finanzas", "table", storeId] });
      qc.invalidateQueries({ queryKey: ["finanzas", "top-metrics", storeId] });
      qc.invalidateQueries({ queryKey: ["finanzas", "liquidation", liquidationId] });
    },
  });
}

export function useMarkOverdue(storeId: string) {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => courierApi.markOverdue(storeId, token),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["finanzas", "table", storeId] });
      qc.invalidateQueries({ queryKey: ["finanzas", "top-metrics", storeId] });
    },
  });
}
