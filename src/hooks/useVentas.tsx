import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as ventasApi from "@/src/api/Ventas";
import { 
  ICreateOrderHeader, 
  ICreateOrderHeaderPlusItems, 
  ICreateOrderItemsDto, 
  IUpdateOrderHeaderDto, 
  ICreatePaymentDto, 
  IUpdatePaymentDto 
} from "@/src/api/Interfaces";

// ========== QUERIES ==========

// Obtener todas las órdenes (cabeceras)
export const useOrders = () => {
  return useQuery({
    queryKey: ["orders"],
    queryFn: ventasApi.getOrders,
  });
};

// Obtener detalles de una orden por ID (cabecera + items)
export const useOrderById = (orderId?: string) => {
  return useQuery({
    queryKey: ["order", orderId],
    queryFn: () => ventasApi.getOrderById(orderId!),
    enabled: !!orderId,
  });
};

// Obtener pagos totales de la API
export const usePayments = () => {
  return useQuery({
    queryKey: ["payments"],
    queryFn: ventasApi.getPayments,
  });
};

// Obtener un pago por ID
export const usePaymentById = (paymentId?: string) => {
  return useQuery({
    queryKey: ["payment", paymentId],
    queryFn: () => ventasApi.getPaymentById(paymentId!),
    enabled: !!paymentId,
  });
};

// Obtener pagos asociados a una orden
export const usePaymentsByOrder = (orderId?: string) => {
  return useQuery({
    queryKey: ["payments", "order", orderId],
    queryFn: () => ventasApi.getPaymentsByOrder(orderId!),
    enabled: !!orderId,
  });
};

// Obtener historial de log-ventas de una orden
export const useLogVentas = (orderId?: string) => {
  return useQuery({
    queryKey: ["logVentas", orderId],
    queryFn: () => ventasApi.getLogVentas(orderId!),
    enabled: !!orderId,
  });
};

// ========== MUTATIONS ==========

export const useCreateOrderHeader = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["createOrderHeader"],
    mutationFn: (payload: ICreateOrderHeader) =>
      ventasApi.createOrderHeader(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
  });
};

export const useCreateOrderWithItems = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["createOrderWithItems"],
    mutationFn: (payload: ICreateOrderHeaderPlusItems) =>
      ventasApi.createOrderWithItems(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
  });
};

export const useUpdateOrderHeader = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["updateOrderHeader"],
    mutationFn: ({ orderId, payload }: { orderId: string; payload: IUpdateOrderHeaderDto }) =>
      ventasApi.updateOrderHeader(orderId, payload),
    onSuccess: (_, { orderId }) => {
      queryClient.invalidateQueries({ queryKey: ["order", orderId] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
  });
};

export const useDeleteOrderHeader = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["deleteOrderHeader"],
    mutationFn: (orderId: string) => ventasApi.deleteOrderHeader(orderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
  });
};

export const useRecalculateOrder = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["recalculateOrder"],
    mutationFn: (orderId: string) => ventasApi.recalculateOrder(orderId),
    onSuccess: (_, orderId) => {
      queryClient.invalidateQueries({ queryKey: ["order", orderId] });
    },
  });
};

// Ítems dentro de orden

export const useAddOrderItem = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["addOrderItem"],
    mutationFn: ({ orderId, item }: { orderId: string; item: ICreateOrderItemsDto }) =>
      ventasApi.addOrderItem(orderId, item),
    onSuccess: (_, { orderId }) => {
      queryClient.invalidateQueries({ queryKey: ["order", orderId] });
    },
  });
};

export const useDeleteOrderItem = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["deleteOrderItem"],
    mutationFn: ({ orderId, itemId }: { orderId: string; itemId: string }) =>
      ventasApi.deleteOrderItem(orderId, itemId),
    onSuccess: (_, { orderId }) => {
      queryClient.invalidateQueries({ queryKey: ["order", orderId] });
    },
  });
};

// Pagos

export const useCreatePayment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["createPayment"],
    mutationFn: (payload: ICreatePaymentDto) =>
      ventasApi.createPayment(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payments"] });
    },
  });
};

export const useUpdatePayment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["updatePayment"],
    mutationFn: ({ paymentId, payload }: { paymentId: string; payload: IUpdatePaymentDto }) =>
      ventasApi.updatePayment(paymentId, payload),
    onSuccess: (_, { paymentId }) => {
      queryClient.invalidateQueries({ queryKey: ["payment", paymentId] });
      queryClient.invalidateQueries({ queryKey: ["payments"] });
    },
  });
};

export const useDeletePayment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["deletePayment"],
    mutationFn: (paymentId: string) => ventasApi.deletePayment(paymentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payments"] });
    },
  });
};

export const useCreatePaymentForOrder = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["createPaymentForOrder"],
    mutationFn: ({ orderId, payload }: { orderId: string; payload: ICreatePaymentDto }) =>
      ventasApi.createPaymentForOrder(orderId, payload),
    onSuccess: (_, { orderId }) => {
      queryClient.invalidateQueries({ queryKey: ["payments", "order", orderId] });
    },
  });
};

export const useUpdatePaymentForOrder = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["updatePaymentForOrder"],
    mutationFn: ({
      orderId,
      paymentId,
      payload,
    }: {
      orderId: string;
      paymentId: string;
      payload: IUpdatePaymentDto;
    }) => ventasApi.updatePaymentForOrder(orderId, paymentId, payload),
    onSuccess: (_, { orderId }) => {
      queryClient.invalidateQueries({ queryKey: ["payments", "order", orderId] });
    },
  });
};

export const useDeletePaymentForOrder = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["deletePaymentForOrder"],
    mutationFn: ({
      orderId,
      paymentId,
    }: {
      orderId: string;
      paymentId: string;
    }) => ventasApi.deletePaymentForOrder(orderId, paymentId),
    onSuccess: (_, { orderId }) => {
      queryClient.invalidateQueries({ queryKey: ["payments", "order", orderId] });
    },
  });
};

export const useRevertPayment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["revertPayment"],
    mutationFn: (paymentId: string) => ventasApi.revertPayment(paymentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payments"] });
    },
  });
};
