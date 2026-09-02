"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Package, Truck, AlertTriangle, Archive, Ban, ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GlobalScanner } from "../../_shared/GlobalScanner";
import { PowipPulseLoader } from "@/components/shared/PowipPulseLoader";
import { useAuth } from "@/contexts/AuthContext";
import { useOperationsRole } from "@/contexts/OperationsRoleContext";
import { OPS_PERMISSIONS } from "@/config/operationsPermissions";
import { useUserAuditInfo } from "@/hooks/useUserAuditInfo";
import { OrderHeader, OrderStatus } from "@/interfaces/IOrder";
import {
  PEDIDOS_TABS,
  PedidosTabKey,
  countByTab,
  getPedidosTab,
} from "@/utils/domain/operations-pedidos-tabs";
import { fetchCouriers } from "@/services/courierService";
import { DEFAULT_SALES_CHANNELS } from "@/utils/salesChannels";
import { reassignSeller } from "@/services/atencionClienteService";
import { getStatusChainSteps, getStatusLabel } from "@/utils/domain/orders-status-flow";
import { exportSalesToExcel, SaleExportData } from "@/utils/exportSalesExcel";
import { openPrintWindow, printReceipts, ReceiptData } from "@/utils/bulk-receipt-printer";

import CustomerServiceModal from "@/components/modals/CustomerServiceModal";
import PaymentVerificationModal from "@/components/modals/PaymentVerificationModal";
import GuideDetailsModal from "@/components/modals/GuideDetailsModal";
import CreateGuideModal, { CreateGuideData } from "@/components/modals/CreateGuideModal";
import AddToExistingGuideModal from "@/components/modals/AddToExistingGuideModal";
import CancellationModal, { CancellationReason } from "@/components/modals/CancellationModal";
import CourierAssignmentModal from "@/components/modals/CourierAssignmentModal";
import ReassignSellerModal from "@/components/modals/ReassignSellerModal";
import { RescheduleDialog } from "@/components/ventas/RescheduleDialog";

import { PorDespacharTab } from "./PorDespacharTab";
import { EnCaminoTab } from "./EnCaminoTab";
import { AtencionTab } from "./AtencionTab";
import { HistorialTab } from "./HistorialTab";
import { AnuladosTab } from "./AnuladosTab";
import { PedidosActions, Sale, mapOrderToSale, openWhatsApp } from "./types";

const API_VENTAS = process.env.NEXT_PUBLIC_API_VENTAS;
const API_COURIER = process.env.NEXT_PUBLIC_API_COURIER;

const TAB_KEYS: PedidosTabKey[] = PEDIDOS_TABS.map((t) => t.key);

const TAB_ICON: Record<PedidosTabKey, React.ElementType> = {
  despachar: Package,
  camino: Truck,
  atencion: AlertTriangle,
  historial: Archive,
  anulados: Ban,
};

type RescheduleTarget = { saleIds: string[] } | null;

export function PedidosContent() {
  const { auth, selectedStoreId } = useAuth();
  const { can } = useOperationsRole();
  const getUserInfo = useUserAuditInfo();
  const searchParams = useSearchParams();
  const router = useRouter();

  const initialTab = useMemo<PedidosTabKey>(() => {
    const t = searchParams.get("tab") as PedidosTabKey | null;
    return t && TAB_KEYS.includes(t) ? t : "despachar";
  }, [searchParams]);
  const initialQf = searchParams.get("qf") ?? undefined;
  const initialQ = searchParams.get("q") ?? undefined;

  const [activeTab, setActiveTab] = useState<PedidosTabKey>(initialTab);
  const [orders, setOrders] = useState<OrderHeader[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiCouriers, setApiCouriers] = useState<string[]>([]);
  const [isBulkLoading, setIsBulkLoading] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);

  // ---- Modales ----
  const [viewOrderId, setViewOrderId] = useState<string | null>(null);
  const [paymentSale, setPaymentSale] = useState<Sale | null>(null);
  const [guideSale, setGuideSale] = useState<Sale | null>(null);
  const [createGuideOrders, setCreateGuideOrders] = useState<Sale[] | null>(null);
  const [isCreatingGuide, setIsCreatingGuide] = useState(false);
  const [addToGuideOrders, setAddToGuideOrders] = useState<Sale[] | null>(null);
  const [isAddingToGuide, setIsAddingToGuide] = useState(false);
  const [cancelSale, setCancelSale] = useState<Sale | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [courierAssignSales, setCourierAssignSales] = useState<Sale[] | null>(null);
  const [isAssigningCourier, setIsAssigningCourier] = useState(false);
  const [reassignSale, setReassignSale] = useState<Sale | null>(null);
  const [isReassigning, setIsReassigning] = useState(false);
  const [rescheduleTarget, setRescheduleTarget] = useState<RescheduleTarget>(null);

  const fetchOrders = useCallback(async () => {
    if (!selectedStoreId) return;
    try {
      const res = await axios.get<OrderHeader[]>(
        `${API_VENTAS}/order-header/store/${selectedStoreId}`,
      );
      res.data.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
      setOrders(res.data ?? []);
    } catch (error) {
      console.error("Error cargando pedidos", error);
      toast.error("No se pudieron cargar los pedidos");
    } finally {
      setLoading(false);
    }
  }, [selectedStoreId]);

  useEffect(() => {
    setLoading(true);
    fetchOrders();
  }, [fetchOrders]);

  useEffect(() => {
    if (!auth?.company?.id) return;
    fetchCouriers(auth.company.id)
      .then((data) => setApiCouriers(data.map((c) => c.name)))
      .catch(() => toast.error("No se pudieron cargar los couriers"));
  }, [auth?.company?.id]);

  // Pedidos (a diferencia del Tablero) solo trabaja pedidos que ya entraron
  // al pipeline de despacho — un PENDIENTE todavía no fue preparado por
  // almacén, así que no debe listarse ni contar acá (sigue siendo un pedido
  // de Ventas, no de Operaciones, hasta que se prepare). INCOMPLETE tampoco
  // — es un carrito/checkout que nunca se terminó (con errores de sync, se
  // gestiona aparte en Atención al Cliente › Pedidos con errores), no un
  // pedido real; sin este filtro caía por el fallback de getPedidosTab
  // directo a "Por Despachar", mezclado con pedidos listos para despachar.
  const visibleOrders = useMemo(
    () => orders.filter((o) => o.status !== "PENDIENTE" && o.status !== "INCOMPLETE"),
    [orders],
  );

  const tabCounts = useMemo(() => countByTab(visibleOrders), [visibleOrders]);

  const salesByTab = useMemo(() => {
    const grouped: Record<PedidosTabKey, OrderHeader[]> = {
      despachar: [],
      camino: [],
      atencion: [],
      historial: [],
      anulados: [],
    };
    for (const order of visibleOrders) grouped[getPedidosTab(order)].push(order);
    const out = {} as Record<PedidosTabKey, Sale[]>;
    for (const key of TAB_KEYS) out[key] = grouped[key].map(mapOrderToSale);
    return out;
  }, [visibleOrders]);

  const salesById = useMemo(() => {
    const map = new Map<string, Sale>();
    for (const key of TAB_KEYS) for (const s of salesByTab[key]) map.set(s.id, s);
    return map;
  }, [salesByTab]);

  /* ------------------------------ Handlers ------------------------------ */

  const handleView = useCallback((sale: Sale) => {
    setViewOrderId(sale.id);
  }, []);

  const handleChangeStatus = useCallback(
    async (saleId: string, newStatus: OrderStatus) => {
      const sale = salesById.get(saleId);
      if (newStatus === "ANULADO") {
        if (sale) setCancelSale(sale);
        return;
      }
      if (newStatus === "EN_ENVIO") {
        const isPickup = sale?.deliveryType.toUpperCase().includes("RETIRO");
        if (sale && !sale.courier && !isPickup) {
          toast.error("Debe asignar un courier antes de cambiar a EN_ENVIO");
          return;
        }
      }
      try {
        // Atajos como Pendiente → En envío no son un salto válido de un solo
        // paso para el backend — se encadenan los estados intermedios acá.
        // Pasar por LLAMADO siempre marca callStatus CONFIRMED (igual que el
        // módulo viejo: "Contactado" tocaba status Y callStatus a la vez).
        const steps = sale ? getStatusChainSteps(sale.status, newStatus) : [newStatus];
        for (const step of steps) {
          await axios.patch(`${API_VENTAS}/order-header/${saleId}`, {
            status: step,
            ...(step === "LLAMADO" && { callStatus: "CONFIRMED" }),
            ...getUserInfo(),
          });
        }
        toast.success(`Estado actualizado a ${getStatusLabel(newStatus)}`);
        fetchOrders();
      } catch (error: any) {
        toast.error(error?.response?.data?.message || "No se pudo actualizar el estado");
      }
    },
    [salesById, getUserInfo, fetchOrders],
  );

  // "No Contesta" — no toca `status`, solo anota el intento de llamada
  // fallido en `callStatus` (mismo criterio que el módulo viejo).
  const handleMarkNoAnswer = useCallback(
    async (saleId: string) => {
      try {
        await axios.patch(`${API_VENTAS}/order-header/${saleId}`, {
          callStatus: "NO_ANSWER",
          ...getUserInfo(),
        });
        toast.success("Marcado como No Contesta");
        fetchOrders();
      } catch (error: any) {
        toast.error(error?.response?.data?.message || "No se pudo actualizar el pedido");
      }
    },
    [getUserInfo, fetchOrders],
  );

  const handleBulkMarkNoAnswer = useCallback(
    async (ids: string[]) => {
      if (ids.length === 0) return;
      const uInfo = getUserInfo();
      let success = 0;
      let failed = 0;
      await Promise.all(
        ids.map(async (id) => {
          try {
            await axios.patch(`${API_VENTAS}/order-header/${id}`, {
              callStatus: "NO_ANSWER",
              ...uInfo,
            });
            success++;
          } catch {
            failed++;
          }
        }),
      );
      if (success > 0) toast.success(`${success} pedido(s) marcados como No Contesta`);
      if (failed > 0) toast.error(`${failed} pedido(s) no pudieron actualizarse`);
      fetchOrders();
    },
    [getUserInfo, fetchOrders],
  );

  const handleBulkStatusChange = useCallback(
    async (ids: string[], newStatus: OrderStatus) => {
      if (ids.length === 0) return;
      if (newStatus === "ANULADO") {
        toast.error("Para anular pedidos, use la opción individual con motivo de cancelación.");
        return;
      }
      if (newStatus === "EN_ENVIO") {
        const missing = ids.filter((id) => {
          const s = salesById.get(id);
          return s && !s.courier && !s.deliveryType.toUpperCase().includes("RETIRO");
        });
        if (missing.length > 0) {
          toast.error(`${missing.length} pedido(s) sin courier asignado. No se puede pasar a EN_ENVIO.`);
          return;
        }
      }
      setIsBulkLoading(true);
      const uInfo = getUserInfo();
      let success = 0;
      let failed = 0;
      // Cada pedido puede partir de un estado distinto, así que el
      // encadenado (ver handleChangeStatus) se calcula por pedido — en
      // tandas de 10 para no saturar la API con selecciones grandes.
      const BATCH_SIZE = 10;
      for (let i = 0; i < ids.length; i += BATCH_SIZE) {
        const batch = ids.slice(i, i + BATCH_SIZE);
        await Promise.all(
          batch.map(async (id) => {
            const sale = salesById.get(id);
            const steps = sale ? getStatusChainSteps(sale.status, newStatus) : [newStatus];
            try {
              for (const step of steps) {
                await axios.patch(`${API_VENTAS}/order-header/${id}`, {
                  status: step,
                  ...(step === "LLAMADO" && { callStatus: "CONFIRMED" }),
                  ...uInfo,
                });
              }
              success++;
            } catch {
              failed++;
            }
          }),
        );
      }
      if (success > 0) toast.success(`${success} pedido(s) actualizados a ${getStatusLabel(newStatus)}`);
      if (failed > 0) toast.error(`${failed} pedido(s) no pudieron actualizarse`);
      setIsBulkLoading(false);
      fetchOrders();
    },
    [salesById, getUserInfo, fetchOrders],
  );

  // Reprogramación de ENTREGA (no de llamada — eso vive solo dentro del
  // modal de pedido, tab "Llamada & Promo" de CustomerServiceModal). No
  // existe un campo estructurado propio, se reutiliza `callbackAt` sin
  // tocar `callStatus`/`status` — ver nota en operations-pedidos-tabs.ts.
  const handleRescheduleConfirm = useCallback(
    async (callbackAt: Date) => {
      if (!rescheduleTarget) return;
      const { saleIds } = rescheduleTarget;
      setRescheduleTarget(null);
      try {
        await Promise.all(
          saleIds.map((id) =>
            axios.patch(`${API_VENTAS}/order-header/${id}`, {
              callbackAt: callbackAt.toISOString(),
              callStatus: "SCHEDULED",
              ...getUserInfo(),
            }),
          ),
        );
        toast.success("Entrega reprogramada");
        fetchOrders();
      } catch {
        toast.error("Error al reprogramar");
      }
    },
    [rescheduleTarget, getUserInfo, fetchOrders],
  );

  const handleConfirmCancellation = useCallback(
    async (reason: CancellationReason, notes?: string) => {
      if (!cancelSale) return;
      setIsCancelling(true);
      try {
        await axios.patch(`${API_VENTAS}/order-header/${cancelSale.id}`, {
          status: "ANULADO",
          cancellationReason: reason,
          notes,
          ...getUserInfo(),
        });
        toast.success(`Venta ${cancelSale.orderNumber} anulada`);
        setCancelSale(null);
        fetchOrders();
      } catch (error: any) {
        toast.error(error?.response?.data?.message || "No se pudo anular la venta");
      } finally {
        setIsCancelling(false);
      }
    },
    [cancelSale, getUserInfo, fetchOrders],
  );

  const handleAssignCourierConfirm = useCallback(
    async (courier: string, courierId?: string) => {
      const eligible = courierAssignSales ?? [];
      if (eligible.length === 0) return;
      setIsAssigningCourier(true);
      let success = 0;
      let failed = 0;
      for (const sale of eligible) {
        try {
          await axios.patch(`${API_VENTAS}/order-header/${sale.id}`, {
            status: "EN_ENVIO",
            courier,
            courierId: courierId || null,
            ...getUserInfo(),
          });
          success++;
        } catch {
          failed++;
        }
      }
      if (success > 0) toast.success(`${success} pedido(s) asignados y despachados`);
      if (failed > 0) toast.error(`${failed} pedido(s) no pudieron actualizarse`);
      setIsAssigningCourier(false);
      setCourierAssignSales(null);
      fetchOrders();
    },
    [courierAssignSales, getUserInfo, fetchOrders],
  );

  const handleCreateGuideConfirm = useCallback(
    async (guidesData: CreateGuideData[]) => {
      setIsCreatingGuide(true);
      try {
        const createdGuides: string[] = [];
        let totalOrders = 0;
        for (const guideData of guidesData) {
          const res = await axios.post(`${API_COURIER}/shipping-guides`, guideData);
          const guideNumber = res.data.guideNumber;
          createdGuides.push(guideNumber);
          totalOrders += guideData.orderIds.length;
          for (const orderId of guideData.orderIds) {
            const carrierCost = guideData.orderCarrierCosts?.[orderId] || 0;
            // ORDER_STATUS_FLOW solo permite ASIGNADO_A_GUIA desde LLAMADO —
            // si el pedido viene de un estado anterior (PREPARADO, o PAGADO =
            // PENDIENTE + pagado), se encadenan los pasos intermedios hasta
            // LLAMADO acá mismo, transparente para quien despacha.
            // getStatusChainSteps no retrocede ni repite estado: LLAMADO y
            // ASIGNADO_A_GUIA devuelven `[]` y no generan PATCH.
            const currentStatus = salesById.get(orderId)?.status;
            if (currentStatus) {
              const bridge = getStatusChainSteps(currentStatus, "LLAMADO");
              for (const step of bridge) {
                await axios.patch(`${API_VENTAS}/order-header/${orderId}`, {
                  status: step,
                  ...getUserInfo(),
                });
              }
            }
            // La guía queda CREADA hasta que se apruebe explícitamente con el
            // botón "Aprobar Guía" (GuideDetailsModal) — recién ahí el pedido
            // pasa a EN_ENVIO. Mismo criterio que Guías & Courier.
            await axios.patch(`${API_VENTAS}/order-header/${orderId}`, {
              guideNumber,
              status: "ASIGNADO_A_GUIA",
              courier: guideData.courierName,
              courierId: guideData.courierId || null,
              carrierShippingCost: carrierCost,
              ...getUserInfo(),
            });
          }
        }
        toast.success(
          createdGuides.length === 1
            ? `Guía ${createdGuides[0]} creada con ${totalOrders} pedido(s)`
            : `${createdGuides.length} guías creadas con ${totalOrders} pedido(s)`,
        );
        // Abre el detalle de la guía recién creada para que "Aprobar Guía"
        // quede a la vista de una — no hay que ir a buscarlo.
        const firstOrder = createGuideOrders?.[0] ?? null;
        setCreateGuideOrders(null);
        fetchOrders();
        if (firstOrder) setGuideSale(firstOrder);
      } catch (error: any) {
        toast.error(error?.response?.data?.message || "Error creando guía");
      } finally {
        setIsCreatingGuide(false);
      }
    },
    [getUserInfo, fetchOrders, createGuideOrders, salesById],
  );

  const handleAddToGuideConfirm = useCallback(
    async (
      guideId: string,
      guideNumber: string,
      guideStatus: string,
      courierName?: string | null,
    ) => {
      const selected = addToGuideOrders ?? [];
      if (selected.length === 0) return;
      setIsAddingToGuide(true);
      try {
        await axios.post(`${API_COURIER}/shipping-guides/${guideId}/orders`, {
          orderIds: selected.map((s) => s.id),
        });
        // BUG: AddToExistingGuideModal deja elegir guías CREADA, ASIGNADA
        // *o EN_RUTA* (ya aprobadas y despachadas), pero el botón "Aprobar
        // Guía" de GuideDetailsModal solo aparece para guías CREADA/
        // ASIGNADA. Un pedido agregado a una guía ya EN_RUTA quedaba en
        // ASIGNADO_A_GUIA sin ningún botón que lo pase a EN_ENVIO —
        // trabado en "Por Despachar" en vez de "En Camino" (reportado: "se
        // asignó a guía, no aparece en En Camino, hubo que cambiarlo a
        // mano"). Si la guía ya está despachada, el pedido nuevo se
        // despacha directo a EN_ENVIO, igual que hace la aprobación normal.
        const guideAlreadyDispatched = guideStatus !== "CREADA" && guideStatus !== "ASIGNADA";
        for (const sale of selected) {
          // Puente genérico: lleva cualquier estado previo (PREPARADO, o
          // PAGADO = PENDIENTE + pagado) hasta LLAMADO sin violar el flujo del
          // backend, encadenando un PATCH por paso. getStatusChainSteps no
          // retrocede ni repite estado, así que un pedido ya en LLAMADO o más
          // adelante (ASIGNADO_A_GUIA) no genera PATCH.
          const bridge = getStatusChainSteps(sale.status, "LLAMADO");
          for (const step of bridge) {
            await axios.patch(`${API_VENTAS}/order-header/${sale.id}`, {
              status: step,
              ...getUserInfo(),
            });
          }
          // PATCH final: adjunta la guía y avanza el último salto (válido de
          // un paso desde LLAMADO/ASIGNADO_A_GUIA). Si la guía ya está
          // despachada, el pedido pasa directo a EN_ENVIO con el courier en el
          // MISMO PATCH (invariante "courier antes de EN_ENVIO"). Si no, queda
          // en ASIGNADO_A_GUIA hasta que se apruebe la guía.
          await axios.patch(`${API_VENTAS}/order-header/${sale.id}`, {
            guideNumber,
            status: guideAlreadyDispatched ? "EN_ENVIO" : "ASIGNADO_A_GUIA",
            ...(guideAlreadyDispatched
              ? { courier: courierName ?? undefined }
              : {}),
            ...getUserInfo(),
          });
        }
        toast.success(
          guideAlreadyDispatched
            ? `${selected.length} pedido(s) agregados a la guía ${guideNumber} y despachados`
            : `${selected.length} pedido(s) agregados a la guía ${guideNumber}`,
        );
        setAddToGuideOrders(null);
        fetchOrders();
        setGuideSale(selected[0]);
      } catch (error: any) {
        toast.error(error?.response?.data?.message || "Error al agregar a la guía");
      } finally {
        setIsAddingToGuide(false);
      }
    },
    [addToGuideOrders, getUserInfo, fetchOrders],
  );

  const handleReassignSellerConfirm = useCallback(
    async (sellerId: string, sellerName: string) => {
      if (!reassignSale) return;
      setIsReassigning(true);
      try {
        const uInfo = getUserInfo();
        await reassignSeller(reassignSale.id, sellerId, sellerName, uInfo.userId, uInfo.sellerName);
        toast.success("Vendedor reasignado correctamente");
        setReassignSale(null);
        fetchOrders();
      } catch {
        toast.error("No se pudo reasignar el vendedor");
      } finally {
        setIsReassigning(false);
      }
    },
    [reassignSale, getUserInfo, fetchOrders],
  );

  const handleCopySelected = useCallback(async (selected: Sale[]) => {
    if (selected.length === 0) {
      toast.warning("No hay pedidos seleccionados");
      return;
    }
    const text = selected
      .map((sale) =>
        `Venta ${sale.orderNumber}\nCliente: ${sale.clientName}\nTeléfono: ${sale.phoneNumber}\nDistrito: ${sale.district}\nDirección: ${sale.address}\nFecha: ${sale.date}\nTotal: S/ ${sale.total.toFixed(2)}\nAdelanto: S/ ${sale.advancePayment.toFixed(2)}\nPor Cobrar: S/ ${sale.pendingPayment.toFixed(2)}\nEstado: ${getStatusLabel(sale.status)}`.trim(),
      )
      .join("\n\n--------------------\n\n");
    await navigator.clipboard.writeText(text);
    toast.success(`${selected.length} pedido(s) copiados`);
  }, []);

  const handleExportExcel = useCallback((selected: Sale[], tabName: string) => {
    if (selected.length === 0) {
      toast.warning("No hay datos para exportar");
      return;
    }
    const exportData: SaleExportData[] = selected.map((s) => ({
      orderNumber: s.orderNumber,
      clientName: s.clientName,
      phoneNumber: s.phoneNumber,
      documentType: s.documentType,
      documentNumber: s.documentNumber,
      date: s.date,
      total: s.total,
      advancePayment: s.advancePayment,
      pendingPayment: s.pendingPayment,
      status: s.status,
      salesRegion: s.salesRegion,
      province: s.province,
      city: s.city,
      district: s.district,
      zone: s.zone,
      address: s.address,
      googleMapsUrl: s.googleMapsUrl,
      paymentMethod: s.paymentMethod,
      deliveryType: s.deliveryType,
      courier: s.courier,
      sellerName: s.sellerName,
      guideNumber: s.guideNumber,
    }));
    exportSalesToExcel(exportData, `operaciones_pedidos_${tabName}`);
    toast.success(`Exportados ${selected.length} registros`);
  }, []);

  const handleBulkPrint = useCallback(async (selected: Sale[]) => {
    if (selected.length === 0) {
      toast.warning("No hay pedidos seleccionados para imprimir");
      return;
    }

    // Abrir la ventana ANTES de cualquier await: si se abre después de
    // esperar las requests de abajo, el navegador la bloquea en silencio
    // (así se veía el bug: "queda cargando y da error" con varios pedidos).
    const printWindow = openPrintWindow();
    if (!printWindow) {
      toast.error("No se pudo abrir la ventana de impresión. Verifica que los popups no estén bloqueados.");
      return;
    }

    setIsBulkLoading(true);
    try {
      const results = await Promise.allSettled(
        selected.map((sale) => axios.get<ReceiptData>(`${API_VENTAS}/order-header/${sale.id}/receipt`)),
      );

      const receipts: ReceiptData[] = [];
      const failed: string[] = [];
      results.forEach((result, i) => {
        if (result.status === "fulfilled") {
          receipts.push(result.value.data);
        } else {
          failed.push(selected[i].orderNumber);
          console.error(`Error al obtener el comprobante de ${selected[i].orderNumber}`, result.reason);
        }
      });

      if (receipts.length === 0) {
        printWindow.close();
        toast.error("No se pudo obtener ningún pedido seleccionado");
        return;
      }

      await printReceipts(receipts, auth?.company, printWindow);

      if (failed.length > 0) {
        toast.warning(`Se imprimieron ${receipts.length} etiqueta(s). No se pudo generar la de: ${failed.join(", ")}`);
      }
    } catch (error) {
      printWindow.close();
      console.error("Error al generar etiquetas en lote", error);
      toast.error("No se pudieron generar las etiquetas");
    } finally {
      setIsBulkLoading(false);
    }
  }, [auth?.company]);

  const handleBulkWhatsApp = useCallback((selected: Sale[]) => {
    if (selected.length === 0) {
      toast.warning("No hay pedidos seleccionados para enviar WhatsApp");
      return;
    }
    if (selected.length > 5) {
      toast.info(`Se abrirán ${selected.length} ventanas de WhatsApp. Permití los pop-ups.`);
    }
    selected.forEach((sale, index) => {
      setTimeout(() => openWhatsApp(sale.phoneNumber, sale.orderNumber, sale.clientName), index * 600);
    });
  }, []);

  const handleEdit = useCallback(
    (sale: Sale) => {
      router.push(`/registrar-venta?orderId=${sale.id}`);
    },
    [router],
  );

  const handleSyncCourier = useCallback(() => {
    toast.promise(fetchOrders(), {
      loading: "Sincronizando con courier...",
      success: "Pedidos actualizados",
      error: "No se pudo sincronizar",
    });
  }, [fetchOrders]);

  // No hay endpoint de inventario/devoluciones real (ver informe de brechas
  // de backend) — "reingresar a stock" y "marcar merma" se registran como
  // anulación con motivo distinguible, honestamente sin tocar stock.
  const handleReturnToStock = useCallback(
    async (sale: Sale) => {
      try {
        await axios.patch(`${API_VENTAS}/order-header/${sale.id}`, {
          status: "ANULADO",
          cancellationReason: "DELIVERY_ISSUE",
          notes: "Devolución del courier — mercadería reingresada a stock",
          ...getUserInfo(),
        });
        toast.success(`Pedido ${sale.orderNumber} reingresado a stock`);
        fetchOrders();
      } catch (error: any) {
        toast.error(error?.response?.data?.message || "No se pudo registrar el reingreso");
      }
    },
    [getUserInfo, fetchOrders],
  );

  const handleMarkAsLoss = useCallback(
    async (sale: Sale) => {
      try {
        await axios.patch(`${API_VENTAS}/order-header/${sale.id}`, {
          status: "ANULADO",
          cancellationReason: "OTHER",
          notes: "Devolución del courier — mercadería registrada como merma",
          ...getUserInfo(),
        });
        toast.success(`Pedido ${sale.orderNumber} registrado como merma`);
        fetchOrders();
      } catch (error: any) {
        toast.error(error?.response?.data?.message || "No se pudo registrar la merma");
      }
    },
    [getUserInfo, fetchOrders],
  );

  const salesChannels = auth?.company?.sales_channels?.length
    ? auth.company.sales_channels
    : DEFAULT_SALES_CHANNELS;

  const actions: PedidosActions = {
    can,
    apiCouriers,
    salesChannels,
    isBulkLoading,
    onView: handleView,
    onOpenPayment: setPaymentSale,
    onOpenGuide: setGuideSale,
    onReassignSeller: setReassignSale,
    onCancel: setCancelSale,
    onChangeStatus: handleChangeStatus,
    onMarkNoAnswer: handleMarkNoAnswer,
    onBulkMarkNoAnswer: handleBulkMarkNoAnswer,
    onDeliveryReschedule: (sale) => setRescheduleTarget({ saleIds: [sale.id] }),
    onBulkDeliveryReschedule: (ids) => setRescheduleTarget({ saleIds: ids }),
    onOpenCreateGuide: setCreateGuideOrders,
    onOpenAddToGuide: setAddToGuideOrders,
    onAssignCourierBulk: setCourierAssignSales,
    onBulkStatusChange: handleBulkStatusChange,
    onBulkWhatsApp: handleBulkWhatsApp,
    onBulkPrint: handleBulkPrint,
    onCopySelected: handleCopySelected,
    onExportExcel: handleExportExcel,
    onWhatsApp: (sale) => openWhatsApp(sale.phoneNumber, sale.orderNumber, sale.clientName),
    onEdit: handleEdit,
    onSyncCourier: handleSyncCourier,
    onReturnToStock: handleReturnToStock,
    onMarkAsLoss: handleMarkAsLoss,
    companyId: auth?.company?.id,
  };

  if (loading) {
    return <PowipPulseLoader label="Cargando pedidos..." />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Pedidos</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Despacho, seguimiento y atención de pedidos — el flujo completo, en un solo lugar.
          </p>
        </div>
        <Button
          size="sm"
          className="gap-1.5 bg-violet-600 text-white hover:bg-violet-700"
          onClick={() => setScannerOpen(true)}
        >
          <ScanLine className="h-4 w-4" />
          Escanear
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as PedidosTabKey)}>
        <TabsList className="h-auto w-full gap-1 bg-muted/60 p-1">
          {PEDIDOS_TABS.map((tab) => {
            const Icon = TAB_ICON[tab.key];
            return (
            <TabsTrigger
              key={tab.key}
              value={tab.key}
              className={`flex-1 gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium sm:text-sm ${tab.alerta && tabCounts[tab.key] > 0 ? "data-[state=active]:text-red-600" : ""}`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
              <span
                className={`ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${
                  tab.alerta && tabCounts[tab.key] > 0
                    ? "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300"
                    : "bg-background text-muted-foreground"
                }`}
              >
                {tabCounts[tab.key]}
              </span>
            </TabsTrigger>
            );
          })}
        </TabsList>

        <TabsContent value="despachar">
          <PorDespacharTab
            sales={salesByTab.despachar}
            actions={actions}
            initialSearch={initialTab === "despachar" ? initialQ : undefined}
            initialQf={initialTab === "despachar" ? initialQf : undefined}
          />
        </TabsContent>
        <TabsContent value="camino">
          <EnCaminoTab
            sales={salesByTab.camino}
            actions={actions}
            initialSearch={initialTab === "camino" ? initialQ : undefined}
            initialQf={initialTab === "camino" ? initialQf : undefined}
          />
        </TabsContent>
        <TabsContent value="atencion">
          <AtencionTab
            sales={salesByTab.atencion}
            actions={actions}
            initialSearch={initialTab === "atencion" ? initialQ : undefined}
            initialQf={initialTab === "atencion" ? initialQf : undefined}
          />
        </TabsContent>
        <TabsContent value="historial">
          <HistorialTab sales={salesByTab.historial} actions={actions} initialSearch={initialTab === "historial" ? initialQ : undefined} />
        </TabsContent>
        <TabsContent value="anulados">
          <AnuladosTab sales={salesByTab.anulados} actions={actions} initialSearch={initialTab === "anulados" ? initialQ : undefined} />
        </TabsContent>
      </Tabs>

      {/* ------------------------------ Modales ------------------------------ */}

      {viewOrderId && (
        <CustomerServiceModal
          open={!!viewOrderId}
          orderId={viewOrderId}
          onClose={() => setViewOrderId(null)}
          onOrderUpdated={fetchOrders}
          isOperaciones
          showTracking
        />
      )}

      {paymentSale && (
        <PaymentVerificationModal
          open={!!paymentSale}
          onClose={() => setPaymentSale(null)}
          orderId={paymentSale.id}
          orderNumber={paymentSale.orderNumber}
          onPaymentUpdated={fetchOrders}
          canApprove={can(OPS_PERMISSIONS.APPROVE_PAYMENTS)}
        />
      )}

      {guideSale && (
        <GuideDetailsModal
          open={!!guideSale}
          onClose={() => setGuideSale(null)}
          orderId={guideSale.id}
          defaultCourier={guideSale.courier}
          onGuideUpdated={fetchOrders}
        />
      )}

      {createGuideOrders && (
        <CreateGuideModal
          open={!!createGuideOrders}
          onClose={() => setCreateGuideOrders(null)}
          selectedOrders={createGuideOrders}
          storeId={selectedStoreId || ""}
          onConfirm={handleCreateGuideConfirm}
          isLoading={isCreatingGuide}
        />
      )}

      {addToGuideOrders && (
        <AddToExistingGuideModal
          open={!!addToGuideOrders}
          onClose={() => setAddToGuideOrders(null)}
          selectedOrders={addToGuideOrders}
          storeId={selectedStoreId || ""}
          onConfirm={handleAddToGuideConfirm}
          isLoading={isAddingToGuide}
        />
      )}

      {cancelSale && (
        <CancellationModal
          open={!!cancelSale}
          onClose={() => setCancelSale(null)}
          orderNumber={cancelSale.orderNumber}
          onConfirm={handleConfirmCancellation}
          isLoading={isCancelling}
        />
      )}

      {courierAssignSales && (
        <CourierAssignmentModal
          open={!!courierAssignSales}
          onClose={() => setCourierAssignSales(null)}
          selectedCount={courierAssignSales.length}
          onConfirm={handleAssignCourierConfirm}
          isLoading={isAssigningCourier}
        />
      )}

      {reassignSale && (
        <ReassignSellerModal
          open={!!reassignSale}
          onClose={() => setReassignSale(null)}
          orderNumber={reassignSale.orderNumber}
          currentSellerName={reassignSale.sellerName}
          companyId={auth?.company?.id || ""}
          onConfirm={handleReassignSellerConfirm}
          isLoading={isReassigning}
        />
      )}

      <RescheduleDialog
        open={!!rescheduleTarget}
        onOpenChange={(v) => !v && setRescheduleTarget(null)}
        onConfirm={handleRescheduleConfirm}
      />

      <GlobalScanner open={scannerOpen} onOpenChange={setScannerOpen} />
    </div>
  );
}
