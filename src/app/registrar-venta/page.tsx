"use client";

import SaleUnitLifecycleActions from "@/components/registrar-venta/SaleUnitLifecycleActions";
import { AdvertisingAttributionSelect } from "@/components/advertising/v22/AttributionSelect";

import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  ChevronDown,
  ClipboardList,
  CreditCard,
  type LucideIcon,
  Package,
  Plus,
  Search,
  ShoppingCart,
  Trash2,
  User,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { HeaderConfig } from "@/components/header/HeaderConfig";
import OrderReceiptModal from "@/components/modals/orderReceiptModal";
import PaymentVerificationModal from "@/components/modals/PaymentVerificationModal";
import SaleUnitSelection from "@/components/registrar-venta/SaleUnitSelection";
import { PendingSaleRecovery, SaleAssignmentStatus } from "@/components/registrar-venta/SaleTrackingRecovery";
import { canCorrectTrackingRequest, getSaleUnits, isTracked, trackingError, type InventoryUnit } from "@/services/inventoryTrackingService";
import { persistSaleOperation, readSaleOperation, saleOperationKey, validateSaleUnits, type PendingSaleOperation } from "@/services/saleTrackingService";
import CartLines from "@/components/registrar-venta/CartLines";
import ProductSearchMatrix from "@/components/registrar-venta/ProductSearchMatrix";
import {
  hasSaleChannelSelection,
  SaleChannelField,
} from "@/components/registrar-venta/SaleChannelField";
import { SaleOriginField } from "@/components/registrar-venta/SaleOriginField";
import SuggestionsPanel from "@/components/registrar-venta/SuggestionsPanel";
import { useSaleOrigin } from "@/components/registrar-venta/useSaleOrigin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Combobox } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { hasAdminAccess, isSuperadmin } from "@/config/permissions.config";
import { useAuth } from "@/contexts/AuthContext";
import { PacksProvider, usePacks } from "@/contexts/PacksContext";
import { DeliveryType, OrderType, type SalesChannel } from "@/enum/Order.enum";
import { usePacksEngine } from "@/hooks/usePacksEngine";
import { useCompanyCouriers } from "@/hooks/useCompanyCouriers";
import type { Client, ClientType, DocumentType } from "@/interfaces/ICliente";
import type { CartItem, OrderHeader } from "@/interfaces/IOrder";
import type { GiftOption, Pack, VolumePack } from "@/interfaces/IPack";
import type { InventoryItemForSale } from "@/interfaces/IProduct";
import axiosAuth from "@/lib/axiosAuth";
import { GATEWAY } from "@/lib/gateway";
import { tokenStore } from "@/lib/tokenStore";
import { cn } from "@/lib/utils";
import { createClient, fetchClientByPhone, updateClient } from "@/services/clients.service";
import { searchInventoryItems } from "@/services/inventoryItems.service";
import { fetchSaleContext } from "@/services/saleContextService";
import ubigeos from "@/utils/json/ubigeos.json";
import { bumpProductFrequency, getProductFrequencies } from "@/utils/productFrequency";
import { DEFAULT_SALES_CHANNELS } from "@/utils/salesChannels";
import { buildOrderItem, getOrderItemPricing } from "./orderItemPricing";
import { validateClientDocument } from "./clientDocumentValidation";
import { buildClientUpdatePayload, clientToFormFields } from "./clientForm";
import { clientSaveErrorMessage } from "./clientSaveError";
import {
  resolvePaymentProofTarget,
  type ProofPayment,
  type SavedOrderProof,
} from "./paymentProofTarget";

import {
  confirmCommercialLead,
  getCommercialLead,
  getCommercialLeadCapabilities,
  getCommercialLeadConfirmationCapabilities,
  getCommercialLeadContext,
  commercialLeadError,
} from "@/services/commercialLeadsService";
import { getLeadPayments } from "@/services/leadPaymentsService";
import type { LeadPayment } from "@/types/leadPayments";
import type { LeadDetail, ConfirmCommercialLeadInput } from "@/types/leads";
import {
  commercialLeadHref,
  notifyCommercialChange,
} from "@/utils/commercialOrders";

type ClientSearchState = "idle" | "found" | "not_found" | "error";

const TONE_CLASSES = {
  violet: "bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300",
  green: "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300",
  amber: "bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300",
} as const;

function SectionTitle({
  icon: Icon,
  tone = "violet",
  hint,
  children,
}: {
  icon: LucideIcon;
  tone?: keyof typeof TONE_CLASSES;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3">
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] ${TONE_CLASSES[tone]}`}
      >
        <Icon className="h-[17px] w-[17px]" />
      </span>
      <div>
        <div className="font-bold">{children}</div>
        {hint && <div className="text-xs font-normal text-muted-foreground">{hint}</div>}
      </div>
    </div>
  );
}

function Disclosure({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-3 border-t border-dashed pt-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-xs font-bold text-violet-600 dark:text-violet-300"
      >
        <ChevronDown className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} />
        {label}
      </button>
      {open && (
        <div className="mt-3.5 space-y-3.5 animate-in fade-in slide-in-from-top-1">{children}</div>
      )}
    </div>
  );
}

function extractLatLngFromGoogleMapsUrl(url: string): { lat: number; lng: number } | null {
  const patterns = [
    /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/, // pin exacto en links "place/.../data="
    /@(-?\d+\.\d+),(-?\d+\.\d+)/, // centro del mapa "@lat,lng,zoom"
    /[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/, // link corto "?q=lat,lng"
  ];
  for (const re of patterns) {
    const match = url.match(re);
    if (match) {
      const lat = parseFloat(match[1]);
      const lng = parseFloat(match[2]);
      if (!isNaN(lat) && !isNaN(lng)) return { lat, lng };
    }
  }
  return null;
}

/** Default: hoy + 24 hs, solo fecha (sin hora). */
function defaultScheduledDateValue(): string {
  const d = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** ISO (UTC) → valor para <input type="date"> en fecha local (sin hora). */
function isoToDateValue(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const emptyClientForm = {
  fullName: "",
  phoneNumber: "",
  documentType: undefined as DocumentType | undefined,
  documentNumber: "",
  clientType: "TRADICIONAL" as ClientType,
  department: "",
  province: "",
  district: "",
  address: "",
  reference: "",
  latitude: "",
  longitude: "",
  googleMapsUrl: "",
};

function RegistrarVentaContent() {
  /* ---------------- Params ---------------- */
  const searchParams = useSearchParams();
  const router = useRouter();
  const orderId = searchParams.get("orderId");
  const leadId = searchParams.get("leadId");
  const [commercialLead, setCommercialLead] = useState<LeadDetail | null>(null);
  const [leadLoading, setLeadLoading] = useState(false);
  const [loadedLeadScope, setLoadedLeadScope] = useState("");
  const [leadError, setLeadError] = useState("");
  const [leadCurrency, setLeadCurrency] = useState("");
  const [leadCollectionCondition, setLeadCollectionCondition] = useState<
    "COD" | "PREPAID" | ""
  >("");
  const moneyPrefix = leadId ? leadCurrency || "Moneda" : "S/";
  const [leadPaymentRows, setLeadPaymentRows] = useState<LeadPayment[]>([]);
  const leadApproved = leadPaymentRows
    .filter((p) => p.status === "PAID" && p.currency === leadCurrency)
    .reduce((sum, p) => sum + Number(p.amount), 0);
  const leadPending = leadPaymentRows
    .filter((p) => p.status === "PENDING" && p.currency === leadCurrency)
    .reduce((sum, p) => sum + Number(p.amount), 0);
  const [leadAttemptFrozen, setLeadAttemptFrozen] = useState(false);
  const leadRequestRef = useRef(0);
  const leadAttemptRef = useRef<ConfirmCommercialLeadInput | null>(null);
  const isPromo = searchParams.get("isPromo") === "true";
  // A dónde volver tras actualizar (p. ej. Por Despachar al editar el tipo de
  // entrega para generar guía). Solo rutas internas: evita open redirects.
  const rawReturnTo = searchParams.get("returnTo");
  const returnTo =
    orderId &&
    rawReturnTo &&
    rawReturnTo.startsWith("/") &&
    !rawReturnTo.startsWith("//") &&
    !rawReturnTo.includes("\\")
      ? rawReturnTo
      : null;

  /* ---------------- Cliente ---------------- */
  const [clientFound, setClientFound] = useState<Client | null>(null);
  const [searchState, setSearchState] = useState<ClientSearchState>("idle");
  const [loadingClient, setLoadingClient] = useState(false);
  const [originalClient, setOriginalClient] = useState<Client | null>(null);
  const [clientForm, setClientForm] = useState(emptyClientForm);
  const [clientErrors, setClientErrors] = useState<
    Partial<Record<keyof typeof emptyClientForm, string>>
  >({});
  const mapsLinkStatus = !clientForm.googleMapsUrl.trim()
    ? null
    : extractLatLngFromGoogleMapsUrl(clientForm.googleMapsUrl)
      ? "ok"
      : "unrecognized";

  const handleMapsLinkChange = (value: string) => {
    const coords = value.trim() ? extractLatLngFromGoogleMapsUrl(value) : null;
    setClientForm((prev) => ({
      ...prev,
      googleMapsUrl: value,
      ...(coords ? { latitude: String(coords.lat), longitude: String(coords.lng) } : {}),
    }));
  };

  /* ---------------- Productos ---------------- */
  const [productQuery, setProductQuery] = useState("");
  const [products, setProducts] = useState<InventoryItemForSale[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productsPage, setProductsPage] = useState(1);
  const [productsMeta, setProductsMeta] = useState<{
    total: number;
    totalPages: number;
  } | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [trackingLookupError, setTrackingLookupError] = useState("");
  const [trackingLookupRetry, setTrackingLookupRetry] = useState(0);
  const [pendingTrackedSale, setPendingTrackedSale] = useState<PendingSaleOperation | null>(null);
  const [productFrequencies, setProductFrequencies] = useState<Record<string, number>>({});

  /* ---------------- Detalles ---------------- */

  const [orderDetails, setOrderDetails] = useState({
    orderType: OrderType.VENTA as OrderType | undefined,
    salesChannel: undefined as SalesChannel | undefined,
    salesChannelId: undefined as string | undefined,
    closingChannel: undefined as SalesChannel | undefined,
    deliveryType: DeliveryType.DOMICILIO as DeliveryType | undefined,
    entregaEn: "DOMICILIO" as "DOMICILIO" | "SUCURSAL" | undefined,
    enviaPor: undefined as string | undefined,
    notes: "",
  });
  const [salesRegion, setSalesRegion] = useState<"LIMA" | "PROVINCIA">("LIMA");

  /* ---------------- Programar envío ----------------
     Mismo mecanismo que "Reprogramar" en Pedidos (RescheduleDialog /
     handleRescheduleConfirm en PedidosContent.tsx): PATCH con
     `callbackAt` + `callStatus: "SCHEDULED"`. Acá se aplica automáticamente
     apenas se crea la orden — sin ese paso manual extra — para que el
     pedido no aparezca en "Por Despachar" de hoy sino recién ese día,
     marcado como Reprogramado. */
  const [scheduleDelivery, setScheduleDelivery] = useState(false);
  const [scheduledDeliveryDate, setScheduledDeliveryDate] = useState("");

  /* ---------------- Ubigeo Options ---------------- */
  const departmentOptions = useMemo(() => {
    return (ubigeos[0] as any).departments.map((d: any) => ({
      value: d.name,
      label: d.name,
    }));
  }, []);

  const provinceOptions = useMemo(() => {
    const dept = (ubigeos[0] as any).departments.find((d: any) => d.name === clientForm.department);
    return (dept?.provinces || []).map((p: any) => ({
      value: p.name,
      label: p.name,
    }));
  }, [clientForm.department]);

  const districtOptions = useMemo(() => {
    const dept = (ubigeos[0] as any).departments.find((d: any) => d.name === clientForm.department);
    const prov = dept?.provinces.find((p: any) => p.name === clientForm.province);
    return (prov?.districts || []).map((dist: any) => ({
      value: dist,
      label: dist,
    }));
  }, [clientForm.department, clientForm.province]);

  /* ---------------- Pago ---------------- */
  const [paymentMethod, setPaymentMethod] = useState("");
  const [shippingTotal, setShippingTotal] = useState(0);
  const [shippingTotalDisplay, setShippingTotalDisplay] = useState(""); // Para manejar input con decimales
  const [advancePayment, setAdvancePayment] = useState(0);
  const [advancePaymentDisplay, setAdvancePaymentDisplay] = useState(""); // Para manejar input con decimales
  // Monto ya aprobado (pagos PAID) de una orden en edición: NO es editable y no
  // se arrastra al campo "Adelanto de Pago" (que solo representa lo PENDING/nuevo).
  const [montoYaAprobado, setMontoYaAprobado] = useState(0);
  // Snapshot del pago precargado en modo edición, para detectar si el usuario lo
  // modificó y evitar disparar la lógica de pagos de updateFull (§6.5) sin cambios.
  const [prefilledPayment, setPrefilledPayment] = useState<{
    amount: number;
    method: string;
  } | null>(null);
  // Cantidad de pagos PENDING de la orden en edición. updateFull §6.5 solo aplica
  // paymentAmount sobre UN pago PENDING (el más antiguo); con 2+ el campo
  // "Adelanto" se bloquea y se deriva la gestión a Finanzas.
  const [pendingPaymentsCount, setPendingPaymentsCount] = useState(0);

  const [taxMode, setTaxMode] = useState<"AUTOMATICO" | "INCLUIDO">("INCLUIDO");
  const [paymentProofFile, setPaymentProofFile] = useState<File | null>(null);
  const [paymentProofPreview, setPaymentProofPreview] = useState<string | null>(null);
  const paymentProofInputRef = useRef<HTMLInputElement>(null);
  const [selectedProofPaymentId, setSelectedProofPaymentId] = useState("");
  const [pendingProofUpload, setPendingProofUpload] = useState<SavedOrderProof | null>(null);

  /* ---------------- Modal ---------------- */

  const [receiptOrderId, setReceiptOrderId] = useState("");
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [leadPaymentOpen, setLeadPaymentOpen] = useState(false);
  const paymentRefreshRequest = useRef(0);
  const activePaymentsScope = useRef("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSubmittingRef = useRef(false);
  const editorActive = useRef(true);

  useEffect(() => {
    editorActive.current = true;
    return () => { editorActive.current = false; };
  }, []);

  /* ---------------- Modal ---------------- */
  const [orderData, setOrderData] = useState<OrderHeader | null>(null);
  const [orderPayments, setOrderPayments] = useState<OrderHeader["payments"]>([]);
  const unitSelectionLocked = Boolean(orderData && ["PREPARADO", "LLAMADO", "ASIGNADO_A_GUIA", "EN_ENVIO", "ENTREGADO", "ANULADO"].includes(orderData.status));
  const activeProofPayments = orderPayments.filter(
    (payment) => payment.status !== "LOST",
  );
  const pendingProofPayments = activeProofPayments.filter(
    (payment) => payment.status === "PENDING",
  );
  const proofPaymentId =
    selectedProofPaymentId ||
    (pendingProofPayments.length === 1
      ? pendingProofPayments[0].id
      : pendingProofPayments.length === 0 && advancePayment > 0
        ? "new"
        : activeProofPayments.length === 1
          ? activeProofPayments[0].id
          : "");
  const [orderLoadError, setOrderLoadError] = useState(false);
  const [orderLoading, setOrderLoading] = useState(false);
  const orderRequest = useRef<AbortController | null>(null);
  const productRequest = useRef<AbortController | null>(null);

  /* ---------------- Meta Publi ID ---------------- */
  const [metaPubliId, setMetaPubliId] = useState("");

  const { auth, hasPermission } = useAuth();
  const usesLeadPayments = !!leadId || orderData?.commercialStage === "LEAD";
  const canRecordOrderPayment = hasPermission("CREATE_SALE") || hasPermission("APPROVE_PAYMENTS");

  const companyId = auth?.company?.id;
  const userId = auth?.user.id;
  const trackedSaleKey = saleOperationKey(companyId ?? "", userId ?? "", orderId);
  useEffect(() => {
    if (companyId && userId) setPendingTrackedSale(readSaleOperation(trackedSaleKey));
  }, [companyId, userId, trackedSaleKey]);
  const hasSession = Boolean(auth?.accessToken);
  const saleContext = useQuery({
    queryKey: ["sale-context", auth?.user.id, companyId],
    queryFn: ({ signal }) => fetchSaleContext(companyId!, signal),
    enabled: Boolean(auth?.accessToken && companyId),
    staleTime: 30_000,
    retry: false,
  });
  const stores = saleContext.data?.stores ?? [];
  const inventories = saleContext.data?.inventories ?? [];
  const origin = useSaleOrigin({
    scope: `${auth?.user.id ?? ""}:${companyId ?? ""}:${orderId ?? "new"}`,
    editing: Boolean(orderId),
    saved: orderData,
    stores,
    inventories,
  });
  const selectedInventory = origin.catalogInventoryId;
  const actorScope = `${userId ?? ""}:${companyId ?? ""}`;
  const leadContextScope = saleContext.data ? stores.map((store) => store.id).sort().join(",") : null;
  const unknownVariantIds = Array.from(new Set(cart.filter((line) => line.trackingMode === "UNKNOWN").map((line) => line.variantId))).sort().join(",");
  useEffect(() => {
    const controller = new AbortController();
    setTrackingLookupError("");
    if (!unknownVariantIds || !companyId || !selectedInventory) return;
    Promise.all(unknownVariantIds.split(",").map((variantId) => getSaleUnits({ variantId, inventoryId: selectedInventory, orderId: orderId ?? undefined, limit: 1 }, controller.signal)))
      .then((results) => {
        if (controller.signal.aborted) return;
        const modes = new Map(results.map((result) => [result.variantId, result.trackingMode]));
        setCart((lines) => lines.map((line) => line.trackingMode === "UNKNOWN" && modes.has(line.variantId) ? { ...line, trackingMode: modes.get(line.variantId) } : line));
      })
      .catch((error) => { if (!controller.signal.aborted) setTrackingLookupError(trackingError(error, "No se pudo verificar el seguimiento de los productos.")); });
    return () => controller.abort();
  }, [unknownVariantIds, companyId, selectedInventory, orderId, trackingLookupRetry]);
  const productDebounceInventory = useRef("");
  const warehouseOptions = inventories.map((inventory) => ({
    id: inventory.id,
    name: inventories.some((other) => other.id !== inventory.id && other.name === inventory.name)
      ? `${inventory.name} · ${stores.find((store) => store.id === inventory.storeId)?.name ?? "Almacén de la empresa"}`
      : inventory.name,
  }));
  const salesChannels = auth?.company?.sales_channels?.length
    ? auth.company.sales_channels
    : DEFAULT_SALES_CHANNELS;
  // Los canales de cierre usan la misma lista que los canales de venta
  const closingChannels = salesChannels;
  const storeChannels = useMemo(
    () =>
      (saleContext.data?.channels ?? []).filter(
        (channel) => channel.storeId === origin.storeId && channel.isActive !== false,
      ),
    [saleContext.data?.channels, origin.storeId],
  );
  const hasValidSalesChannel = hasSaleChannelSelection({
    channels: storeChannels,
    selectedId: orderDetails.salesChannelId,
    legacyType: orderDetails.salesChannel,
    editing: Boolean(orderId),
    fixedId: orderData?.salesChannelId,
  });

  useEffect(() => {
    const request = ++leadRequestRef.current;
    setCommercialLead(null);
    setLoadedLeadScope("");
    setLeadError("");
    setLeadCurrency("");
    setLeadCollectionCondition("");
    setLeadPaymentRows([]);
    setLeadAttemptFrozen(false);
    leadAttemptRef.current = null;
    if (!leadId || !companyId || !hasSession || !saleContext.data) {
      setLeadLoading(false);
      return;
    }
    setLeadLoading(true);
    if (orderId) {
      setLeadError("Abre el Lead o su pedido por separado.");
      setLeadLoading(false);
      return;
    }
    (async () => {
      try {
        const [capabilities, confirmation] = await Promise.all([
          getCommercialLeadCapabilities(),
          getCommercialLeadConfirmationCapabilities(),
        ]);
        if (
          !capabilities.enabled ||
          !capabilities.canView ||
          !confirmation.enabled ||
          !confirmation.canConfirm
        )
          throw new Error(
            "No tienes habilitada la confirmación de compras de Leads.",
          );
        const [lead, context] = await Promise.all([
          getCommercialLead(leadId),
          getCommercialLeadContext(leadId),
        ]);
        if (request !== leadRequestRef.current) return;
        if (
          lead.companyId !== companyId ||
          (lead.storeId && !saleContext.data?.stores.some((store) => store.id === lead.storeId))
        )
          throw new Error(
            "Selecciona la empresa y tienda del Lead antes de continuar.",
          );
        if (
          lead.status === "CONVERTIDO" ||
          lead.status === "PERDIDO" ||
          lead.legacyOrderId ||
          lead.convertedOrderId ||
          context.order
        )
          throw new Error(
            "Este Lead ya tiene un pedido o está cerrado. Revísalo desde la bandeja sin crear otro pedido.",
          );
        if (context.quotationId || context.liveCheckoutId)
          throw new Error(
            "Completa la cotización o el checkout de origen desde la bandeja para conservar su pago y reservas.",
          );
        const payments = await getLeadPayments(lead.id);
        if (request !== leadRequestRef.current) return;
        if (lead.storeId) origin.chooseStore(lead.storeId);
        setCommercialLead(lead);
        setLoadedLeadScope(actorScope);
        setLeadCurrency(lead.currency ?? "");
        setLeadPaymentRows(payments.data);
        setClientFound(null);
        setOriginalClient(null);
        setSearchState("not_found");
        setClientForm({
          ...emptyClientForm,
          fullName: lead.contactName ?? "",
          phoneNumber: lead.contactPhone ?? "",
        });
        setCart([]);
        setAdvancePayment(0);
        setAdvancePaymentDisplay("");
        setPaymentProofFile(null);
      } catch (error) {
        if (request === leadRequestRef.current)
          setLeadError(commercialLeadError(error));
      } finally {
        if (request === leadRequestRef.current) setLeadLoading(false);
      }
    })();
    return () => {
      ++leadRequestRef.current;
    };
  }, [leadId, orderId, companyId, userId, hasSession, leadContextScope, actorScope]);

  /* ---------------- Couriers ---------------- */
  const { couriers, loading: isLoadingCouriers, error: couriersError, retry: retryCouriers } = useCompanyCouriers();

  const isIdle = searchState === "idle";
  const isFound = searchState === "found";
  const isNotFound = searchState === "not_found";
  const isSearchError = searchState === "error";

  const formEnabled = !isIdle;

  const loadOrder = useCallback(async () => {
    orderRequest.current?.abort();
    setOrderData(null);
    setOrderLoadError(false);
    if (!orderId || !companyId || !userId || !hasSession) return;
    const request = new AbortController();
    orderRequest.current = request;
    setOrderLoading(true);
    try {
      const response = await axiosAuth.get(`${GATEWAY.ventas}/order-header/manual/${orderId}`, {
        signal: request.signal,
      });
      if (!request.signal.aborted) setOrderData(response.data);
    } catch {
      if (!request.signal.aborted) setOrderLoadError(true);
    } finally {
      if (!request.signal.aborted) setOrderLoading(false);
    }
  }, [orderId, companyId, userId, hasSession]);

  useEffect(() => {
    void loadOrder();
    return () => orderRequest.current?.abort();
  }, [loadOrder]);

  useEffect(() => {
    if (!orderData) return;
    setSelectedProofPaymentId("");

    // --- Cliente ---
    const cust = orderData.customer;
    setClientFound(cust);
    setOriginalClient(cust);
    setClientForm(clientToFormFields(cust));
    setSearchState("found");

    // --- Detalles de la venta ---
    setOrderDetails({
      orderType: orderData.orderType as OrderType,
      salesChannel: orderData.salesChannel as SalesChannel,
      salesChannelId: orderData.salesChannelId ?? undefined,
      closingChannel: orderData.closingChannel as SalesChannel,
      deliveryType: orderData.deliveryType as DeliveryType,
      entregaEn: orderData.deliveryType === "RETIRO_TIENDA" ? "SUCURSAL" : "DOMICILIO",
      enviaPor: orderData.courier ?? undefined,
      notes: orderData.notes ?? "",
    });

    setSalesRegion(orderData.salesRegion);

    // --- Programar envío (si el pedido ya venía reprogramado) ---
    if (orderData.callStatus === "SCHEDULED" && orderData.callbackAt) {
      setScheduleDelivery(true);
      setScheduledDeliveryDate(isoToDateValue(orderData.callbackAt));
    } else {
      setScheduleDelivery(false);
      setScheduledDeliveryDate("");
    }

    // --- Costo de envío ---
    const shippingValue = Number(orderData.shippingTotal) || 0;
    setShippingTotal(shippingValue);
    setShippingTotalDisplay(shippingValue === 0 ? "" : String(shippingValue));

    // --- Productos ---
    const mappedCart: CartItem[] = orderData.items.map((item) => {
      const grossUnit = Number(item.unitPrice);
      const totalDiscount = Number(item.discountAmount) || 0;
      const netUnit =
        item.quantity > 0
          ? Math.max(0, Math.round((grossUnit - totalDiscount / item.quantity) * 100) / 100)
          : grossUnit;

      return {
        id: crypto.randomUUID(),
        inventoryItemId: item.productVariantId,
        variantId: item.productVariantId,
        trackingMode: item.trackingMode ?? (orderData.unitCatalogValidated === false ? "UNKNOWN" : undefined),
        unitIds: item.unitIds,
        units: item.units,
        productName: item.productName,
        sku: item.sku,
        imageUrl: item.imageUrl,
        attributes: item.attributes,
        quantity: item.quantity,
        price: netUnit,
        pvp: grossUnit,
        discount: totalDiscount, // informativo/legado; buildOrderItem deriva el descuento del precio de cierre
        packId: null,
      };
    });
    setCart(mappedCart);

    // --- Modo de impuestos ---
    if (orderData.taxMode) {
      setTaxMode(orderData.taxMode as "AUTOMATICO" | "INCLUIDO");
    }

    setOrderPayments(orderData.payments ?? []);
  }, [orderData]);

  // Refresh payment totals without replacing unsaved customer, cart or delivery fields.
  useEffect(() => {
    if (orderPayments.length) {
      // Orden determinístico por fecha de creación ascendente: el backend
      // updateFull §6.5 opera sobre el pago PENDING más antiguo, así que la
      // precarga del método debe seguir el mismo criterio.
      const paymentsByDate = [...orderPayments].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      );

      // Monto ya aprobado (PAID): informativo, no editable desde este form.
      const montoAprobado = paymentsByDate
        .filter((p) => p.status === "PAID")
        .reduce((sum, p) => sum + Number(p.amount), 0);

      // Monto pendiente de aprobación (PENDING): es lo único que el campo
      // editable "Adelanto de Pago" representa.
      const pendientes = paymentsByDate.filter((p) => p.status === "PENDING");
      const montoPendiente = pendientes.reduce((sum, p) => sum + Number(p.amount), 0);

      setMontoYaAprobado(montoAprobado);
      setPendingPaymentsCount(pendientes.length);
      setAdvancePayment(montoPendiente);
      setAdvancePaymentDisplay(montoPendiente === 0 ? "" : String(montoPendiente));

      // Método de referencia: el del pago PENDING más antiguo; si no hay, el
      // del primer pago registrado.
      const referencePayment = pendientes[0] ?? paymentsByDate[0];
      const prefilledMethod = referencePayment?.paymentMethod ?? "";
      if (prefilledMethod) {
        setPaymentMethod(prefilledMethod);
      }

      setPrefilledPayment({ amount: montoPendiente, method: prefilledMethod });
    } else {
      setMontoYaAprobado(0);
      setPendingPaymentsCount(0);
      setAdvancePayment(0);
      setAdvancePaymentDisplay("");
      setPaymentMethod("");
      setPrefilledPayment({ amount: 0, method: "" });
    }
  }, [orderPayments]);

  useEffect(() => {
    activePaymentsScope.current = `${actorScope}:${orderId ?? ""}`;
    paymentRefreshRequest.current += 1;
    setLeadPaymentOpen(false);
    return () => {
      activePaymentsScope.current = "";
      paymentRefreshRequest.current += 1;
    };
  }, [orderId, actorScope]);

  const refreshOrderPayments = async () => {
    if (!orderId) return;
    const scope = `${actorScope}:${orderId}`;
    const request = ++paymentRefreshRequest.current;
    try {
      const response = await axiosAuth.get<OrderHeader>(`${GATEWAY.ventas}/order-header/${orderId}`);
      if (activePaymentsScope.current === scope && request === paymentRefreshRequest.current)
        setOrderPayments(response.data.payments ?? []);
    } catch {
      if (activePaymentsScope.current === scope && request === paymentRefreshRequest.current)
        toast.error("El pago ya está registrado. No se pudo actualizar el resumen de pagos.");
    }
  };

  useEffect(() => {
    if (searchState === "found" && clientFound) {
      setClientForm(clientToFormFields(clientFound));
    }
  }, [searchState, clientFound]);

  useEffect(() => {
    if (searchState === "not_found" && !leadId) {
      setClientForm({
        ...emptyClientForm,
        phoneNumber: clientForm.phoneNumber,
      });
    }
  }, [searchState, clientForm.phoneNumber]);

  useEffect(() => {
    productRequest.current?.abort();
    setProducts([]);
    setProductsMeta(null);
    setProductsLoading(false);
    return () => productRequest.current?.abort();
  }, [selectedInventory]);

  useEffect(() => {
    setProductFrequencies(getProductFrequencies(companyId));
  }, [companyId]);

  /* ---------------- Actions ---------------- */

  const searchProducts = useCallback(
    async (page = 1) => {
      if (!selectedInventory) return;
      productRequest.current?.abort();
      const request = new AbortController();
      productRequest.current = request;
      try {
        setProductsLoading(true);

        const res = await searchInventoryItems(
          {
            inventoryId: selectedInventory,
            companyId,
            q: productQuery || undefined,
            page,
            limit: 12,
          },
          request.signal,
        );
        if (request.signal.aborted) return;

        if (page === 1) {
          setProducts(res.data);
        } else {
          setProducts((prev) => [...prev, ...res.data]);
        }

        setProductsMeta({
          total: res.meta.total,
          totalPages: res.meta.totalPages,
        });
        setProductsPage(page);
      } catch (error) {
        if (request.signal.aborted) return;
        // Falla silenciosa para el usuario (no bloquea la pantalla), pero se
        // loguea para poder diagnosticar búsquedas que antes fallaban sin
        // dejar ningún rastro (ni en UI ni en consola).
        console.error("Error al buscar productos", error);
      } finally {
        if (!request.signal.aborted) setProductsLoading(false);
      }
    },
    [selectedInventory, productQuery, companyId],
  );

  const handleLoadMore = () => {
    if (productsLoading || !productsMeta || productsPage >= productsMeta.totalPages) return;
    searchProducts(productsPage + 1);
  };

  /* ---------------- Packs & Promos (solo UI) ---------------- */
  const isAdmin = isSuperadmin(auth?.user?.email) || hasAdminAccess(auth?.user?.role);
  const { packs } = usePacks();

  const getVariantsForProduct = useCallback(
    async (productName: string) => {
      if (!selectedInventory) return [];
      const res = await searchInventoryItems({
        inventoryId: selectedInventory,
        companyId,
        q: productName,
        page: 1,
        limit: 100,
      });
      return res.data.filter((i) => i.productName === productName);
    },
    [selectedInventory, companyId],
  );

  const packsEngine = usePacksEngine({
    packs,
    channel: orderDetails.salesChannel,
    cart,
    setCart,
    getVariantsForProduct,
  });

  const qtyInCartByVariant = useCallback(
    (variantId: string) =>
      cart
        .filter((l) => l.variantId === variantId && !l.isGift)
        .reduce((a, l) => a + l.quantity, 0),
    [cart],
  );

  const handleAutoFillVolume = async (pack: Pack) => {
    if (pack.type !== "VOLUME") return;
    const falta = pack.minQty - packsEngine.modelQtyInCart(pack.product.productKey);
    if (falta <= 0) return;
    const variants = await getVariantsForProduct(pack.product.productKey);
    const best = variants.reduce<InventoryItemForSale | null>(
      (a, b) => (b.availableStock > (a?.availableStock ?? -1) ? b : a),
      null,
    );
    if (!best) {
      toast.error("No hay variantes disponibles para este producto");
      return;
    }
    addVariantQty(best, falta);
    toast.success("Unidades agregadas — ya califica el pack");
  };

  const handleAutoAddBundleItem = async (productKey: string) => {
    const variants = await getVariantsForProduct(productKey);
    const best = variants.reduce<InventoryItemForSale | null>(
      (a, b) => (b.availableStock > (a?.availableStock ?? -1) ? b : a),
      null,
    );
    if (!best) {
      toast.error("No hay variantes disponibles para este producto");
      return;
    }
    addToCart(best);
    toast.success(`${best.productName} agregado`);
  };

  const handleUndoPack = (packId: string) => {
    packsEngine.undoPack(packId);
    toast.success("Promo deshecha");
  };

  const handleApplyPack = (pack: Pack) => {
    packsEngine.applyPack(pack);
    if (pack.type !== "VOLUME" || !pack.variantFree) {
      if (pack.type !== "GIFT") toast.success(`${pack.name} aplicado`);
    }
  };

  const handlePvsConfirm = () => {
    if (unitSelectionLocked && packsEngine.pvsOpen?.variants.some((variant) => isTracked(variant.trackingMode))) { toast.error("La selección de unidades ya no se puede cambiar en este estado."); return; }
    const ok = packsEngine.pvsConfirm();
    if (ok) toast.success("Pack aplicado");
    else
      toast.error(
        `Asigna ${(packs.find((p) => p.id === packsEngine.pvsOpen?.packId) as VolumePack | undefined)?.minQty ?? 0} unidades`,
      );
  };

  const handleChooseGift = async (packId: string, gift: GiftOption) => {
    const session = tokenStore.snapshot();
    try {
      const variants = await getVariantsForProduct(gift.productName);
      if (!editorActive.current || !tokenStore.isCurrent(session)) return;
      const variant = variants.find((entry) => entry.variantId === gift.variantId);
      if (!variant) throw new Error("El regalo no está disponible en el almacén seleccionado.");
      if (unitSelectionLocked && isTracked(variant.trackingMode)) throw new Error("La selección de unidades ya no se puede cambiar en este estado.");
      packsEngine.chooseGift(packId, { ...gift, trackingMode: variant.trackingMode });
      toast.success(`Regalo: ${gift.productName}`);
    } catch (error) {
      if (editorActive.current && tokenStore.isCurrent(session)) toast.error(trackingError(error, "No se pudo consultar el regalo."));
    }
  };

  const searchClient = useCallback(async () => {
    const phone = clientForm.phoneNumber?.trim();
    if (!phone) return;

    if (!companyId) {
      console.warn("Company ID no disponible todavía");
      return;
    }

    setLoadingClient(true);
    setSearchState("idle");

    try {
      const client = await fetchClientByPhone(companyId, phone);

      if (client) {
        setClientFound(client);
        setSearchState("found");
        setOriginalClient(client);
      } else {
        setClientFound(null);
        setSearchState("not_found");
      }
    } catch {
      setClientFound(null);
      setSearchState("error");
      toast.error("No se pudo buscar el cliente. Intenta de nuevo.");
    } finally {
      setLoadingClient(false);
    }
  }, [clientForm.phoneNumber, companyId]);

  const clearClient = () => {
    setClientFound(null);
    setSearchState("idle");
    setClientForm(emptyClientForm);
    setOriginalClient(null);
  };

  const resetForm = () => {
    origin.reset();
    // Cliente
    setClientFound(null);
    setSearchState("idle");
    setClientForm(emptyClientForm);
    setOriginalClient(null);

    // Productos
    setProductQuery("");
    setProducts([]);
    setProductsMeta(null);
    setCart([]);

    // Detalles de orden
    setOrderDetails({
      orderType: undefined,
      salesChannel: undefined,
      salesChannelId: undefined,
      closingChannel: undefined,
      deliveryType: undefined,
      entregaEn: undefined,
      enviaPor: undefined,
      notes: "",
    });
    setSalesRegion("LIMA");
    setScheduleDelivery(false);
    setScheduledDeliveryDate("");

    // Pagos
    setPaymentMethod("");
    setShippingTotal(0);
    setShippingTotalDisplay("");
    setAdvancePayment(0);
    setAdvancePaymentDisplay("");
    setMontoYaAprobado(0);
    setPendingPaymentsCount(0);
    setPrefilledPayment(null);
    setPaymentProofFile(null);
    setPaymentProofPreview(null);
    setSelectedProofPaymentId("");
    setPendingProofUpload(null);
    if (paymentProofInputRef.current) paymentProofInputRef.current.value = "";
    setTaxMode("INCLUIDO");

    // Order data (para modo edición)
    setOrderData(null);

    // Meta Publi ID
    setMetaPubliId("");
  };

  // Auto-calcular salesRegion basándose en el departamento del cliente
  useEffect(() => {
    if (clientForm.department) {
      const autoRegion = clientForm.department.toUpperCase() === "LIMA" ? "LIMA" : "PROVINCIA";
      setSalesRegion(autoRegion);
    }
  }, [clientForm.department]);

  // Auto-cargar productos cuando cambia el inventario (instantáneo, sin debounce).
  // OJO: no incluir `searchProducts` en las deps — su identidad cambia en cada
  // tecleo (depende de productQuery), y eso disparaba este efecto en cada
  // keystroke, saltándose el debounce de abajo y generando una carrera de
  // requests que pisaban resultados más nuevos con respuestas más viejas.
  useEffect(() => {
    if (selectedInventory) {
      searchProducts(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedInventory]);

  // Búsqueda debounced cuando cambia el query del producto.
  // `productsLoading` se activa de inmediato (no recién cuando dispara el
  // fetch a los 500ms) para que la grilla se atenúe apenas se escribe y no
  // parezca que los resultados viejos siguen siendo válidos para el texto
  // nuevo justo antes de que la búsqueda real los reemplace.
  useEffect(() => {
    const inventoryChanged = productDebounceInventory.current !== selectedInventory;
    productDebounceInventory.current = selectedInventory;
    // The inventory effect already fetches immediately; this dependency
    // cancels the previous warehouse's timer without issuing a second fetch.
    if (!selectedInventory || inventoryChanged) return;
    setProductsLoading(true);
    const timer = setTimeout(() => {
      searchProducts(1);
    }, 500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productQuery, selectedInventory]);

  const clientDocumentErrors = validateClientDocument(
    clientForm.documentType,
    clientForm.documentNumber,
    salesRegion === "PROVINCIA",
  );
  const hasValidClientDistrict = !!clientForm.district.trim();
  const districtError = clientErrors.district ?? (
    isFound && !hasValidClientDistrict ? "Selecciona el distrito para continuar." : undefined
  );

  const validateClientForm = () => {
    const errors: Partial<Record<keyof typeof emptyClientForm, string>> = {
      ...clientDocumentErrors,
    };
    if (!clientForm.fullName.trim()) errors.fullName = "Debes completar este dato.";
    if (!clientForm.province.trim()) errors.province = "Debes completar este dato.";
    if (!clientForm.department.trim()) errors.department = "Debes completar este dato.";
    if (!hasValidClientDistrict) errors.district = "Selecciona el distrito para continuar.";
    if (!clientForm.address.trim()) errors.address = "Debes completar este dato.";

    setClientErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCreateClient = async () => {
    if (!auth?.company?.id) return;
    if (!validateClientForm()) {
      toast.error("Por favor completa los campos requeridos correctamente.");
      return;
    }

    try {
      const createdClient = await createClient({
        companyId: auth.company.id,
        fullName: clientForm.fullName,
        phoneNumber: clientForm.phoneNumber || undefined, // Evita "" que falla en backend
        documentType: clientForm.documentType,
        documentNumber: clientForm.documentType ? clientForm.documentNumber : undefined,
        clientType: clientForm.clientType,
        province: clientForm.province,
        city: clientForm.department,
        district: clientForm.district,
        address: clientForm.address,
        reference: clientForm.reference || undefined, // Evita "" que falla en backend
        latitude: clientForm.latitude ? Number(clientForm.latitude) : undefined,
        longitude: clientForm.longitude ? Number(clientForm.longitude) : undefined,
        googleMapsUrl: clientForm.googleMapsUrl || undefined,
      });
      setClientFound(createdClient);
      setOriginalClient(createdClient);
      setSearchState("found");
      setClientErrors({});
      toast.success("Cliente creado correctamente.");
    } catch {
      toast.error("Error al crear el cliente. Verifica los datos.");
    }
  };

  const uploadSavedOrderProof = async (
    context: SavedOrderProof,
    file: File,
    isCurrentEditor: () => boolean,
    savedPayments?: ProofPayment[],
  ) => {
    if (!isCurrentEditor()) return false;
    // Retain the saved sale and file so retrying never creates another payment.
    setPendingProofUpload(context);
    let paymentId = savedPayments
      ? resolvePaymentProofTarget(savedPayments, context)
      : undefined;
    if (!paymentId) {
      const fresh = await axiosAuth.get<{ payments?: ProofPayment[] }>(
        `${process.env.NEXT_PUBLIC_API_VENTAS}/order-header/${context.orderId}`,
      );
      if (!isCurrentEditor()) return false;
      paymentId = resolvePaymentProofTarget(fresh.data.payments ?? [], context);
    }
    if (!paymentId) throw new Error("No se pudo identificar el pago del comprobante");

    setPendingProofUpload({ ...context, paymentId });
    const formData = new FormData();
    formData.append("file", file);
    await axiosAuth.patch(
      `${process.env.NEXT_PUBLIC_API_VENTAS}/payments/payments/${paymentId}/upload-proof`,
      formData,
      { headers: { "Content-Type": "multipart/form-data" } },
    );
    return isCurrentEditor();
  };

  const handleConfirmSale = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    const submitSession = tokenStore.snapshot();
    const isCurrentEditor = () => editorActive.current && tokenStore.isCurrent(submitSession);
    if (!submitSession.active) {
      toast.error("La sesión está cambiando. Espera a que termine antes de guardar.");
      return;
    }

    if (
      !pendingProofUpload &&
      (!saleContext.data || saleContext.isError || !origin.hasStore || !origin.hasInventory)
    ) {
      toast.error(
        !origin.hasStore ? "Selecciona la tienda de la venta." : "Selecciona el almacén de salida.",
      );
      return;
    }
    if (!pendingProofUpload && orderId && !orderData) {
      toast.error("La venta aún no se ha cargado.");
      return;
    }
    if (!pendingProofUpload && !hasValidDelivery) {
      toast.error("Selecciona un método de envío disponible para esta empresa.");
      return;
    }
    if (!pendingProofUpload && !hasValidSalesChannel) {
      toast.error("Selecciona el canal de venta de esta tienda.");
      return;
    }

    if (pendingTrackedSale) return;
    if (!pendingProofUpload) {
      if (unknownVariantIds) { toast.error("Espera a que se verifique el seguimiento de los productos."); return; }
      const selectionError = validateSaleUnits(cart);
      if (selectionError) { toast.error(selectionError); return; }
    }

    // Guard: prevent double-click submission
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setIsSubmitting(true);

    try {
      // Cerrar cualquier Select/Popover abierto antes de iniciar el submit
      // para evitar que Radix quede en estado inconsistente si hay error
      (document.activeElement as HTMLElement)?.blur();

      if (pendingProofUpload) {
        if (!paymentProofFile) {
          toast.warning("El pedido ya está guardado. Selecciona el comprobante para reintentar la subida.");
          return;
        }
        try {
          if (!(await uploadSavedOrderProof(pendingProofUpload, paymentProofFile, isCurrentEditor))) return;
          toast.success("Comprobante guardado correctamente. El pedido ya estaba registrado.");
          const savedOrderId = pendingProofUpload.orderId;
          const savedLeadId = pendingProofUpload.commercialLeadId;
          if (pendingProofUpload.commercialStage === "LEAD") { notifyCommercialChange(companyId, savedLeadId ?? undefined); resetForm(); router.push(savedLeadId ? commercialLeadHref(savedLeadId) : "/leads-comerciales"); return; }
          resetForm();
          if (orderId && returnTo) {
            const sep = returnTo.includes("?") ? "&" : "?";
            router.replace(`${returnTo}${sep}updated=${encodeURIComponent(savedOrderId)}`);
            return;
          }
          setReceiptOrderId(savedOrderId);
          setReceiptOpen(true);
        } catch (error) {
          if (!isCurrentEditor()) return;
          console.error("Error reintentando guardar el comprobante", error);
          toast.error("El pedido ya está guardado. No se pudo subir el comprobante; vuelve a reintentarlo.");
        }
        return;
      }

      if (leadId && (!commercialLead || commercialLead.id !== leadId || commercialLead.companyId !== companyId || loadedLeadScope !== actorScope || (commercialLead.storeId && commercialLead.storeId !== origin.storeId) || leadLoading || leadError || !/^[A-Z]{3}$/.test(leadCurrency) || !leadCollectionCondition)) {
        toast.error("Revisa el Lead, su tienda, moneda y condición de cobro antes de confirmar.");
        return;
      }
      if ((!!leadId && (advancePayment > 0 || paymentProofFile)) || (orderData?.commercialStage === "LEAD" && paymentProofFile)) {
        toast.error("Gestiona los anticipos y comprobantes desde el Lead antes de confirmar.");
        return;
      }

      // Validate the current form even when the client already exists. Changing
      // province/department clears the district and must block all sale writes.
      if (!hasValidClientDistrict) {
        setClientErrors((errors) => ({
          ...errors,
          district: "Selecciona el distrito para continuar.",
        }));
        toast.error("Selecciona el distrito del cliente antes de confirmar la venta.");
        return;
      }

      let activeClient = clientFound;

      // Auto-crear cliente nuevo si no existe en el sistema (o si la búsqueda falló y se completó a mano)
      if (isNotFound || isSearchError) {
        if (!auth?.company?.id) return;
        if (!validateClientForm()) {
          toast.error("Por favor completa los campos del cliente correctamente.");
          return;
        }
        try {
          const createdClient = await createClient({
            companyId: auth.company.id,
            fullName: clientForm.fullName,
            phoneNumber: clientForm.phoneNumber || undefined,
            documentType: clientForm.documentType,
            documentNumber: clientForm.documentType ? clientForm.documentNumber : undefined,
            clientType: clientForm.clientType,
            province: clientForm.province,
            city: clientForm.department,
            district: clientForm.district,
            address: clientForm.address,
            reference: clientForm.reference || undefined,
            latitude: clientForm.latitude ? Number(clientForm.latitude) : undefined,
            longitude: clientForm.longitude ? Number(clientForm.longitude) : undefined,
            googleMapsUrl: clientForm.googleMapsUrl || undefined,
          });
          if (!isCurrentEditor()) return;
          setClientFound(createdClient);
          setOriginalClient(createdClient);
          setSearchState("found");
          setClientErrors({});
          activeClient = createdClient;
        } catch {
          if (!isCurrentEditor()) return;
          toast.error("Error al crear el cliente. Verifica los datos.");
          return;
        }
      }
      // Auto-guardar cambios del cliente si tiene modificaciones sin guardar
      else if (isFound && hasClientChanges && clientFound?.id) {
        try {
          const updated = await updateClient(clientFound.id, {
            companyId: auth?.company?.id,
            ...clientChanges,
          });
          if (!isCurrentEditor()) return;
          setClientFound(updated);
          setOriginalClient(updated);
          activeClient = updated;
        } catch (error) {
          if (!isCurrentEditor()) return;
          toast.error(clientSaveErrorMessage(error));
          return;
        }
      }

      if (!activeClient?.id) {
        console.error("❌ No hay customerId");
        toast.error("No se pudo identificar el cliente");
        return;
      }

      // Al crear: un comprobante solo se puede adjuntar a un pago, y no se crea
      // ningún pago si no hay adelanto (> 0). Se bloquea el submit para evitar
      // perder el comprobante en silencio.
      if (!orderData && paymentProofFile && advancePayment <= 0) {
        toast.warning(
          "Adjuntaste un comprobante pero no ingresaste un adelanto — el comprobante no se guardará.",
        );
        return;
      }

      if (orderData && paymentProofFile) {
        if (!proofPaymentId) {
          toast.warning("Selecciona a qué pago corresponde el comprobante.");
          return;
        }
        const target = activeProofPayments.find((payment) => payment.id === proofPaymentId);
        if ((proofPaymentId === "new" || target?.status === "PENDING") && advancePayment <= 0) {
          toast.warning("Ingresa un adelanto mayor a cero para guardar el comprobante de ese pago.");
          return;
        }
      }

      const sellerDisplayName = `${auth?.user?.name || ""} ${auth?.user?.surname || ""}`.trim();

      const payload = {
        // --- Comprobante ---
        receiptType: "BOLETA",
        orderType: orderDetails.orderType, // VENTA

        // --- Contexto ---
        storeId: origin.storeId,
        ...(selectedInventory ? { inventoryId: selectedInventory } : {}),

        // --- Canales ---
        salesChannel: orderDetails.salesChannel,
        ...(orderDetails.salesChannelId ? { salesChannelId: orderDetails.salesChannelId } : {}),
        currency: leadId ? leadCurrency : "PEN",
        closingChannel: orderDetails.closingChannel,
        deliveryType: orderDetails.deliveryType,
        salesRegion: salesRegion,

        // --- Envío ---
        shippingTotal: shippingTotal ?? 0,
        courier: orderDetails.enviaPor ?? null,
        sellerName: sellerDisplayName || null,

        // --- Modo de impuestos ---
        taxMode: taxMode,

        // --- Notas ---
        notes: orderDetails.notes ?? null,

        // --- Cliente ---
        customerId: activeClient.id,

        // --- Ítems ---
        items: cart.map(buildOrderItem),

        // The selected condition exists even when no payment has been collected.
        paymentCondition: leadId ? leadCollectionCondition : (["CONTRA_ENTREGA", "CONTRAENTREGA"].includes(paymentMethod) ? "COD" : "PREPAID"),

        // --- Pagos: solo se incluye si hay un adelanto real (> 0).
        //     Nunca se manda un pago fantasma { amount: 0 }. ---
        ...(!leadId && advancePayment > 0
          ? {
              payments: [
                {
                  paymentMethod,
                  amount: advancePayment,
                  paymentDate: new Date().toISOString(),
                },
              ],
            }
          : {}),

        // --- Usuario (para log de auditoría) ---
        userId: auth?.user?.id ?? null,

        // --- Meta Publi ID (opcional) ---
        ...(metaPubliId.trim() ? { metaPubliId: metaPubliId.trim() } : {}),
      };

      // Si se programó el envío para otra fecha, se aplica el mismo
      // mecanismo que "Reprogramar" en Pedidos (callbackAt + callStatus
      // SCHEDULED) — automático acá, sin el paso manual de ir a reprogramar
      // después de crear la venta.
      // Se ancla al mediodía local (no medianoche) para que la conversión a
      // UTC nunca corra la fecha elegida al día anterior/siguiente.
      const scheduledCallbackAt =
        !leadId && scheduleDelivery && scheduledDeliveryDate
          ? new Date(`${scheduledDeliveryDate}T12:00:00`).toISOString()
          : null;

      try {
        if (!isCurrentEditor()) return;
        if (leadId && commercialLead) {
          if (!leadAttemptRef.current) leadAttemptRef.current = {
            commandId: crypto.randomUUID(), version: commercialLead.version,
            order: JSON.parse(JSON.stringify(payload)),
          };
          setLeadAttemptFrozen(true);
          const confirmation = await confirmCommercialLead(commercialLead.id, leadAttemptRef.current);
          if (!isCurrentEditor()) return;
          notifyCommercialChange(companyId, commercialLead.id);
          toast.success(`Compra confirmada: ${confirmation.order.orderNumber}. Los anticipos conservan sus IDs.`);
          router.push(commercialLeadHref(commercialLead.id));
          return;
        }
        if (!orderId) {
          let createPayload: Record<string, unknown> = payload;
          if (cart.some((item) => isTracked(item.trackingMode))) {
            const operationId = crypto.randomUUID();
            createPayload = { ...payload, operationId };
            const operation: PendingSaleOperation = { operationId, method: "post", url: `${GATEWAY.ventas}/order-header/manual`, payload: createPayload };
            persistSaleOperation(trackedSaleKey, operation);
            setPendingTrackedSale(operation);
          }
          const response = await axiosAuth.post(`${GATEWAY.ventas}/order-header/manual`, createPayload);
          persistSaleOperation(trackedSaleKey, null);
          if (isCurrentEditor()) setPendingTrackedSale(null);
          if (!isCurrentEditor()) return;

          const createdOrderId = response.data.id;
          const createdAsLead = response.data.commercialStage === "LEAD";
          const recordedLabel = createdAsLead ? "Lead registrado" : "Venta registrada";

          let proofFailed = false;
          if (paymentProofFile && advancePayment > 0) {
            try {
              if (!(await uploadSavedOrderProof(
                { orderId: createdOrderId, previousPaymentIds: [], commercialStage: response.data.commercialStage, commercialLeadId: response.data.commercialLeadId },
                paymentProofFile,
                isCurrentEditor,
                response.data.payments,
              ))) return;
            } catch (error) {
              if (!isCurrentEditor()) return;
              console.error("Error guardando comprobante", error);
              proofFailed = true;
              toast.error(
                "El pedido se registró, pero el comprobante no se guardó. Conservamos el archivo para que puedas reintentar.",
              );
            }
          }

          if (scheduledCallbackAt) {
            try {
              await axiosAuth.patch(`${GATEWAY.ventas}/order-header/${createdOrderId}`, {
                callbackAt: scheduledCallbackAt,
                callStatus: "SCHEDULED",
              });
              if (!isCurrentEditor()) return;
              if (!proofFailed) {
                toast.success(
                  `${recordedLabel} y con seguimiento para el ${new Date(scheduledCallbackAt).toLocaleDateString("es-PE")}`,
                );
              }
            } catch {
              if (!isCurrentEditor()) return;
              toast.warning(`${recordedLabel}, pero no se pudo programar la fecha`);
            }
          } else if (!proofFailed) {
            toast.success(
              advancePayment > 0
                ? `${recordedLabel}. El adelanto quedó pendiente de aprobación en Finanzas.`
                : createdAsLead ? "Lead registrado. La compra queda pendiente de confirmación del vendedor." : recordedLabel,
            );
          }
          if (proofFailed) return;
          notifyCommercialChange(companyId, response.data.commercialLeadId);
          if (createdAsLead) { router.push(response.data.commercialLeadId ? commercialLeadHref(response.data.commercialLeadId) : "/leads-comerciales"); resetForm(); return; }
          setReceiptOrderId(createdOrderId);
          setReceiptOpen(true);
          resetForm();
        } else {
          if (!orderData) return;
          // Actualizar orden existente
          // El status solo se resetea a PENDIENTE si el usuario seleccionó manualmente el tipo CAMBIO
          const newStatus =
            orderDetails.orderType === OrderType.CAMBIO ? "PENDIENTE" : orderData.status;

          // Solo se mandan paymentMethod/paymentAmount si el usuario tocó el
          // pago respecto a lo precargado. Si no cambió, se omiten para no
          // disparar la manipulación de pagos de updateFull (§6.5).
          // NOTA: en la UI "Adelanto de Pago" (advancePayment) y
          // prefilledPayment.amount son pending-scoped (solo pagos PENDING).
          // El backend updateFull §6.5 espera `paymentAmount` como el TOTAL de
          // adelanto deseado para la orden (PAID + PENDING), así que al enviar
          // se reescala sumando montoYaAprobado.
          const round2 = (n: number) => Math.round(n * 100) / 100;
          // Con 2+ pagos PENDING, §6.5 solo tocaría el más antiguo y dejaría los
          // demás intactos → total incorrecto y silencioso. En ese caso el campo
          // "Adelanto" está bloqueado y nunca se manda info de pago.
          const paymentEditable = orderData.commercialStage !== "LEAD" && pendingPaymentsCount <= 1;
          const paymentChanged =
            paymentEditable &&
            (!prefilledPayment ||
              round2(advancePayment) !== round2(prefilledPayment.amount) ||
              (paymentMethod || "") !== prefilledPayment.method);

          const updatePayload = {
            orderType: orderDetails.orderType,
            status: newStatus,
            salesChannel: orderDetails.salesChannel,
            ...(!orderData.salesChannelId && orderDetails.salesChannelId
              ? { salesChannelId: orderDetails.salesChannelId }
              : {}),
            closingChannel: orderDetails.closingChannel,
            deliveryType: orderDetails.deliveryType,
            salesRegion: salesRegion,
            shippingTotal: shippingTotal ?? 0,
            courier: orderDetails.enviaPor ?? null,
            taxMode: taxMode,
            notes: orderDetails.notes ?? null,
            customerId: activeClient.id,
            items: cart.map((item) => ({
              ...buildOrderItem(item),
              // Campos de promo del día (solo para items nuevos cuando isPromo=true)
              isPromoItem: isPromo ? true : undefined,
              addedByUserId: isPromo ? auth?.user?.id : undefined,
              addedAt: isPromo ? new Date().toISOString() : undefined,
            })),
            userId: auth?.user?.id ?? null,
            // Datos de pago — solo si el usuario los modificó (ver paymentChanged).
            // paymentAmount se envía en la escala del backend (PAID + PENDING).
            ...(paymentChanged
              ? {
                  paymentMethod: paymentMethod || null,
                  paymentAmount: round2(montoYaAprobado + advancePayment),
                }
              : {}),
            sellerName: sellerDisplayName || null,
            // Solo se toca si se activó/mantuvo el toggle acá — si se
            // desactiva al editar no se limpia automáticamente, para no
            // pisar callStatus si lo estaba usando el flujo de llamadas.
            ...(scheduledCallbackAt
              ? { callbackAt: scheduledCallbackAt, callStatus: "SCHEDULED" }
              : {}),
          };

          let fullPayload: Record<string, unknown> = updatePayload;
          if (cart.some((item) => isTracked(item.trackingMode)) || orderData.items.some((item) => isTracked(item.trackingMode))) {
            const operationId = crypto.randomUUID();
            fullPayload = { ...updatePayload, operationId };
            const operation: PendingSaleOperation = { operationId, orderId: orderData.id, method: "put", url: `${GATEWAY.ventas}/order-header/manual/${orderData.id}/full`, payload: fullPayload };
            persistSaleOperation(trackedSaleKey, operation);
            setPendingTrackedSale(operation);
          }
          const response = await axiosAuth.put(
            `${GATEWAY.ventas}/order-header/manual/${orderData.id}/full`,
            fullPayload,
          );
          persistSaleOperation(trackedSaleKey, null);
          if (isCurrentEditor()) setPendingTrackedSale(null);
          if (!isCurrentEditor()) return;

          if (paymentProofFile) {
            try {
              if (!(await uploadSavedOrderProof(
                {
                  orderId: orderData.id,
                  paymentId: proofPaymentId === "new" ? undefined : proofPaymentId,
                  previousPaymentIds: orderPayments.map((payment) => payment.id),
                },
                paymentProofFile,
                isCurrentEditor,
                response.data?.payments,
              ))) return;
            } catch (error) {
              if (!isCurrentEditor()) return;
              console.error("Error guardando comprobante de la venta editada", error);
              toast.error(
                "La venta se actualizó, pero el comprobante no se guardó. Conservamos el archivo para que puedas reintentar.",
              );
              return;
            }
          }

          const updatedId = orderData.id;
          if (orderData.commercialStage === "LEAD") { notifyCommercialChange(companyId, orderData.commercialLeadId ?? undefined); toast.success("Datos del Lead actualizados. La compra sigue pendiente de confirmación."); router.push(orderData.commercialLeadId ? commercialLeadHref(orderData.commercialLeadId) : "/leads-comerciales"); return; }
          toast.success("Venta actualizada correctamente");
          resetForm();
          if (returnTo) {
            // `updated` solo se agrega acá, tras guardar con éxito: el
            // "Volver" del header usa el returnTo pelado y no anuncia nada.
            const sep = returnTo.includes("?") ? "&" : "?";
            router.replace(`${returnTo}${sep}updated=${encodeURIComponent(updatedId)}`);
            return;
          }
          setReceiptOrderId(updatedId);
          setReceiptOpen(true);
        }
      } catch (error) {
        if (!isCurrentEditor()) return;
        if (leadId) {
          if ((error as {response?: {status?: number}})?.response?.status === 409) { setLeadError("El Lead cambió mientras confirmabas. Revisa su estado y anticipos desde la bandeja."); notifyCommercialChange(companyId, leadId); }
          toast.error(commercialLeadError(error));
          return;
        }
        const pending = readSaleOperation(trackedSaleKey);
        if (pending && canCorrectTrackingRequest(error)) {
          const rejected = { ...pending, definitiveRejection: true };
          persistSaleOperation(trackedSaleKey, rejected);
          setPendingTrackedSale(rejected);
        }
        if (orderData) {
          // El form no se resetea en error: lo editado sigue cargado.
          const response = (error as {
            response?: { status?: number; data?: { message?: string | string[] } };
          })?.response;
          const apiMessage = response?.data?.message;
          const detail = Array.isArray(apiMessage) ? apiMessage.join(", ") : apiMessage;
          toast.error(
            response?.status === 401
              ? "Tu sesión venció y no se pudo renovar. Tus cambios siguen en el formulario. Inicia sesión en otra pestaña y vuelve a intentar guardar."
              : `No se pudo actualizar la venta${detail ? `: ${detail}` : ""}. Tus cambios siguen en el formulario; podés reintentar.`,
          );
        } else {
          toast.error(trackingError(error, "Error al registrar la venta. Si la operación quedó pendiente, consulta su resultado antes de volver a registrar."));
        }
      } finally {
        setIsSubmitting(false);
      }
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const addToCart = (product: InventoryItemForSale) => {
    if (unitSelectionLocked && isTracked(product.trackingMode)) { toast.error("La selección de unidades ya no se puede cambiar en este estado."); return; }
    setProductFrequencies(bumpProductFrequency(companyId, product.productName));
    setCart((prev) => {
      // Permitir ventas bajo pedido (stock negativo)
      // El badge "Sin stock - Venta bajo pedido" ya se muestra en el listado

      const existing = prev.find(
        (p) =>
          p.inventoryItemId === product.inventoryItemId &&
          p.variantId === product.variantId &&
          !p.packId &&
          !p.isGift,
      );

      if (existing) {
        return prev.map((p) => (p.id === existing.id ? { ...p, quantity: p.quantity + 1 } : p));
      }

      return [
        ...prev,
        {
          id: crypto.randomUUID(),
          inventoryItemId: product.inventoryItemId,
          variantId: product.variantId,
          trackingMode: product.trackingMode,
          productName: product.productName,
          sku: product.sku,
          imageUrl: product.imageUrl,
          attributes: product.attributes,
          quantity: 1,
          price: product.price,
          pvp: product.price,
          discount: 0,
          packId: null,
        },
      ];
    });
  };

  const addVariantQty = (product: InventoryItemForSale, qty: number) => {
    if (unitSelectionLocked && isTracked(product.trackingMode)) { toast.error("La selección de unidades ya no se puede cambiar en este estado."); return; }
    setCart((prev) => {
      const existing = prev.find(
        (p) =>
          p.inventoryItemId === product.inventoryItemId &&
          p.variantId === product.variantId &&
          !p.packId &&
          !p.isGift,
      );
      if (existing) {
        return prev.map((p) => (p.id === existing.id ? { ...p, quantity: p.quantity + qty } : p));
      }
      return [
        ...prev,
        {
          id: crypto.randomUUID(),
          inventoryItemId: product.inventoryItemId,
          variantId: product.variantId,
          trackingMode: product.trackingMode,
          productName: product.productName,
          sku: product.sku,
          imageUrl: product.imageUrl,
          attributes: product.attributes,
          quantity: qty,
          price: product.price,
          pvp: product.price,
          discount: 0,
          packId: null,
        },
      ];
    });
  };

  const removeFromCart = (cartItemId: string) => {
    if (unitSelectionLocked && isTracked(cart.find((line) => line.id === cartItemId)?.trackingMode)) { toast.error("La selección de unidades ya no se puede cambiar en este estado."); return; }
    setCart((prev) => prev.filter((item) => item.id !== cartItemId));
  };

  const handleCartQtyChange = (cartItemId: string, delta: number) => {
    if (unitSelectionLocked && isTracked(cart.find((line) => line.id === cartItemId)?.trackingMode)) { toast.error("La selección de unidades ya no se puede cambiar en este estado."); return; }
    setCart((prev) =>
      prev
        .map((p) => (p.id === cartItemId ? { ...p, quantity: p.quantity + delta } : p))
        .filter((p) => p.quantity > 0),
    );
  };

  const handleSetPrice = (cartItemId: string, price: number) => {
    const net = Math.round(price * 100) / 100;
    setCart((prev) =>
      prev.map((p) =>
        p.id === cartItemId ? { ...p, price: net, discMode: "man", discValue: net } : p,
      ),
    );
  };

  const handleApplyDiscount = (cartItemId: string, mode: "pct" | "amt", value: number) => {
    setCart((prev) =>
      prev.map((p) => {
        if (p.id !== cartItemId) return p;
        const pvp = p.pvp ?? p.price;
        const net = mode === "pct" ? pvp * (1 - value / 100) : pvp - value;
        return {
          ...p,
          price: Math.max(0, Math.round(net * 100) / 100),
          discMode: mode,
          discValue: value,
        };
      }),
    );
  };

  const handleClearDiscount = (cartItemId: string) => {
    setCart((prev) =>
      prev.map((p) =>
        p.id === cartItemId
          ? { ...p, price: p.pvp ?? p.price, discMode: null, discValue: null }
          : p,
      ),
    );
  };

  const editableCartLines = () => cart.filter((l) => !l.packId && !l.isGift);

  const handleBulkPrice = (price: number) => {
    const ids = new Set(editableCartLines().map((l) => l.id));
    const net = Math.round(price * 100) / 100;
    setCart((prev) =>
      prev.map((p) => (ids.has(p.id) ? { ...p, price: net, discMode: "man", discValue: net } : p)),
    );
    toast.success(`Precio S/ ${price.toFixed(2)} aplicado a ${ids.size} ítem(s)`);
  };

  const handleBulkDiscount = (pct: number) => {
    const ids = new Set(editableCartLines().map((l) => l.id));
    setCart((prev) =>
      prev.map((p) =>
        ids.has(p.id)
          ? {
              ...p,
              price: Math.max(0, Math.round((p.pvp ?? p.price) * (1 - pct / 100) * 100) / 100),
              discMode: "pct",
              discValue: pct,
            }
          : p,
      ),
    );
    toast.success(`${pct}% aplicado a ${ids.size} ítem(s)`);
  };

  const handleRestorePvp = () => {
    const ids = new Set(editableCartLines().map((l) => l.id));
    setCart((prev) =>
      prev.map((p) =>
        ids.has(p.id) ? { ...p, price: p.pvp ?? p.price, discMode: null, discValue: null } : p,
      ),
    );
    toast.success("Precios restaurados a PVP");
  };

  const handleUpdateClient = async () => {
    if (!clientFound?.id || !auth?.company?.id) return;

    try {
      const updated = await updateClient(clientFound.id, {
        companyId: auth.company.id,
        ...clientChanges,
      });

      setClientFound(updated);
      setOriginalClient(updated);
      toast.success("Cliente actualizado");
    } catch (error) {
      toast.error(clientSaveErrorMessage(error));
    }
  };

  /* ---------------- Totales ---------------- */
  // El bruto debe coincidir con lo enviado al backend, incluso cuando un
  // precio manual supera el PVP, para no compensar descuentos de otras líneas.
  const subtotalBruto = cart.reduce(
    (acc, p) => acc + getOrderItemPricing(p).unitPrice * p.quantity,
    0,
  );
  // Subtotal neto (precio de cierre real, después de descuentos/packs)
  const subtotal = cart.reduce((acc, p) => acc + p.price * p.quantity, 0);
  // Total de descuentos por item, derivado (bruto - neto)
  const totalItemDiscounts = Math.max(0, subtotalBruto - subtotal);
  // Si INCLUIDO, los precios ya incluyen impuestos
  const taxes = taxMode === "INCLUIDO" ? 0 : subtotal * 0.18;

  const grandTotal = subtotal + taxes + shippingTotal;

  const pendingPayment = Math.max(grandTotal - (leadId ? leadApproved : montoYaAprobado) - advancePayment, 0);

  /* ---------------- Validaciones ---------------- */

  const hasValidCart =
    cart.length > 0 && cart.every((item) => item.quantity > 0 && item.price >= 0);

  const hasValidDelivery =
    orderDetails.deliveryType === DeliveryType.RETIRO_TIENDA ||
    (orderDetails.deliveryType === DeliveryType.DOMICILIO && Boolean(orderDetails.enviaPor) &&
      (Boolean(orderId) || orderDetails.enviaPor === "OTROS" ||
        couriers.some((courier) => courier.name === orderDetails.enviaPor)));

  const hasValidPayments = !!leadId || orderData?.commercialStage === "LEAD" || !!paymentMethod;

  // La misma validación habilita la venta y valida clientes nuevos o encontrados.
  const hasValidDocumentForRegion = Object.keys(clientDocumentErrors).length === 0;

  // Los clientes nuevos requieren todos los datos mínimos; el distrito actual
  // también es obligatorio para clientes existentes.
  const hasValidClientForNew =
    (isNotFound || isSearchError) &&
    !!clientForm.fullName.trim() &&
    !!clientForm.province.trim() &&
    !!clientForm.department.trim() &&
    hasValidClientDistrict &&
    !!clientForm.address.trim();
  const hasValidClient = (!!clientFound || hasValidClientForNew) && hasValidClientDistrict;

  const canSubmit =
    (!leadId || (!!commercialLead && commercialLead.id === leadId && loadedLeadScope === actorScope && !leadLoading && !leadError && (!commercialLead.storeId || commercialLead.storeId === origin.storeId) && /^[A-Z]{3}$/.test(leadCurrency) && !!leadCollectionCondition)) &&
    !!saleContext.data &&
    !saleContext.isError &&
    origin.hasStore &&
    origin.hasInventory &&
    (!orderId || !!orderData) &&
    hasValidClient &&
    hasValidDocumentForRegion &&
    hasValidCart &&
    !validateSaleUnits(cart) &&
    !unknownVariantIds &&
    !pendingTrackedSale &&
    !!orderDetails.orderType &&
    hasValidSalesChannel &&
    !!orderDetails.closingChannel &&
    hasValidDelivery &&
    hasValidPayments &&
    !packsEngine.pvsOpen;

  const checklist = [
    { ok: origin.hasStore, msg: "Selecciona la tienda de la venta" },
    { ok: origin.hasInventory, msg: "Selecciona el almacén de salida" },
    { ok: hasValidCart, msg: "Agrega al menos un producto al carrito" },
    ...(cart.some((line) => isTracked(line.trackingMode)) ? [{ ok: !validateSaleUnits(cart), msg: validateSaleUnits(cart) || "IMEI/series seleccionados" }] : []),
    {
      ok: hasValidClient,
      msg: formEnabled && !hasValidClientDistrict
        ? "Selecciona el distrito del cliente"
        : "Completa los datos del cliente (nombre, dirección y distrito)",
    },
    {
      ok: hasValidDocumentForRegion,
      msg: "Completa el documento de identidad del cliente (obligatorio para ventas de provincia)",
    },
    { ok: !!orderDetails.orderType, msg: "Selecciona el tipo de orden" },
    { ok: hasValidSalesChannel, msg: "Selecciona el canal de venta de esta tienda" },
    { ok: !!orderDetails.closingChannel, msg: "Selecciona el canal de cierre" },
    { ok: hasValidDelivery, msg: "Configura el método de entrega" },
    { ok: hasValidPayments, msg: "Selecciona el método de pago" },
  ];
  const checklistDone = checklist.filter((c) => c.ok).length;
  const checklistPct = Math.round((checklistDone / checklist.length) * 100);

  const clientChanges = originalClient ? buildClientUpdatePayload(originalClient, clientForm) : {};
  const hasClientChanges = Object.keys(clientChanges).length > 0;

  if (!auth) return null;

  return (
    <div className="flex h-screen w-full [--primary:#6D4FE0] [--primary-foreground:#ffffff] [--ring:#8067F0] dark:[--primary:#9B85FF] dark:[--ring:#8A72F5]">
      <main className="flex-1 overflow-auto bg-gradient-to-b from-muted/40 to-transparent">
        {pendingTrackedSale && <PendingSaleRecovery operation={pendingTrackedSale} storageKey={trackedSaleKey} disabled={isSubmitting} onCorrect={() => setPendingTrackedSale(null)} onResolved={(saved) => {
          setPendingTrackedSale(null);
          toast.success("Venta recuperada. Revisa la confirmación de sus unidades.");
          if (paymentProofFile) toast.info("Vuelve a adjuntar el comprobante de pago si aún no se guardó.");
          if (orderId === saved.id) setOrderData(saved);
          else router.replace(`/registrar-venta?orderId=${encodeURIComponent(saved.id)}`);
        }} />}
        <fieldset disabled={Boolean(pendingTrackedSale)} className={pendingTrackedSale ? "pointer-events-none opacity-60" : ""}>

        <div className="mx-auto max-w-[1400px] p-6 space-y-6 lg:p-8">
          {/* Header */}
          <div className="flex items-center gap-4">
            <Link href={returnTo ?? "/ventas"}>
              <Button variant="outline" size="sm" className="rounded-full">
                <ArrowLeft className="h-4 w-4 mr-1" />
                Volver
              </Button>
            </Link>
            <HeaderConfig title={leadId ? "Confirmar compra del Lead" : orderData?.commercialStage === "LEAD" ? "Editar pedido del Lead" : "Registrar pedido"} description={leadId ? "Confirma la compra acordada con el cliente" : "La venta requiere confirmación de compra del vendedor"} />
          </div>

          {returnTo && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-500/10 dark:text-amber-400">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Editá el <b>tipo de entrega</b> en &quot;Detalles de la venta&quot; y guardá con
                &quot;Actualizar venta&quot;. Al guardar volverás a Por Despachar con tu selección
                para revisar la generación de guía; la guía no se genera automáticamente. Si tocás
                &quot;Volver&quot; sin guardar, no se aplica ningún cambio.
              </span>
            </div>
          )}

          {orderId && orderLoadError && (
            <div
              role="alert"
              className="flex items-center justify-between gap-3 rounded-lg border border-destructive/30 p-3 text-sm"
            >
              <span>No se pudo cargar la venta.</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void loadOrder()}
                disabled={orderLoading}
              >
                Reintentar
              </Button>
            </div>
          )}

          {leadId && (
            <div
              role={leadError ? "alert" : "status"}
              className="rounded-xl border p-4 text-sm space-y-2"
            >
              {leadLoading ? (
                <p>Cargando Lead y anticipos…</p>
              ) : leadError ? (
                <p className="text-destructive">{leadError}</p>
              ) : (
                <>
                  <p>
                    <strong>{commercialLead?.contactName ?? "Lead"}</strong> ·{" "}
                    {commercialLead?.type?.name ?? commercialLead?.typeCode}
                  </p>
                  {commercialLead?.contactEmail ? (
                    <p>{commercialLead.contactEmail}</p>
                  ) : null}
                  {Object.keys(commercialLead?.customFields ?? {}).length >
                  0 ? (
                    <dl className="grid gap-1 sm:grid-cols-2">
                      {Object.entries(commercialLead?.customFields ?? {}).map(
                        ([key, value]) => (
                          <div key={key}>
                            <dt className="font-medium">
                              {commercialLead?.type?.fields.find(
                                (field) => field.key === key,
                              )?.label ?? key}
                            </dt>
                            <dd className="break-words">
                              {typeof value === "object"
                                ? JSON.stringify(value)
                                : String(value ?? "—")}
                            </dd>
                          </div>
                        ),
                      )}
                    </dl>
                  ) : null}
                  <p>
                    Anticipos aprobados: {leadCurrency || "Moneda pendiente"}{" "}
                    {leadApproved.toFixed(2)} · Pendientes:{" "}
                    {leadPending.toFixed(2)}. Se vincularán sin volver a
                    cobrarlos.
                  </p>
                  <Label htmlFor="lead-collection-condition">
                    Condición de cobro *
                  </Label>
                  <select
                    id="lead-collection-condition"
                    value={leadCollectionCondition}
                    disabled={leadAttemptFrozen}
                    onChange={(event) =>
                      setLeadCollectionCondition(
                        event.target.value as "COD" | "PREPAID",
                      )
                    }
                    className="h-10 rounded border bg-background px-3"
                  >
                    <option value="">Selecciona cómo se cobrará</option>
                    <option value="COD">Contra entrega</option>
                    <option value="PREPAID">Pago previo</option>
                  </select>
                  <Label htmlFor="lead-order-currency">
                    Moneda del pedido *
                  </Label>
                  <Input
                    id="lead-order-currency"
                    value={leadCurrency}
                    maxLength={3}
                    disabled={!!commercialLead?.currency || leadAttemptFrozen}
                    onChange={(event) =>
                      setLeadCurrency(event.target.value.toUpperCase())
                    }
                    placeholder="PEN, USD…"
                    className="max-w-40"
                  />
                </>
              )}
              <Link className="underline" href={commercialLeadHref(leadId)}>
                Volver al Lead y gestionar anticipos
              </Link>
              {leadAttemptFrozen && (
                <p>
                  El reintento conserva el mismo pedido y comando. Revisa el
                  Lead antes de iniciar una confirmación distinta.
                </p>
              )}
            </div>
          )}
          {orderData?.commercialStage === "LEAD" &&
            orderData.commercialLeadId && (
              <p role="status" className="rounded-xl border p-4 text-sm">
                Este documento pertenece a un Lead. Guardar sus datos no
                confirma la compra.{" "}
                <Link
                  className="underline"
                  href={commercialLeadHref(orderData.commercialLeadId)}
                >
                  Volver al Lead para confirmar
                </Link>
              </p>
            )}
          {pendingProofUpload && (
            <div role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
              El pedido ya está guardado. Falta guardar el comprobante de pago.
              El archivo sigue seleccionado: pulsa «Reintentar comprobante» para
              terminar sin volver a registrar la venta.
            </div>
          )}

          <div className="grid gap-6 items-start lg:grid-cols-[1fr_400px]">
            <div className="space-y-6 min-w-0" inert={!!pendingProofUpload || (!!leadId && (leadLoading || !!leadError || leadAttemptFrozen))}>
              {/* Cliente */}
              <Card>
                <CardHeader>
                  <CardTitle>
                    <SectionTitle icon={User} hint="Busca por teléfono o crea uno nuevo">
                      Cliente
                    </SectionTitle>
                  </CardTitle>
                </CardHeader>

                <CardContent className="space-y-4">
                  {/* Teléfono + buscar */}
                  <div className="space-y-1">
                    <Label>Buscar cliente por teléfono</Label>
                    <div className="flex gap-2">
                      <Input
                        type="tel"
                        placeholder="Número de teléfono"
                        value={clientForm.phoneNumber}
                        className={cn(
                          isFound && "border-green-500 focus-visible:ring-green-500",
                          (isNotFound || isSearchError) &&
                            "border-amber-400 focus-visible:ring-amber-400",
                        )}
                        onChange={(e) => {
                          setClientForm({
                            ...clientForm,
                            phoneNumber: e.target.value,
                          });
                          if (!isIdle) setSearchState("idle");
                        }}
                        onKeyDown={(e) => e.key === "Enter" && searchClient()}
                      />
                      <Button
                        onClick={searchClient}
                        disabled={!clientForm.phoneNumber || loadingClient}
                      >
                        {loadingClient ? (
                          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        ) : (
                          <Search className="h-4 w-4" />
                        )}
                      </Button>

                      {(isFound || isNotFound || isSearchError) && (
                        <Button variant="ghost" size="icon" onClick={clearClient}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>

                    {loadingClient && (
                      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span className="h-3 w-3 animate-spin rounded-full border-2 border-muted-foreground/40 border-t-transparent" />
                        Buscando cliente…
                      </p>
                    )}
                    {!loadingClient && isFound && (
                      <p className="flex items-center gap-1.5 text-xs text-green-700 dark:text-green-400">
                        <Check className="h-3.5 w-3.5" />
                        Cliente encontrado: <b>{clientFound?.fullName}</b>
                      </p>
                    )}
                    {!loadingClient && isNotFound && (
                      <p className="text-xs text-amber-700 dark:text-amber-400">
                        Cliente no encontrado. Completa los datos para crear uno nuevo.
                      </p>
                    )}
                    {!loadingClient && isSearchError && (
                      <p className="text-xs text-destructive">
                        No se pudo buscar el cliente. Intenta de nuevo o completa los datos
                        manualmente.
                      </p>
                    )}
                  </div>

                  {/* Formulario */}
                  <div className="p-4 space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className={clientErrors.fullName ? "text-destructive" : ""}>
                          Nombre completo
                        </Label>
                        <Input
                          disabled={!formEnabled}
                          value={clientForm.fullName}
                          className={clientErrors.fullName ? "border-destructive" : ""}
                          onChange={(e) => {
                            setClientForm({
                              ...clientForm,
                              fullName: e.target.value,
                            });
                            if (clientErrors.fullName) {
                              setClientErrors({
                                ...clientErrors,
                                fullName: undefined,
                              });
                            }
                          }}
                        />
                        {clientErrors.fullName && (
                          <p className="text-xs text-destructive">{clientErrors.fullName}</p>
                        )}
                      </div>

                      <div className="space-y-1">
                        <Label>Tipo de cliente</Label>
                        <Select
                          disabled={!formEnabled || isSubmitting}
                          value={clientForm.clientType}
                          onValueChange={(v) =>
                            setClientForm({
                              ...clientForm,
                              clientType: v as any,
                            })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar tipo de cliente" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="TRADICIONAL">Tradicional</SelectItem>
                            <SelectItem value="MAYORISTA">Mayorista</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <Label>Numero de Telefono</Label>
                        <Input
                          disabled={!formEnabled}
                          placeholder="Numero de telefono"
                          value={clientForm.phoneNumber}
                          onChange={(e) =>
                            setClientForm({
                              ...clientForm,
                              phoneNumber: e.target.value,
                            })
                          }
                        />
                      </div>

                      <div className="space-y-1">
                        <Label className={clientErrors.documentType ? "text-destructive" : ""}>
                          Tipo de documento
                          {salesRegion === "PROVINCIA" && (
                            <span className="text-destructive"> *</span>
                          )}
                        </Label>
                        <Select
                          disabled={!formEnabled || isSubmitting}
                          value={clientForm.documentType ?? "NONE"}
                          onValueChange={(v) => {
                            if (v === "NONE") {
                              setClientForm({
                                ...clientForm,
                                documentType: undefined,
                                documentNumber: "",
                              });
                            } else {
                              setClientForm({
                                ...clientForm,
                                documentType: v as DocumentType,
                              });
                            }
                            if (clientErrors.documentType) {
                              setClientErrors({
                                ...clientErrors,
                                documentType: undefined,
                              });
                            }
                          }}
                        >
                          <SelectTrigger
                            className={clientErrors.documentType ? "border-destructive" : ""}
                          >
                            <SelectValue placeholder="Tipo de documento" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="NONE">No aplica</SelectItem>
                            <SelectItem value="DNI">DNI</SelectItem>
                            <SelectItem value="CARNET">Carnet de Extranjería</SelectItem>
                            <SelectItem value="PASAPORTE">Pasaporte</SelectItem>
                          </SelectContent>
                        </Select>
                        {clientErrors.documentType && (
                          <p className="text-xs text-destructive mt-1">
                            {clientErrors.documentType}
                          </p>
                        )}
                      </div>

                      <div className="space-y-1">
                        <Label className={clientErrors.documentNumber ? "text-destructive" : ""}>
                          N° Documento
                          {salesRegion === "PROVINCIA" && (
                            <span className="text-destructive"> *</span>
                          )}
                        </Label>
                        <Input
                          disabled={!formEnabled || !clientForm.documentType}
                          placeholder="Número"
                          value={clientForm.documentNumber}
                          className={clientErrors.documentNumber ? "border-destructive" : ""}
                          onChange={(e) => {
                            setClientForm({
                              ...clientForm,
                              documentNumber: e.target.value,
                            });
                            if (clientErrors.documentNumber) {
                              setClientErrors({
                                ...clientErrors,
                                documentNumber: undefined,
                              });
                            }
                          }}
                        />
                        {clientErrors.documentNumber && (
                          <p className="text-xs text-destructive mt-1">
                            {clientErrors.documentNumber}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label
                        className={
                          clientErrors.address ||
                          clientErrors.department ||
                          clientErrors.province ||
                          districtError
                            ? "text-destructive"
                            : ""
                        }
                      >
                        Dirección
                      </Label>

                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <Combobox
                            disabled={!formEnabled || isSubmitting}
                            value={clientForm.department}
                            onValueChange={(value) => {
                              setClientForm({
                                ...clientForm,
                                department: value,
                                province: "",
                                district: "",
                              });
                              if (clientErrors.department) {
                                setClientErrors({
                                  ...clientErrors,
                                  department: undefined,
                                });
                              }
                            }}
                            options={departmentOptions}
                            placeholder="Departamento"
                            searchPlaceholder="Buscar departamento..."
                            className={clientErrors.department ? "border-destructive" : ""}
                          />
                          {clientErrors.department && (
                            <p className="text-[10px] text-destructive mt-1">
                              {clientErrors.department}
                            </p>
                          )}
                        </div>

                        <div>
                          <Combobox
                            disabled={!formEnabled || !clientForm.department || isSubmitting}
                            value={clientForm.province}
                            onValueChange={(value) => {
                              setClientForm({
                                ...clientForm,
                                province: value,
                                district: "",
                              });
                              if (clientErrors.province) {
                                setClientErrors({
                                  ...clientErrors,
                                  province: undefined,
                                });
                              }
                            }}
                            options={provinceOptions}
                            placeholder="Provincia"
                            searchPlaceholder="Buscar provincia..."
                            className={clientErrors.province ? "border-destructive" : ""}
                          />
                          {clientErrors.province && (
                            <p className="text-[10px] text-destructive mt-1">
                              {clientErrors.province}
                            </p>
                          )}
                        </div>

                        <div>
                          <Combobox
                            disabled={!formEnabled || !clientForm.province || isSubmitting}
                            value={clientForm.district}
                            onValueChange={(value) => {
                              setClientForm({ ...clientForm, district: value });
                              if (clientErrors.district) {
                                setClientErrors({
                                  ...clientErrors,
                                  district: undefined,
                                });
                              }
                            }}
                            options={districtOptions}
                            placeholder="Distrito"
                            searchPlaceholder="Buscar distrito..."
                            className={districtError ? "border-destructive" : ""}
                          />
                          {districtError && (
                            <p className="text-[10px] text-destructive mt-1">
                              {districtError}
                            </p>
                          )}
                        </div>
                      </div>

                      <div>
                        <Input
                          disabled={!formEnabled}
                          placeholder="Dirección exacta"
                          value={clientForm.address}
                          className={clientErrors.address ? "border-destructive" : ""}
                          onChange={(e) => {
                            setClientForm({
                              ...clientForm,
                              address: e.target.value,
                            });
                            if (clientErrors.address) {
                              setClientErrors({
                                ...clientErrors,
                                address: undefined,
                              });
                            }
                          }}
                        />
                        {clientErrors.address && (
                          <p className="text-xs text-destructive mt-1">{clientErrors.address}</p>
                        )}
                      </div>
                    </div>

                    {/* Región de Venta - Toggle Pills */}
                    <div className="space-y-2">
                      <Label>Región de venta</Label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setSalesRegion("LIMA")}
                          className={`rounded-full border-[1.5px] px-4 py-1.5 text-xs font-bold transition-all ${
                            salesRegion === "LIMA"
                              ? "border-green-600 bg-green-600 text-white"
                              : "border-border text-muted-foreground hover:border-green-600/40"
                          }`}
                        >
                          Lima
                        </button>
                        <button
                          type="button"
                          onClick={() => setSalesRegion("PROVINCIA")}
                          className={`rounded-full border-[1.5px] px-4 py-1.5 text-xs font-bold transition-all ${
                            salesRegion === "PROVINCIA"
                              ? "border-green-600 bg-green-600 text-white"
                              : "border-border text-muted-foreground hover:border-green-600/40"
                          }`}
                        >
                          Provincia
                        </button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Se calcula automáticamente según el departamento, pero puedes cambiarlo
                        manualmente.
                      </p>
                      {salesRegion === "PROVINCIA" && (
                        <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-amber-800 dark:border-amber-800 dark:bg-amber-500/10 dark:text-amber-400">
                          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                          <p className="text-xs font-medium">
                            Venta de provincia detectada. Completa el documento
                            de identidad del cliente (DNI, CE o pasaporte).
                          </p>
                        </div>
                      )}
                    </div>

                    <Disclosure label="Agregar referencia y ubicación (opcional)">
                      <div className="space-y-1">
                        <Label>
                          Referencia{" "}
                          <span className="text-muted-foreground font-normal">(opcional)</span>
                        </Label>
                        <Textarea
                          disabled={!formEnabled}
                          placeholder="Ej. frente al parque, casa celeste"
                          value={clientForm.reference}
                          onChange={(e) =>
                            setClientForm({
                              ...clientForm,
                              reference: e.target.value,
                            })
                          }
                        />
                      </div>

                      <div className="space-y-1">
                        <Label>
                          Link de Google Maps{" "}
                          <span className="text-muted-foreground font-normal">(opcional)</span>
                        </Label>
                        <Input
                          disabled={!formEnabled}
                          type="text"
                          placeholder="Pega aquí el link de Google Maps…"
                          value={clientForm.googleMapsUrl}
                          onChange={(e) => handleMapsLinkChange(e.target.value)}
                        />
                        {mapsLinkStatus === "ok" && (
                          <p className="text-xs text-green-600 dark:text-green-400">
                            ✓ Coordenadas detectadas y completadas abajo.
                          </p>
                        )}
                        {mapsLinkStatus === "unrecognized" && (
                          <p className="text-xs text-amber-600 dark:text-amber-400">
                            No pudimos leer coordenadas en este link. Abre el link, copia la URL
                            completa (con “@lat,lng”) o completa Latitud/Longitud a mano.
                          </p>
                        )}
                        {!mapsLinkStatus && (
                          <p className="text-xs text-muted-foreground">
                            Pega el link para completar Latitud y Longitud automáticamente.
                          </p>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">
                            Latitud (opcional)
                          </Label>
                          <Input
                            disabled={!formEnabled}
                            type="text"
                            inputMode="decimal"
                            placeholder="-12.046374"
                            value={clientForm.latitude}
                            onChange={(e) =>
                              setClientForm({
                                ...clientForm,
                                latitude: e.target.value,
                              })
                            }
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">
                            Longitud (opcional)
                          </Label>
                          <Input
                            disabled={!formEnabled}
                            type="text"
                            inputMode="decimal"
                            placeholder="-77.042793"
                            value={clientForm.longitude}
                            onChange={(e) =>
                              setClientForm({
                                ...clientForm,
                                longitude: e.target.value,
                              })
                            }
                          />
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Coordenadas para envíos Aliclik
                      </p>
                    </Disclosure>

                    {/* Acciones */}
                    {(isNotFound || isSearchError) && clientForm.fullName.trim() && (
                      <div className="flex items-start gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700 dark:border-blue-800 dark:bg-blue-500/10 dark:text-blue-300">
                        <span>ℹ️</span>
                        <span>Se creará un nuevo cliente al confirmar la venta.</span>
                      </div>
                    )}

                    {isFound && hasClientChanges && (
                      <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:border-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
                        <span>⚠️</span>
                        <span>
                          Los datos del cliente se actualizarán automáticamente al confirmar la
                          venta.
                        </span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Productos */}
              <Card>
                <CardHeader>
                  <CardTitle>
                    <SectionTitle icon={Package} hint="Elige el almacén y busca modelos">
                      Productos
                    </SectionTitle>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-xl border bg-muted/20 p-3">
                    <SaleOriginField
                      label="Almacén de salida"
                      options={warehouseOptions}
                      value={origin.inventoryId}
                      onChange={origin.chooseInventory}
                      readOnly={Boolean(orderId)}
                      disabled={isSubmitting || cart.length > 0 || saleContext.isError}
                      loading={saleContext.isLoading}
                      hint={
                        !orderId && cart.length > 0 && inventories.length > 1
                          ? "Vacía el carrito para cambiar de almacén."
                          : undefined
                      }
                    />
                    {origin.browsingHistoricalSale && (
                      <div className="mt-3">
                        <SaleOriginField
                          label="Almacén para buscar productos"
                          options={warehouseOptions}
                          value={selectedInventory}
                          onChange={origin.chooseInventory}
                          disabled={isSubmitting || saleContext.isError}
                          loading={saleContext.isLoading}
                          required={false}
                          hint={inventories.length
                            ? "Puedes agregar productos de este almacén. El origen de la venta se conserva."
                            : "No hay almacenes disponibles para buscar productos."}
                        />
                      </div>
                    )}
                  </div>

                  {/* Buscador de productos */}
                  <div className="space-y-1.5">
                    <div className="relative">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        className="h-11 rounded-xl pl-10 pr-9 text-[15px] focus-visible:ring-4 focus-visible:ring-primary/10"
                        disabled={!selectedInventory || isSubmitting}
                        placeholder='Buscar por modelo, color, talla o SKU — ej. "negro XL", "botines 39"...'
                        value={productQuery}
                        onChange={(e) => setProductQuery(e.target.value)}
                      />
                      {productQuery && (
                        <button
                          type="button"
                          onClick={() => setProductQuery("")}
                          className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-muted text-muted-foreground text-xs flex items-center justify-center hover:bg-muted-foreground/20"
                        >
                          ×
                        </button>
                      )}
                    </div>
                    <div className="flex items-center justify-between px-0.5 text-xs text-muted-foreground">
                      <span>
                        {productsLoading
                          ? "Buscando…"
                          : productQuery
                            ? `${productsMeta?.total ?? products.length} resultado(s) para "${productQuery}"`
                            : `${productsMeta?.total ?? products.length} producto(s) en este almacén`}
                      </span>
                      <button
                        type="button"
                        onClick={() => (window.location.href = "/productos")}
                        className="flex items-center gap-1 font-bold text-violet-600 hover:underline"
                      >
                        <Plus className="h-3 w-3" />
                        Nuevo producto
                      </button>
                    </div>
                  </div>

                  {/* Resultados */}
                  <div className="border-t pt-4">
                    <ProductSearchMatrix
                      products={products}
                      query={productQuery}
                      loading={productsLoading}
                      isAdmin={isAdmin}
                      onAddVariant={addToCart}
                      qtyInCartByVariant={qtyInCartByVariant}
                      modelQtyInCart={packsEngine.modelQtyInCart}
                      activePacksForProduct={packsEngine.activePacksForProduct}
                      frequencies={productFrequencies}
                      onLoadMore={handleLoadMore}
                      hasMore={productsMeta ? products.length < productsMeta.total : false}
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
            <div className="space-y-6 min-w-0">
              {/* Sugerencias para cerrar */}
              <SuggestionsPanel
                packs={packs}
                channel={orderDetails.salesChannel}
                appliedPacks={packsEngine.appliedPacks}
                pendingHints={packsEngine.pendingHints}
                modelQtyInCart={packsEngine.modelQtyInCart}
                subtotalPayable={packsEngine.subtotalPayable}
                totalUnits={packsEngine.totalUnits}
                isAdmin={isAdmin}
                onApplyPack={handleApplyPack}
                onAutoFillVolume={handleAutoFillVolume}
                onAutoAddBundleItem={handleAutoAddBundleItem}
              />

              {/* Carrito */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <SectionTitle icon={ShoppingCart}>Detalle de la venta</SectionTitle>
                    <Badge variant="outline">
                      {cart.reduce((a, l) => a + l.quantity, 0)} ítems
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <CartLines
                    cart={cart}
                    packs={packs}
                    appliedPacks={packsEngine.appliedPacks}
                    isAdmin={isAdmin}
                    onQtyChange={handleCartQtyChange}
                    onRemove={removeFromCart}
                    onSetPrice={handleSetPrice}
                    onApplyDiscount={handleApplyDiscount}
                    onClearDiscount={handleClearDiscount}
                    onBulkPrice={handleBulkPrice}
                    onBulkDiscount={handleBulkDiscount}
                    onRestorePvp={handleRestorePvp}
                    onUndoPack={handleUndoPack}
                    pvsOpen={packsEngine.pvsOpen}
                    pvsLoading={packsEngine.pvsLoading}
                    pvsTotal={packsEngine.pvsTotal}
                    onPvsChg={packsEngine.pvsChg}
                    onPvsConfirm={handlePvsConfirm}
                    onPvsCancel={packsEngine.pvsCancel}
                    giftOpen={packsEngine.giftOpen}
                    onChooseGift={handleChooseGift}
                    onChangeGift={packsEngine.changeGift}
                    onGiftCancel={packsEngine.giftCancel}
                  />
                  {orderData && <SaleUnitLifecycleActions key={orderData.id} order={orderData} onUpdated={() => { void loadOrder(); }} />}
                  {orderData && <SaleAssignmentStatus order={orderData} onRefresh={(saved) => setCart((lines) => lines.map((line) => {
                    const units = saved.items.flatMap((item) => item.units ?? []).filter((unit) => line.unitIds?.includes(unit.id));
                    return units.length ? { ...line, units } : line;
                  }))} />}
                  {unknownVariantIds && <div className="mt-3 rounded border p-3" role="status">
                    <p>{trackingLookupError || "Verificando el seguimiento de los productos…"}</p>
                    {trackingLookupError && <Button type="button" variant="outline" onClick={() => setTrackingLookupRetry((value) => value + 1)}>Reintentar verificación</Button>}
                  </div>}
                  {unitSelectionLocked && cart.some((line) => isTracked(line.trackingMode)) && <p className="mt-3 text-sm text-muted-foreground">La selección de unidades ya no se puede cambiar en este estado. Los códigos se conservan para consulta.</p>}
                  <SaleUnitSelection companyId={companyId ?? ""} inventoryId={selectedInventory ?? ""} orderId={orderId ?? undefined} cart={cart} disabled={isSubmitting || Boolean(pendingTrackedSale) || unitSelectionLocked} onChange={(lineId, units: InventoryUnit[]) => setCart((lines) => lines.map((line) => line.id === lineId ? { ...line, unitIds: units.map((unit) => unit.id), units } : line))} />
                </CardContent>
              </Card>

              {/* Cierre */}
              <Card>
                <CardHeader>
                  <CardTitle>
                    <SectionTitle icon={CreditCard} tone="green">
                      Cierre de venta
                    </SectionTitle>
                  </CardTitle>
                </CardHeader>

                <CardContent className="space-y-4">
                  {usesLeadPayments && (
                    <div className="rounded-lg border p-3 text-sm space-y-3">
                      <p>Registra el adelanto y su comprobante por separado. El pago queda pendiente de aprobación en Finanzas y no confirma la compra.</p>
                      {orderId && orderData?.commercialStage === "LEAD" ? (
                        canRecordOrderPayment ? (
                          <Button type="button" variant="outline" disabled={isSubmitting} onClick={() => setLeadPaymentOpen(true)}>
                            Registrar adelanto
                          </Button>
                        ) : <p className="text-muted-foreground">No tienes permiso para registrar pagos.</p>
                      ) : leadId ? (
                        <Button asChild variant="outline"><Link href={commercialLeadHref(leadId)}>Registrar adelanto en el Lead</Link></Button>
                      ) : null}
                      {orderId && advancePayment > 0 && <p>Adelantos pendientes: {moneyPrefix} {advancePayment.toFixed(2)}</p>}
                    </div>
                  )}
                  <div inert={!!leadId || orderData?.commercialStage === "LEAD"}>
                  {/* Método de pago */}
                  <div className="space-y-1">
                    <Label>
                      Método de pago <span className="text-destructive">*</span>
                    </Label>
                    <Select
                      disabled={isSubmitting}
                      value={paymentMethod}
                      onValueChange={setPaymentMethod}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar método de pago">
                          {paymentMethod === "MERCADO_PAGO"
                            ? "Mercado Pago (registrado)"
                            : undefined}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="YAPE">Yape</SelectItem>
                        <SelectItem value="PLIN">Plin</SelectItem>
                        <SelectItem value="TRANSFERENCIA">Transferencia</SelectItem>
                        <SelectItem value="EFECTIVO">Efectivo</SelectItem>
                        <SelectItem value="CONTRA_ENTREGA">Contraentrega</SelectItem>
                        <SelectItem value="BCP">BCP</SelectItem>
                        <SelectItem value="BANCO_NACION">Banco de la Nación</SelectItem>
                        <SelectItem value="POS">POS</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  </div>
                  {/* Costo de envío - solo si es envío a domicilio */}
                  {orderDetails.deliveryType === DeliveryType.DOMICILIO && (
                    <div className="space-y-1">
                      <Label>Costo de envío</Label>
                      <Input
                        type="text"
                        inputMode="decimal"
                        value={shippingTotalDisplay}
                        onChange={(e) => {
                          const val = e.target.value;
                          // Permitir vacío, números enteros y decimales (incluyendo estados intermedios como "10.")
                          if (val === "" || /^\d*\.?\d*$/.test(val)) {
                            setShippingTotalDisplay(val);
                            // Solo actualizar el valor numérico si es un número válido
                            if (val === "" || !val.endsWith(".")) {
                              setShippingTotal(val === "" ? 0 : Number(val));
                            }
                          }
                        }}
                        onBlur={(e) => {
                          // Al perder el foco, asegurarse de que el valor sea un número válido
                          const val = e.target.value;
                          const numVal = parseFloat(val) || 0;
                          setShippingTotal(numVal);
                          setShippingTotalDisplay(numVal === 0 ? "" : String(numVal));
                        }}
                      />
                    </div>
                  )}

                  <div inert={!!leadId || orderData?.commercialStage === "LEAD"}>
                  {/* Adelanto de pago */}
                  <div className="space-y-1">
                    <Label>Adelanto de Pago</Label>
                    <Input
                      type="text"
                      inputMode="decimal"
                      value={advancePaymentDisplay}
                      disabled={pendingPaymentsCount > 1}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === "" || /^\d*\.?\d*$/.test(val)) {
                          setAdvancePaymentDisplay(val);
                          if (val === "" || !val.endsWith(".")) {
                            setAdvancePayment(val === "" ? 0 : Number(val));
                          }
                        }
                      }}
                      onBlur={(e) => {
                        const val = e.target.value;
                        const numVal = parseFloat(val) || 0;
                        setAdvancePayment(numVal);
                        setAdvancePaymentDisplay(numVal === 0 ? "" : String(numVal));
                      }}
                    />
                    {pendingPaymentsCount > 1 && (
                      <p className="text-xs text-muted-foreground">
                        Esta venta tiene varios pagos pendientes. Gestionalos desde Finanzas ›
                        Gestionar Pagos.
                      </p>
                    )}
                  </div>

                  {/* Comprobante de pago */}
                  <div className="space-y-1">
                    <Label htmlFor="sale-payment-proof">Comprobante de pago (opcional)</Label>
                    {(orderData?.payments ?? [])
                      .filter((payment) => payment.paymentProofUrl)
                      .map((payment) => (
                        <a
                          key={payment.id}
                          href={payment.paymentProofUrl!}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block text-sm text-violet-600 underline dark:text-violet-300"
                        >
                          Ver comprobante guardado · {payment.paymentMethod} · {moneyPrefix} {Number(payment.amount).toFixed(2)}
                          {payment.status === "PAID" ? " (aprobado)" : payment.status === "LOST" ? " (rechazado)" : " (pendiente)"}
                        </a>
                      ))}
                    {orderData && activeProofPayments.length > 0 && (
                      <div className="space-y-1 pb-2">
                        <Label htmlFor="proof-payment">Pago al que corresponde el comprobante</Label>
                        <Select
                          value={proofPaymentId}
                          onValueChange={setSelectedProofPaymentId}
                          disabled={isSubmitting}
                        >
                          <SelectTrigger id="proof-payment">
                            <SelectValue placeholder="Selecciona un pago" />
                          </SelectTrigger>
                          <SelectContent>
                            {activeProofPayments.map((payment) => (
                              <SelectItem key={payment.id} value={payment.id}>
                                {payment.paymentMethod} · {moneyPrefix} {Number(payment.amount).toFixed(2)} · {payment.status === "PAID" ? "Aprobado" : "Pendiente"}
                              </SelectItem>
                            ))}
                            {pendingProofPayments.length === 0 && advancePayment > 0 && (
                              <SelectItem value="new">Nuevo adelanto · {moneyPrefix} {advancePayment.toFixed(2)}</SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    <div
                      className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors
                  ${paymentProofFile ? "border-violet-500 bg-violet-50 dark:bg-violet-500/10" : "border-muted-foreground/25 hover:border-violet-400 hover:bg-muted/30"}`}
                      onClick={() => paymentProofInputRef.current?.click()}
                    >
                      <input
                        id="sale-payment-proof"
                        ref={paymentProofInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp,application/pdf"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;

                          const allowedTypes = [
                            "image/jpeg",
                            "image/png",
                            "image/webp",
                            "application/pdf",
                          ];
                          if (!allowedTypes.includes(file.type)) {
                            toast.error("Tipo de archivo no permitido. Use JPG, PNG, WEBP o PDF.");
                            return;
                          }

                          if (file.size > 5 * 1024 * 1024) {
                            toast.error("El archivo es muy grande. Máximo 5MB.");
                            return;
                          }

                          setPaymentProofFile(file);

                          if (file.type.startsWith("image/")) {
                            const reader = new FileReader();
                            reader.onloadend = () => {
                              setPaymentProofPreview(reader.result as string);
                            };
                            reader.readAsDataURL(file);
                          } else {
                            setPaymentProofPreview(null);
                          }
                        }}
                        className="hidden"
                      />

                      {!paymentProofFile ? (
                        <div className="space-y-1">
                          <p className="text-sm text-gray-600">Clic para seleccionar comprobante</p>
                          <p className="text-xs text-gray-400">JPG, PNG, WEBP o PDF (máx. 5MB)</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {paymentProofPreview ? (
                            <Image
                              src={paymentProofPreview}
                              alt="Preview"
                              width={200}
                              height={100}
                              className="max-h-24 mx-auto rounded-md object-contain"
                            />
                          ) : (
                            <p className="text-sm text-violet-600 font-medium">PDF seleccionado</p>
                          )}
                          <p className="text-xs text-gray-600 truncate">{paymentProofFile.name}</p>
                          <Button
                            variant="destructive"
                            size="sm"
                            className="mt-2"
                            onClick={(e) => {
                              e.stopPropagation();
                              setPaymentProofFile(null);
                              setPaymentProofPreview(null);
                              if (paymentProofInputRef.current) {
                                paymentProofInputRef.current.value = "";
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4 mr-1" />
                            Quitar
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>

                  </div>
                  {/* Modo de impuestos */}
                  <div className="space-y-1">
                    <Label>Modo de impuestos</Label>
                    <Select
                      disabled={isSubmitting}
                      value={taxMode}
                      onValueChange={(v) => setTaxMode(v as "AUTOMATICO" | "INCLUIDO")}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar modo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="AUTOMATICO">Cálculo automático (+18% IGV)</SelectItem>
                        <SelectItem value="INCLUIDO">Impuestos incluidos en precio</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      {taxMode === "AUTOMATICO"
                        ? "El sistema agregará 18% de IGV al subtotal"
                        : "Los precios ya incluyen impuestos"}
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Detalles */}
              <Card>
                <CardHeader>
                  <CardTitle>
                    <SectionTitle icon={ClipboardList}>Detalles de la venta</SectionTitle>
                  </CardTitle>
                </CardHeader>

                <CardContent className="space-y-4">
                  {saleContext.isError && (
                    <div
                      role="alert"
                      className="flex flex-wrap items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm"
                    >
                      <span>No se pudieron cargar las tiendas y los almacenes.</span>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => void saleContext.refetch()}
                        disabled={saleContext.isFetching}
                      >
                        Reintentar
                      </Button>
                    </div>
                  )}
                  {saleContext.data && !stores.length && !orderId && (
                    <div role="alert" className="space-y-2 text-sm">
                      <p>
                        Crea una tienda comercial para registrar la venta. Puedes usar el almacén
                        actual.
                      </p>
                      <Button variant="outline" size="sm" asChild>
                        <Link href="/configuracion/tiendas">Crear tienda comercial</Link>
                      </Button>
                    </div>
                  )}
                  {saleContext.data && !inventories.length && !orderId && (
                    <p role="alert" className="text-sm text-destructive">
                      La empresa no tiene almacenes activos.
                    </p>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <SaleOriginField
                      label="Tienda de la venta"
                      options={stores}
                      value={origin.storeId}
                      onChange={(storeId) => {
                        origin.chooseStore(storeId);
                        if (storeId !== origin.storeId)
                          setOrderDetails((current) => ({
                            ...current,
                            salesChannelId: undefined,
                            salesChannel: undefined,
                          }));
                      }}
                      readOnly={Boolean(orderId)}
                      disabled={isSubmitting || saleContext.isError}
                      loading={saleContext.isLoading}
                    />
                    {/* Tipo de orden */}
                    <div className="space-y-1">
                      <Label>
                        Tipo de orden <span className="text-destructive">*</span>
                      </Label>
                      <Select
                        disabled={isSubmitting}
                        value={orderDetails.orderType ?? ""}
                        onValueChange={(v) =>
                          setOrderDetails({
                            ...orderDetails,
                            orderType: v as OrderType,
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar tipo de orden" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={OrderType.VENTA}>Venta</SelectItem>
                          <SelectItem value={OrderType.CAMBIO}>Cambio</SelectItem>
                          <SelectItem value={OrderType.RESERVA}>Reserva</SelectItem>
                          <SelectItem value={OrderType.PREVENTA}>Preventa</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Canal de venta */}
                    <SaleChannelField
                      channels={storeChannels}
                      legacyChannels={salesChannels}
                      valueId={orderDetails.salesChannelId}
                      valueType={orderDetails.salesChannel}
                      fixedId={orderData?.salesChannelId}
                      editing={Boolean(orderId)}
                      disabled={isSubmitting || !origin.hasStore || saleContext.isError}
                      onChange={(salesChannelId, salesChannel) =>
                        setOrderDetails((current) => ({ ...current, salesChannelId, salesChannel }))
                      }
                    />

                    {/* Canal de cierre */}
                    <div className="space-y-1">
                      <Label>
                        Canal de cierre <span className="text-destructive">*</span>
                      </Label>
                      <Select
                        disabled={isSubmitting}
                        value={orderDetails.closingChannel ?? ""}
                        onValueChange={(v) =>
                          setOrderDetails({
                            ...orderDetails,
                            closingChannel: v as any,
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar canal de cierre" />
                        </SelectTrigger>
                        <SelectContent>
                          {closingChannels.map((channel: string) => (
                            <SelectItem key={channel} value={channel}>
                              {channel.replace(/_/g, " ")}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Tipo de entrega */}
                    <div className="space-y-1">
                      <Label>
                        Tipo de entrega <span className="text-destructive">*</span>
                      </Label>
                      <Select
                        disabled={isSubmitting}
                        value={orderDetails.deliveryType ?? ""}
                        onValueChange={(v) =>
                          setOrderDetails({
                            ...orderDetails,
                            deliveryType: v as DeliveryType,
                            enviaPor: undefined,
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar tipo de entrega" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={DeliveryType.RETIRO_TIENDA}>
                            Retiro en tienda
                          </SelectItem>
                          <SelectItem value={DeliveryType.DOMICILIO}>Envío a domicilio</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Método de envío */}
                    {orderDetails.deliveryType === DeliveryType.DOMICILIO && (
                      <div className="md:col-span-2 space-y-1">
                        <Label>
                          Método de envío <span className="text-destructive">*</span>
                        </Label>
                        <Select
                          disabled={isSubmitting || isLoadingCouriers}
                          value={orderDetails.enviaPor ?? ""}
                          onValueChange={(v) =>
                            setOrderDetails({
                              ...orderDetails,
                              enviaPor: v,
                            })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue
                              placeholder={
                                isLoadingCouriers ? "Cargando..." : "Seleccionar método de envío"
                              }
                            />
                          </SelectTrigger>
                          <SelectContent>
                            {couriers.map((courier) => (
                              <SelectItem key={courier.id} value={courier.name}>
                                {courier.name}
                              </SelectItem>
                            ))}
                            <SelectItem value="OTROS">Otros</SelectItem>
                          </SelectContent>
                        </Select>
                        {couriersError && (
                          <div role="alert" className="flex items-center gap-2 text-sm text-destructive">
                            <span>No se pudieron cargar los métodos de envío.</span>
                            <Button type="button" variant="outline" size="sm" onClick={() => void retryCouriers()}>
                              Reintentar
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Programar envío para otra fecha */}
                  {!leadId && (<div className="space-y-2 rounded-lg border border-dashed p-3">
                    <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
                      <Checkbox
                        checked={scheduleDelivery}
                        disabled={isSubmitting}
                        onCheckedChange={(v) => {
                          const checked = !!v;
                          setScheduleDelivery(checked);
                          if (checked && !scheduledDeliveryDate) {
                            setScheduledDeliveryDate(defaultScheduledDateValue());
                          }
                        }}
                      />
                      Programar venta para otra fecha
                    </label>
                    {scheduleDelivery && (
                      <div className="space-y-1 pl-6">
                        <Label htmlFor="scheduled-delivery-date" className="text-xs">
                          Fecha
                        </Label>
                        <Input
                          id="scheduled-delivery-date"
                          type="date"
                          className="h-9 max-w-xs"
                          disabled={isSubmitting}
                          value={scheduledDeliveryDate}
                          onChange={(e) => setScheduledDeliveryDate(e.target.value)}
                        />
                      </div>
                    )}
                  </div>

                  )}
                  <Disclosure label="Comentarios e ID de publicidad (opcional)">
                    <div className="space-y-1">
                      <Label>Comentarios</Label>
                      <Textarea
                        placeholder="Observaciones adicionales sobre la venta"
                        value={orderDetails.notes}
                        onChange={(e) =>
                          setOrderDetails({
                            ...orderDetails,
                            notes: e.target.value,
                          })
                        }
                      />
                    </div>

                    <div className="space-y-1">
                      <AdvertisingAttributionSelect
                        storeId={origin.storeId}
                        value={metaPubliId}
                        onChange={setMetaPubliId}
                      />
                    </div>
                  </Disclosure>
                </CardContent>
              </Card>

              {/* Resumen */}
              <Card className="lg:sticky lg:top-6">
                <CardContent className="pt-6 text-sm space-y-1">
                  <div className="flex justify-between py-0.5 text-muted-foreground">
                    <span>Importe productos</span>
                    <span className="text-foreground">{moneyPrefix} {subtotalBruto.toFixed(2)}</span>
                  </div>
                  {totalItemDiscounts > 0 && (
                    <div className="flex justify-between py-0.5 text-emerald-600 dark:text-emerald-400">
                      <span>Total descuentos</span>
                      <span>- {moneyPrefix} {totalItemDiscounts.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between py-0.5 text-muted-foreground">
                    <span>Sub total</span>
                    <span className="text-foreground">{moneyPrefix} {subtotal.toFixed(2)}</span>
                  </div>
                  {taxMode === "AUTOMATICO" && (
                    <div className="flex justify-between py-0.5 text-muted-foreground">
                      <span>IGV 18%</span>
                      <span className="text-foreground">{moneyPrefix} {taxes.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between py-0.5 text-muted-foreground">
                    <span>Costo de envío</span>
                    <span className="text-foreground">{moneyPrefix} {shippingTotal.toFixed(2)}</span>
                  </div>
                  {montoYaAprobado > 0 && (
                    <div className="flex justify-between py-0.5 text-emerald-600 dark:text-emerald-400">
                      <span>Ya pagado</span>
                      <span>{moneyPrefix} {montoYaAprobado.toFixed(2)}</span>
                    </div>
                  )}
                  {advancePayment > 0 && (
                    <div className="flex justify-between py-0.5 text-muted-foreground">
                      <span>Adelanto de pago</span>
                      <span className="text-foreground">{moneyPrefix} {advancePayment.toFixed(2)}</span>
                    </div>
                  )}

                  <div className="flex items-baseline justify-between border-t pt-3.5 mt-1.5">
                    <span className="text-sm font-bold">Total</span>
                    <span className="text-2xl font-extrabold tracking-tight">
                      {moneyPrefix} {grandTotal.toFixed(2)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between rounded-lg bg-amber-50 border border-amber-100 px-3.5 py-2.5 mt-2.5 dark:bg-amber-500/10 dark:border-amber-800">
                    <span className="text-xs font-bold text-amber-600 dark:text-amber-400">
                      Pendiente de pago
                    </span>
                    <span className="text-[15px] font-extrabold text-amber-600 dark:text-amber-400">
                      {moneyPrefix} {pendingPayment.toFixed(2)}
                    </span>
                  </div>

                  <div className="h-1.5 rounded-full bg-muted overflow-hidden mt-3">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-violet-600 to-green-500 transition-all"
                      style={{ width: `${checklistPct}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground text-right mb-1">
                    {checklistDone} de {checklist.length} pasos completados
                  </p>

                  <ul className="space-y-2 py-1">
                    {checklist.map(({ ok, msg }) => (
                      <li
                        key={msg}
                        className={`flex items-center gap-2.5 text-xs font-medium ${
                          ok
                            ? "text-muted-foreground line-through decoration-border"
                            : "text-foreground"
                        }`}
                      >
                        <span
                          className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-[1.5px] ${
                            ok
                              ? "border-green-500 bg-green-500 text-white"
                              : "border-border bg-muted/40"
                          }`}
                        >
                          {ok && <Check className="h-2.5 w-2.5" strokeWidth={4} />}
                        </span>
                        {msg}
                      </li>
                    ))}
                  </ul>

                  <Button
                    type="button"
                    size="lg"
                    className={`w-full rounded-xl text-base font-semibold transition-all ${
                      (pendingProofUpload || canSubmit) && !isSubmitting
                        ? "bg-gradient-to-br from-violet-600 to-green-600 text-white shadow-lg shadow-violet-600/25 hover:opacity-95"
                        : "bg-muted text-muted-foreground"
                    }`}
                    disabled={isSubmitting || (pendingProofUpload ? !paymentProofFile : !canSubmit)}
                    onClick={handleConfirmSale}
                  >
                    {isSubmitting ? (
                      <span className="flex items-center gap-2">
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        Procesando...
                      </span>
                    ) : pendingProofUpload ? (
                      "Reintentar comprobante"
                    ) : orderId ? (
                      "Actualizar venta"
                    ) : (
                      leadId ? "Confirmar compra" : "Registrar pedido"
                    )}
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
        </fieldset>
      </main>
      {orderId && orderData?.commercialStage === "LEAD" && (
        <PaymentVerificationModal
          open={leadPaymentOpen}
          onClose={() => setLeadPaymentOpen(false)}
          orderId={orderId}
          orderNumber={orderData.orderNumber}
          canApprove={false}
          onPaymentUpdated={() => void refreshOrderPayments()}
        />
      )}
      <OrderReceiptModal
        open={receiptOpen}
        orderId={receiptOrderId}
        onClose={() => {
          setReceiptOpen(false);
          router.push("/ventas");
        }}
      />
    </div>
  );
}

function ScopedRegistrarVentaContent() {
  const { auth } = useAuth();
  const searchParams = useSearchParams();
  // Renewing the bearer keeps the draft. A different account, company or order
  // starts a fresh editor, including the pack engine's state.
  const scope = `${auth?.user.id ?? ""}:${auth?.company?.id ?? ""}:${searchParams.get("orderId") ?? "new"}`;
  return (
    <PacksProvider key={scope}>
      <RegistrarVentaContent />
    </PacksProvider>
  );
}

export default function RegistrarVentaPage() {
  return (
    <Suspense
      fallback={<div className="flex items-center justify-center h-screen">Cargando...</div>}
    >
      <ScopedRegistrarVentaContent />
    </Suspense>
  );
}
