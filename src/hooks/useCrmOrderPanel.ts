"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { crmKeys } from "@/lib/crmSse";
import { crmError } from "@/services/crmService";
import {
  cancelCod,
  confirmCod,
  decideDiscount,
  getCodOrder,
  getPromos,
  getStorePolicy,
  listDiscountRequests,
  listFinanceQueue,
  listReceipts,
  requestDiscount,
  rescheduleCod,
  reviewReceipt,
  saveStorePolicy,
  simulatePayment,
  updateCodDni,
  uploadReceipt,
} from "@/services/crmOrderPanelService";
import type {
  CancelReason,
  ReceiptStatus,
  SavePolicyInput,
  SimulatePaymentInput,
  UploadReceiptInput,
} from "@/types/crmOrderPanel";

export const orderPanelKeys = {
  all: ["crm", "order-panel"] as const,
  policy: (storeId: string) => ["crm", "order-panel", "policy", storeId] as const,
  promos: (storeId: string) => ["crm", "order-panel", "promos", storeId] as const,
  receipts: (conversationId: string) => ["crm", "order-panel", "receipts", conversationId] as const,
  queue: (status: ReceiptStatus) => ["crm", "order-panel", "queue", status] as const,
  discounts: (conversationId: string) => ["crm", "order-panel", "discounts", conversationId] as const,
  cod: (conversationId: string, orderId: string) => ["crm", "order-panel", "cod", conversationId, orderId] as const,
};

const onError = (err: unknown) => toast.error(crmError(err).message);

export function useStorePolicy(storeId: string | null | undefined, enabled = true) {
  const key = storeId ?? "";
  return useQuery({
    queryKey: orderPanelKeys.policy(key),
    queryFn: () => getStorePolicy(key),
    enabled,
    retry: false,
    staleTime: 60_000,
  });
}

export function useSavePolicy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SavePolicyInput) => saveStorePolicy(input),
    onSuccess: (p) => {
      qc.setQueryData(orderPanelKeys.policy(p.storeId), p);
      qc.invalidateQueries({ queryKey: [...orderPanelKeys.all, "policy"] });
      qc.invalidateQueries({ queryKey: [...orderPanelKeys.all, "promos"] });
      toast.success("Política de pagos guardada");
    },
    onError,
  });
}

export function usePromos(storeId: string | null | undefined, enabled = true) {
  const key = storeId ?? "";
  return useQuery({
    queryKey: orderPanelKeys.promos(key),
    queryFn: () => getPromos(key),
    enabled,
    retry: false,
    staleTime: 60_000,
  });
}

export function useConversationDiscounts(conversationId: string) {
  return useQuery({
    queryKey: orderPanelKeys.discounts(conversationId),
    queryFn: () => listDiscountRequests(conversationId),
    retry: false,
  });
}

export function usePendingDiscounts(enabled: boolean) {
  return useQuery({
    queryKey: orderPanelKeys.discounts("pending"),
    queryFn: () => listDiscountRequests(),
    enabled,
    retry: false,
  });
}

export function useDiscountMutations(conversationId?: string) {
  const qc = useQueryClient();
  const refresh = (cid?: string) => {
    qc.invalidateQueries({ queryKey: [...orderPanelKeys.all, "discounts"] });
    if (cid) qc.invalidateQueries({ queryKey: crmKeys.messages(cid) });
  };
  return {
    request: useMutation({
      mutationFn: (input: { percent: number; storeId?: string; reason?: string }) =>
        requestDiscount(conversationId ?? "", input),
      onSuccess: () => refresh(conversationId),
      onError,
    }),
    decide: useMutation({
      mutationFn: ({ id, approve }: { id: string; approve: boolean }) => decideDiscount(id, approve),
      onSuccess: (d, v) => {
        refresh(d.conversationId);
        toast.success(v.approve ? "Descuento autorizado" : "Descuento rechazado");
      },
      onError,
    }),
  };
}

export function useReceipts(conversationId: string) {
  return useQuery({
    queryKey: orderPanelKeys.receipts(conversationId),
    queryFn: () => listReceipts(conversationId),
    retry: false,
  });
}

export function useFinanceQueue(enabled: boolean, status: ReceiptStatus = "porval") {
  return useQuery({
    queryKey: orderPanelKeys.queue(status),
    queryFn: () => listFinanceQueue(status),
    enabled,
    retry: false,
  });
}

export function useReceiptMutations(conversationId?: string) {
  const qc = useQueryClient();
  const refresh = (cid?: string | null) => {
    qc.invalidateQueries({ queryKey: [...orderPanelKeys.all, "receipts"] });
    qc.invalidateQueries({ queryKey: [...orderPanelKeys.all, "queue"] });
    if (cid) qc.invalidateQueries({ queryKey: crmKeys.messages(cid) });
  };
  return {
    upload: useMutation({
      mutationFn: (input: UploadReceiptInput) => uploadReceipt(conversationId ?? "", input),
      onSuccess: (r) => {
        refresh(r.conversationId);
        if (r.coreError) toast.error(`Quedó por validar en el CRM: ${r.coreError}`);
        else toast.success("Comprobante enviado a Finanzas");
      },
      onError,
    }),
    simulate: useMutation({
      mutationFn: (input: SimulatePaymentInput) => simulatePayment(conversationId ?? "", input),
      onSuccess: (r) => {
        refresh(r.conversationId);
        toast.success("Pago simulado registrado");
      },
      onError,
    }),
    review: useMutation({
      mutationFn: ({ id, approve, note }: { id: string; approve: boolean; note?: string }) =>
        reviewReceipt(id, approve, note),
      onSuccess: (r, v) => {
        refresh(r.conversationId);
        if (r.orderId) qc.invalidateQueries({ queryKey: ["crm", "core-order", r.orderId] });
        toast.success(v.approve ? "Pago aprobado" : "Comprobante rechazado");
      },
      onError,
    }),
  };
}

export function useCodOrder(conversationId: string, orderId: string, enabled = true) {
  return useQuery({
    queryKey: orderPanelKeys.cod(conversationId, orderId),
    queryFn: () => getCodOrder(conversationId, orderId),
    enabled,
    retry: false,
  });
}

export function useCodMutations(conversationId: string, orderId: string) {
  const qc = useQueryClient();
  const done = (message: string) => (order: unknown) => {
    qc.setQueryData(orderPanelKeys.cod(conversationId, orderId), order);
    qc.invalidateQueries({ queryKey: crmKeys.messages(conversationId) });
    qc.invalidateQueries({ queryKey: ["crm", "core-order", orderId] });
    toast.success(message);
  };
  return {
    confirm: useMutation({
      mutationFn: (dni?: string) => confirmCod(conversationId, orderId, dni),
      onSuccess: done("Venta confirmada: pasa a Ventas"),
      // DNI_REQUIRED lo maneja la tarjeta (pide el DNI); el resto, aviso.
      onError: (err: unknown) => {
        if (crmError(err).code !== "DNI_REQUIRED") onError(err);
      },
    }),
    cancel: useMutation({
      mutationFn: ({ reason, detail }: { reason: CancelReason; detail?: string }) =>
        cancelCod(conversationId, orderId, reason, detail),
      onSuccess: done("Pedido anulado en Gestión CC"),
      onError,
    }),
    reschedule: useMutation({
      mutationFn: (comment?: string) => rescheduleCod(conversationId, orderId, comment),
      onSuccess: done("Entrega reprogramada"),
      onError,
    }),
    dni: useMutation({
      mutationFn: (dni: string) => updateCodDni(conversationId, orderId, dni),
      onSuccess: done("DNI guardado"),
      onError,
    }),
  };
}
