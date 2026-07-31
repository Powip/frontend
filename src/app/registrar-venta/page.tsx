"use client";

import {
  Suspense,
  useEffect,
  useState,
  useRef,
  useMemo,
  useCallback,
} from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Search,
  User,
  Package,
  ShoppingCart,
  ClipboardList,
  CreditCard,
  Store,
  ChevronDown,
  Check,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Combobox } from "@/components/ui/combobox";
import { Badge } from "@/components/ui/badge";
import { HeaderConfig } from "@/components/header/HeaderConfig";
import {
  createClient,
  fetchClientByPhone,
  updateClient,
} from "@/services/clients.service";
import { useAuth } from "@/contexts/AuthContext";
import { isSuperadmin, hasAdminAccess } from "@/config/permissions.config";
import { Client, ClientType, DocumentType } from "@/interfaces/ICliente";
import { searchInventoryItems } from "@/services/inventoryItems.service";
import {
  bumpProductFrequency,
  getProductFrequencies,
} from "@/utils/productFrequency";
import { InventoryItemForSale } from "@/interfaces/IProduct";
import { CartItem, OrderHeader } from "@/interfaces/IOrder";
import { DeliveryType, OrderType, SalesChannel } from "@/enum/Order.enum";
import axiosAuth from "@/lib/axiosAuth";
import { GATEWAY } from "@/lib/gateway";
import { toast } from "sonner";
import OrderReceiptModal from "@/components/modals/orderReceiptModal";
import { useRouter, useSearchParams } from "next/navigation";
import { Checkbox } from "@/components/ui/checkbox";
import ubigeos from "@/utils/json/ubigeos.json";
import { DEFAULT_SALES_CHANNELS } from "@/utils/salesChannels";
import { PacksProvider, usePacks } from "@/contexts/PacksContext";
import { usePacksEngine } from "@/hooks/usePacksEngine";
import ProductSearchMatrix from "@/components/registrar-venta/ProductSearchMatrix";
import CartLines from "@/components/registrar-venta/CartLines";
import SuggestionsPanel from "@/components/registrar-venta/SuggestionsPanel";
import { GiftOption, Pack, VolumePack } from "@/interfaces/IPack";

type ClientSearchState = "idle" | "found" | "not_found";

const TONE_CLASSES = {
  violet:
    "bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300",
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
        {hint && (
          <div className="text-xs font-normal text-muted-foreground">
            {hint}
          </div>
        )}
      </div>
    </div>
  );
}

function Disclosure({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-3 border-t border-dashed pt-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-xs font-bold text-violet-600 dark:text-violet-300"
      >
        <ChevronDown
          className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`}
        />
        {label}
      </button>
      {open && (
        <div className="mt-3.5 space-y-3.5 animate-in fade-in slide-in-from-top-1">
          {children}
        </div>
      )}
    </div>
  );
}

function extractLatLngFromGoogleMapsUrl(
  url: string,
): { lat: number; lng: number } | null {
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
  const isPromo = searchParams.get("isPromo") === "true";

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
      ...(coords
        ? { latitude: String(coords.lat), longitude: String(coords.lng) }
        : {}),
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
  const [selectedInventory, setSelectedInventory] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [productFrequencies, setProductFrequencies] = useState<
    Record<string, number>
  >({});

  /* ---------------- Detalles ---------------- */

  const [orderDetails, setOrderDetails] = useState({
    orderType: OrderType.VENTA as OrderType | undefined,
    salesChannel: undefined as SalesChannel | undefined,
    closingChannel: undefined as SalesChannel | undefined,
    deliveryType: DeliveryType.DOMICILIO as DeliveryType | undefined,
    entregaEn: "DOMICILIO" as "DOMICILIO" | "SUCURSAL" | undefined,
    enviaPor: undefined as string | undefined,
    notes: "",
  });
  const [salesRegion, setSalesRegion] = useState<"LIMA" | "PROVINCIA">("LIMA");

  /* ---------------- Ubigeo Options ---------------- */
  const departmentOptions = useMemo(() => {
    return (ubigeos[0] as any).departments.map((d: any) => ({
      value: d.name,
      label: d.name,
    }));
  }, []);

  const provinceOptions = useMemo(() => {
    const dept = (ubigeos[0] as any).departments.find(
      (d: any) => d.name === clientForm.department,
    );
    return (dept?.provinces || []).map((p: any) => ({
      value: p.name,
      label: p.name,
    }));
  }, [clientForm.department]);

  const districtOptions = useMemo(() => {
    const dept = (ubigeos[0] as any).departments.find(
      (d: any) => d.name === clientForm.department,
    );
    const prov = dept?.provinces.find(
      (p: any) => p.name === clientForm.province,
    );
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

  const [taxMode, setTaxMode] = useState<"AUTOMATICO" | "INCLUIDO">("INCLUIDO");
  const [paymentProofFile, setPaymentProofFile] = useState<File | null>(null);
  const [paymentProofPreview, setPaymentProofPreview] = useState<string | null>(
    null,
  );
  const paymentProofInputRef = useRef<HTMLInputElement>(null);

  /* ---------------- Modal ---------------- */

  const [receiptOrderId, setReceiptOrderId] = useState("");
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSubmittingRef = useRef(false);

  /* ---------------- Modal ---------------- */
  const [orderData, setOrderData] = useState<OrderHeader | null>(null);

  /* ---------------- Meta Publi ID ---------------- */
  const [metaPubliId, setMetaPubliId] = useState("");

  const { auth, selectedStoreId, setSelectedStore, inventories } = useAuth();

  const companyId = auth?.company?.id;
  const stores = auth?.company?.stores ?? [];
  const salesChannels = auth?.company?.sales_channels?.length
    ? auth.company.sales_channels
    : DEFAULT_SALES_CHANNELS;
  // Los canales de cierre usan la misma lista que los canales de venta
  const closingChannels = salesChannels;

  /* ---------------- Couriers ---------------- */
  const [couriers, setCouriers] = useState<{ id: string; name: string }[]>([]);
  const [isLoadingCouriers, setIsLoadingCouriers] = useState(false);

  useEffect(() => {
    if (!companyId) return;
    setIsLoadingCouriers(true);
    axiosAuth
      .get<{ id: string; name: string; companyId: string }[]>(
        `${GATEWAY.courier}/couriers/company/${companyId}`,
      )
      .then((res) => setCouriers(res.data))
      .catch(() => setCouriers([]))
      .finally(() => setIsLoadingCouriers(false));
  }, [companyId]);

  const isIdle = searchState === "idle";
  const isFound = searchState === "found";
  const isNotFound = searchState === "not_found";

  const formEnabled = !isIdle;

  const loadOrder = useCallback(async () => {
    if (!orderId) {
      setOrderData(null);
      return;
    }
    try {
      const response = await axiosAuth.get(
        `${GATEWAY.ventas}/order-header/${orderId}`,
      );

      setOrderData(response.data);
    } catch (error) {
      console.error("Error al obtener la Order", error);
    }
  }, [orderId]);

  useEffect(() => {
    loadOrder();
  }, [loadOrder]);

  useEffect(() => {
    if (!orderData) return;

    // --- Cliente ---
    const cust = orderData.customer;
    setClientFound(cust);
    setOriginalClient(cust);
    setClientForm({
      fullName: cust.fullName ?? "",
      phoneNumber: cust.phoneNumber ?? "",
      documentType: cust.documentType,
      documentNumber: cust.documentNumber ?? "",
      clientType: cust.clientType,
      department: cust.city ?? "",
      province: cust.province ?? "",
      district: cust.district ?? "",
      address: cust.address ?? "",
      reference: cust.reference ?? "",
      latitude: cust.latitude != null ? String(cust.latitude) : "",
      longitude: cust.longitude != null ? String(cust.longitude) : "",
      googleMapsUrl: cust.googleMapsUrl ?? "",
    });
    setSearchState("found");

    // --- Detalles de la venta ---
    setOrderDetails({
      orderType: orderData.orderType as OrderType,
      salesChannel: orderData.salesChannel as SalesChannel,
      closingChannel: orderData.closingChannel as SalesChannel,
      deliveryType: orderData.deliveryType as DeliveryType,
      entregaEn:
        orderData.deliveryType === "RETIRO_TIENDA" ? "SUCURSAL" : "DOMICILIO",
      enviaPor: orderData.courier ?? undefined,
      notes: orderData.notes ?? "",
    });

    setSalesRegion(orderData.salesRegion);

    // --- Costo de envío ---
    const shippingValue = Number(orderData.shippingTotal) || 0;
    setShippingTotal(shippingValue);
    setShippingTotalDisplay(shippingValue === 0 ? "" : String(shippingValue));

    // --- Productos ---
    const mappedCart: CartItem[] = orderData.items.map((item) => ({
      id: crypto.randomUUID(),
      inventoryItemId: item.productVariantId,
      variantId: item.productVariantId,
      productName: item.productName,
      sku: item.sku,
      attributes: item.attributes,
      quantity: item.quantity,
      price: Number(item.unitPrice),
      pvp: Number(item.unitPrice),
      discount: Number(item.discountAmount) || 0,
      packId: null,
    }));
    setCart(mappedCart);

    // --- Modo de impuestos ---
    if (orderData.taxMode) {
      setTaxMode(orderData.taxMode as "AUTOMATICO" | "INCLUIDO");
    }

    // --- Pagos ---
    if (orderData.payments?.length) {
      // Sumar todos los pagos (PAID + PENDING)
      const totalPaidApproved = orderData.payments
        .filter((p) => p.status === "PAID")
        .reduce((sum, p) => sum + Number(p.amount), 0);

      const totalPending = orderData.payments
        .filter((p) => p.status === "PENDING")
        .reduce((sum, p) => sum + Number(p.amount), 0);

      // Mostrar el total de pagos (aprobados + pendientes)
      const totalAdv = totalPaidApproved + totalPending;
      setAdvancePayment(totalAdv);
      setAdvancePaymentDisplay(totalAdv === 0 ? "" : String(totalAdv));

      // Usar el método del primer pago (sea PAID o PENDING)
      const firstPayment = orderData.payments[0];
      if (firstPayment) {
        setPaymentMethod(firstPayment.paymentMethod);
      }
    }
  }, [orderData]);

  useEffect(() => {
    if (searchState === "found" && clientFound) {
      setClientForm({
        fullName: clientFound.fullName ?? "",
        phoneNumber: clientFound.phoneNumber ?? "",
        documentType: clientFound.documentType,
        documentNumber: clientFound.documentNumber ?? "",
        clientType: clientFound.clientType,
        department: clientFound.city ?? "",
        province: clientFound.province ?? "",
        district: clientFound.district ?? "",
        address: clientFound.address ?? "",
        reference: clientFound.reference ?? "",
        latitude:
          clientFound.latitude != null ? String(clientFound.latitude) : "",
        longitude:
          clientFound.longitude != null ? String(clientFound.longitude) : "",
        googleMapsUrl: clientFound.googleMapsUrl ?? "",
      });
    }
  }, [searchState, clientFound]);

  useEffect(() => {
    if (searchState === "not_found") {
      setClientForm({
        ...emptyClientForm,
        phoneNumber: clientForm.phoneNumber,
      });
    }
  }, [searchState, clientForm.phoneNumber]);

  useEffect(() => {
    setSelectedInventory(inventories[0]?.id || "");
    setProducts([]);
    setProductsMeta(null);
  }, [selectedStoreId, inventories]);

  useEffect(() => {
    setProductFrequencies(getProductFrequencies(companyId));
  }, [companyId]);

  /* ---------------- Actions ---------------- */

  const searchProducts = useCallback(
    async (page = 1) => {
      if (!selectedInventory) return;

      try {
        setProductsLoading(true);

        const res = await searchInventoryItems({
          inventoryId: selectedInventory,
          companyId,
          q: productQuery || undefined,
          page,
          limit: 12,
        });

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
      } catch {
        // product search failure is silent
      } finally {
        setProductsLoading(false);
      }
    },
    [selectedInventory, productQuery, companyId],
  );

  const handleLoadMore = () => {
    if (
      productsLoading ||
      !productsMeta ||
      productsPage >= productsMeta.totalPages
    )
      return;
    searchProducts(productsPage + 1);
  };

  /* ---------------- Packs & Promos (solo UI) ---------------- */
  const isAdmin =
    isSuperadmin(auth?.user?.email) || hasAdminAccess(auth?.user?.role);
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
    const falta =
      pack.minQty - packsEngine.modelQtyInCart(pack.product.productKey);
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
    const ok = packsEngine.pvsConfirm();
    if (ok) toast.success("Pack aplicado");
    else
      toast.error(
        `Asigna ${(packs.find((p) => p.id === packsEngine.pvsOpen?.packId) as VolumePack | undefined)?.minQty ?? 0} unidades`,
      );
  };

  const handleChooseGift = (packId: string, gift: GiftOption) => {
    packsEngine.chooseGift(packId, gift);
    toast.success(`Regalo: ${gift.productName}`);
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
      // client search failure is silent
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
      closingChannel: undefined,
      deliveryType: undefined,
      entregaEn: undefined,
      enviaPor: undefined,
      notes: "",
    });
    setSalesRegion("LIMA");

    // Pagos
    setPaymentMethod("");
    setShippingTotal(0);
    setShippingTotalDisplay("");
    setAdvancePayment(0);
    setAdvancePaymentDisplay("");
    setPaymentProofFile(null);
    setPaymentProofPreview(null);
    setTaxMode("INCLUIDO");

    // Order data (para modo edición)
    setOrderData(null);

    // Meta Publi ID
    setMetaPubliId("");
  };

  // Auto-calcular salesRegion basándose en el departamento del cliente
  useEffect(() => {
    if (clientForm.department) {
      const autoRegion =
        clientForm.department.toUpperCase() === "LIMA" ? "LIMA" : "PROVINCIA";
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
    if (!selectedInventory) return;
    setProductsLoading(true);
    const timer = setTimeout(() => {
      searchProducts(1);
    }, 500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productQuery]);

  const validateClientForm = () => {
    const errors: Partial<Record<keyof typeof emptyClientForm, string>> = {};
    if (!clientForm.fullName.trim())
      errors.fullName = "Debes completar este dato.";
    if (!clientForm.province.trim())
      errors.province = "Debes completar este dato.";
    if (!clientForm.department.trim())
      errors.department = "Debes completar este dato.";
    if (!clientForm.district.trim())
      errors.district = "Debes completar este dato.";
    if (!clientForm.address.trim())
      errors.address = "Debes completar este dato.";

    if (clientForm.documentType) {
      if (!clientForm.documentNumber.trim()) {
        errors.documentNumber = "Debes completar este dato.";
      } else if (
        clientForm.documentType === "DNI" &&
        !/^\d{7,8}$/.test(clientForm.documentNumber)
      ) {
        errors.documentNumber = "DNI debe tener 7 u 8 dígitos.";
      }
    }

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
        documentNumber: clientForm.documentType
          ? clientForm.documentNumber
          : undefined,
        clientType: clientForm.clientType,
        province: clientForm.province,
        city: clientForm.department,
        district: clientForm.district,
        address: clientForm.address,
        reference: clientForm.reference || undefined, // Evita "" que falla en backend
        latitude: clientForm.latitude ? Number(clientForm.latitude) : undefined,
        longitude: clientForm.longitude
          ? Number(clientForm.longitude)
          : undefined,
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

  const handleConfirmSale = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();

    // Guard: prevent double-click submission
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setIsSubmitting(true);

    try {
      // Cerrar cualquier Select/Popover abierto antes de iniciar el submit
      // para evitar que Radix quede en estado inconsistente si hay error
      (document.activeElement as HTMLElement)?.blur();

      let activeClient = clientFound;

      // Auto-crear cliente nuevo si no existe en el sistema
      if (isNotFound) {
        if (!auth?.company?.id) return;
        if (!validateClientForm()) {
          toast.error(
            "Por favor completa los campos del cliente correctamente.",
          );
          return;
        }
        try {
          const createdClient = await createClient({
            companyId: auth.company.id,
            fullName: clientForm.fullName,
            phoneNumber: clientForm.phoneNumber || undefined,
            documentType: clientForm.documentType,
            documentNumber: clientForm.documentType
              ? clientForm.documentNumber
              : undefined,
            clientType: clientForm.clientType,
            province: clientForm.province,
            city: clientForm.department,
            district: clientForm.district,
            address: clientForm.address,
            reference: clientForm.reference || undefined,
            latitude: clientForm.latitude
              ? Number(clientForm.latitude)
              : undefined,
            longitude: clientForm.longitude
              ? Number(clientForm.longitude)
              : undefined,
            googleMapsUrl: clientForm.googleMapsUrl || undefined,
          });
          setClientFound(createdClient);
          setOriginalClient(createdClient);
          setSearchState("found");
          setClientErrors({});
          activeClient = createdClient;
        } catch {
          toast.error("Error al crear el cliente. Verifica los datos.");
          return;
        }
      }
      // Auto-guardar cambios del cliente si tiene modificaciones sin guardar
      else if (isFound && hasClientChanges && clientFound?.id) {
        try {
          const updated = await updateClient(clientFound.id, {
            companyId: auth?.company?.id,
            fullName: clientForm.fullName,
            phoneNumber: clientForm.phoneNumber,
            documentType: clientForm.documentType,
            documentNumber: clientForm.documentType
              ? clientForm.documentNumber
              : undefined,
            clientType: clientForm.clientType,
            province: clientForm.province,
            city: clientForm.department,
            district: clientForm.district,
            address: clientForm.address,
            reference: clientForm.reference || undefined,
            latitude: clientForm.latitude
              ? Number(clientForm.latitude)
              : undefined,
            longitude: clientForm.longitude
              ? Number(clientForm.longitude)
              : undefined,
            googleMapsUrl: clientForm.googleMapsUrl || undefined,
          });
          setClientFound(updated);
          setOriginalClient(updated);
          activeClient = updated;
        } catch {
          toast.error("Error al guardar los cambios del cliente.");
          return;
        }
      }

      if (!activeClient?.id) {
        console.error("❌ No hay customerId");
        toast.error("No se pudo identificar el cliente");
        return;
      }

      const sellerDisplayName = `${auth?.user?.name || ""} ${
        auth?.user?.surname || ""
      }`.trim();

      // El precio de cierre (item.price) ya refleja cualquier descuento manual,
      // % o pack aplicado — acá solo reconstruimos el monto de descuento en
      // formato FIXED para que discountType/discountAmount no queden en
      // "NONE"/0 cuando la línea sí tiene descuento (item.discount es un
      // campo legado que el editor de precios/packs nunca actualiza).
      // packId/isGift/giftValue van igual: si el backend de order-header
      // todavía no los conoce los va a ignorar, pero quedan listos para
      // cuando los soporte (ver lista de gaps pedida al backend).
      const buildOrderItem = (item: CartItem) => {
        const pvp = item.pvp ?? item.price;
        const discountAmount = Math.max(
          0,
          Math.round((pvp - item.price) * 100) / 100,
        );
        return {
          productVariantId: item.variantId,
          sku: item.sku,
          productName: item.productName,
          quantity: item.quantity,
          unitPrice: item.price,
          discountType: discountAmount > 0 ? "FIXED" : "NONE",
          discountAmount,
          attributes: item.attributes,
          packId: item.packId ?? null,
          isGift: item.isGift ?? false,
          ...(item.isGift ? { giftValue: item.giftValue ?? 0 } : {}),
        };
      };

      const payload = {
        // --- Comprobante ---
        receiptType: "BOLETA",
        orderType: orderDetails.orderType, // VENTA

        // --- Contexto ---
        storeId: selectedStoreId,

        // --- Canales ---
        salesChannel: orderDetails.salesChannel,
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

        // --- Pagos (siempre incluir) ---
        payments:
          advancePayment > 0
            ? [
                {
                  paymentMethod,
                  amount: advancePayment,
                  paymentDate: new Date().toISOString(),
                },
              ]
            : [
                {
                  paymentMethod: paymentMethod || "EFECTIVO",
                  amount: 0,
                  paymentDate: new Date().toISOString(),
                },
              ],

        // --- Usuario (para log de auditoría) ---
        userId: auth?.user?.id ?? null,

        // --- Meta Publi ID (opcional) ---
        ...(metaPubliId.trim() ? { metaPubliId: metaPubliId.trim() } : {}),
      };

      try {
        if (!orderData) {
          const response = await axiosAuth.post(
            `${GATEWAY.ventas}/order-header`,
            payload,
          );

          const createdOrderId = response.data.id;

          // Si hay comprobante de pago, subirlo al pago recién creado
          if (paymentProofFile && response.data.payments?.length > 0) {
            const firstPaymentId = response.data.payments[0].id;
            try {
              const formData = new FormData();
              formData.append("file", paymentProofFile);

              await axiosAuth.patch(
                `${GATEWAY.ventas}/payments/payments/${firstPaymentId}/upload-proof`,
                formData,
                {
                  headers: {
                    "Content-Type": "multipart/form-data",
                  },
                },
              );
            } catch {
              toast.warning(
                "Venta creada pero hubo un error al subir el comprobante",
              );
            }
          }

          toast.success("Venta registrada");
          setReceiptOrderId(createdOrderId);
          setReceiptOpen(true);
          resetForm();
        } else {
          // Actualizar orden existente
          // El status solo se resetea a PENDIENTE si el usuario seleccionó manualmente el tipo CAMBIO
          const newStatus =
            orderDetails.orderType === OrderType.CAMBIO
              ? "PENDIENTE"
              : orderData.status;

          const updatePayload = {
            orderType: orderDetails.orderType,
            status: newStatus,
            salesChannel: orderDetails.salesChannel,
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
            // Datos de pago
            paymentMethod: paymentMethod || null,
            paymentAmount: advancePayment,
            sellerName: sellerDisplayName || null,
          };

          await axiosAuth.put(
            `${GATEWAY.ventas}/order-header/${orderData.id}`,
            updatePayload,
          );

          const updatedId = orderData.id;
          toast.success("Venta actualizada correctamente");
          resetForm();
          setReceiptOrderId(updatedId);
          setReceiptOpen(true);
        }
      } catch {
        toast.error("Error al registrar la venta");
      } finally {
        setIsSubmitting(false);
      }
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const addToCart = (product: InventoryItemForSale) => {
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
        return prev.map((p) =>
          p.id === existing.id ? { ...p, quantity: p.quantity + 1 } : p,
        );
      }

      return [
        ...prev,
        {
          id: crypto.randomUUID(),
          inventoryItemId: product.inventoryItemId,
          variantId: product.variantId,
          productName: product.productName,
          sku: product.sku,
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
    setCart((prev) => {
      const existing = prev.find(
        (p) =>
          p.inventoryItemId === product.inventoryItemId &&
          p.variantId === product.variantId &&
          !p.packId &&
          !p.isGift,
      );
      if (existing) {
        return prev.map((p) =>
          p.id === existing.id ? { ...p, quantity: p.quantity + qty } : p,
        );
      }
      return [
        ...prev,
        {
          id: crypto.randomUUID(),
          inventoryItemId: product.inventoryItemId,
          variantId: product.variantId,
          productName: product.productName,
          sku: product.sku,
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
    setCart((prev) => prev.filter((item) => item.id !== cartItemId));
  };

  const handleCartQtyChange = (cartItemId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((p) =>
          p.id === cartItemId ? { ...p, quantity: p.quantity + delta } : p,
        )
        .filter((p) => p.quantity > 0),
    );
  };

  const handleSetPrice = (cartItemId: string, price: number) => {
    const net = Math.round(price * 100) / 100;
    setCart((prev) =>
      prev.map((p) =>
        p.id === cartItemId
          ? { ...p, price: net, discMode: "man", discValue: net }
          : p,
      ),
    );
  };

  const handleApplyDiscount = (
    cartItemId: string,
    mode: "pct" | "amt",
    value: number,
  ) => {
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
      prev.map((p) =>
        ids.has(p.id)
          ? { ...p, price: net, discMode: "man", discValue: net }
          : p,
      ),
    );
    toast.success(
      `Precio S/ ${price.toFixed(2)} aplicado a ${ids.size} ítem(s)`,
    );
  };

  const handleBulkDiscount = (pct: number) => {
    const ids = new Set(editableCartLines().map((l) => l.id));
    setCart((prev) =>
      prev.map((p) =>
        ids.has(p.id)
          ? {
              ...p,
              price: Math.max(
                0,
                Math.round((p.pvp ?? p.price) * (1 - pct / 100) * 100) / 100,
              ),
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
        ids.has(p.id)
          ? { ...p, price: p.pvp ?? p.price, discMode: null, discValue: null }
          : p,
      ),
    );
    toast.success("Precios restaurados a PVP");
  };

  const handleUpdateClient = async () => {
    if (!clientFound?.id || !auth?.company?.id) return;

    try {
      const updated = await updateClient(clientFound.id, {
        companyId: auth.company.id,
        fullName: clientForm.fullName,
        phoneNumber: clientForm.phoneNumber,
        documentType: clientForm.documentType,
        documentNumber: clientForm.documentType
          ? clientForm.documentNumber
          : undefined,
        clientType: clientForm.clientType,
        province: clientForm.province,
        city: clientForm.department, // Mapear department a city
        district: clientForm.district,
        address: clientForm.address,
        reference: clientForm.reference || undefined,
        latitude: clientForm.latitude ? Number(clientForm.latitude) : undefined,
        longitude: clientForm.longitude
          ? Number(clientForm.longitude)
          : undefined,
        googleMapsUrl: clientForm.googleMapsUrl || undefined,
      });

      setClientFound(updated);
      setOriginalClient(updated);
      toast.success("Cliente actualizado");
    } catch {
      toast.error("Error al actualizar cliente");
    }
  };

  /* ---------------- Totales ---------------- */
  // Subtotal bruto (PVP * cantidad) — antes se calculaba como price*qty
  // (que ya es el precio de cierre, no el bruto) y el descuento salía de
  // item.discount, un campo que el editor de precios/packs nunca actualiza.
  // Eso hacía que "Total descuentos" nunca se mostrara aunque la línea sí
  // tuviera descuento o pack aplicado.
  const subtotalBruto = cart.reduce(
    (acc, p) => acc + (p.pvp ?? p.price) * p.quantity,
    0,
  );
  // Subtotal neto (precio de cierre real, después de descuentos/packs)
  const subtotal = cart.reduce((acc, p) => acc + p.price * p.quantity, 0);
  // Total de descuentos por item, derivado (bruto - neto)
  const totalItemDiscounts = Math.max(0, subtotalBruto - subtotal);
  // Si INCLUIDO, los precios ya incluyen impuestos
  const taxes = taxMode === "INCLUIDO" ? 0 : subtotal * 0.18;

  const grandTotal = subtotal + taxes + shippingTotal;

  const pendingPayment = Math.max(grandTotal - advancePayment, 0);

  /* ---------------- Validaciones ---------------- */

  const hasValidCart =
    cart.length > 0 &&
    cart.every((item) => item.quantity > 0 && item.price >= 0);

  const hasValidDelivery =
    orderDetails.deliveryType === DeliveryType.RETIRO_TIENDA ||
    (orderDetails.deliveryType && orderDetails.enviaPor);

  const hasValidPayments = !!paymentMethod;

  // Cliente válido: ya encontrado/creado, o nuevo con los datos mínimos requeridos
  const hasValidClientForNew =
    isNotFound &&
    !!clientForm.fullName.trim() &&
    !!clientForm.province.trim() &&
    !!clientForm.department.trim() &&
    !!clientForm.district.trim() &&
    !!clientForm.address.trim() &&
    (!clientForm.documentType || !!clientForm.documentNumber.trim());

  const canSubmit =
    (!!clientFound || hasValidClientForNew) &&
    hasValidCart &&
    !!orderDetails.orderType &&
    !!orderDetails.salesChannel &&
    !!orderDetails.closingChannel &&
    hasValidDelivery &&
    hasValidPayments &&
    !packsEngine.pvsOpen;

  const checklist = [
    { ok: hasValidCart, msg: "Agrega al menos un producto al carrito" },
    {
      ok: !!clientFound || hasValidClientForNew,
      msg: "Completa los datos del cliente (nombre, dirección)",
    },
    { ok: !!orderDetails.orderType, msg: "Selecciona el tipo de orden" },
    { ok: !!orderDetails.salesChannel, msg: "Selecciona el canal de venta" },
    { ok: !!orderDetails.closingChannel, msg: "Selecciona el canal de cierre" },
    { ok: hasValidDelivery, msg: "Configura el método de entrega" },
    { ok: hasValidPayments, msg: "Selecciona el método de pago" },
  ];
  const checklistDone = checklist.filter((c) => c.ok).length;
  const checklistPct = Math.round((checklistDone / checklist.length) * 100);

  const hasClientChanges =
    originalClient &&
    JSON.stringify(clientForm) !==
      JSON.stringify({
        fullName: originalClient.fullName,
        phoneNumber: originalClient.phoneNumber,
        documentType: originalClient.documentType,
        documentNumber: originalClient.documentNumber,
        clientType: originalClient.clientType,
        province: originalClient.province,
        department: originalClient.city,
        district: originalClient.district,
        address: originalClient.address,
        reference: originalClient.reference,
        latitude:
          originalClient.latitude != null
            ? String(originalClient.latitude)
            : "",
        longitude:
          originalClient.longitude != null
            ? String(originalClient.longitude)
            : "",
        googleMapsUrl: originalClient.googleMapsUrl ?? "",
      });

  if (!auth) return null;

  return (
    <div className="flex h-screen w-full [--primary:#6D4FE0] [--primary-foreground:#ffffff] [--ring:#8067F0] dark:[--primary:#9B85FF] dark:[--ring:#8A72F5]">
      <main className="flex-1 overflow-auto bg-gradient-to-b from-muted/40 to-transparent">
        <div className="mx-auto max-w-[1400px] p-6 space-y-6 lg:p-8">
          {/* Header */}
          <div className="flex items-center gap-4">
            <Link href="/ventas">
              <Button variant="outline" size="sm" className="rounded-full">
                <ArrowLeft className="h-4 w-4 mr-1" />
                Volver
              </Button>
            </Link>
            <HeaderConfig
              title="Registrar venta"
              description="Carga completa de una venta"
            />
          </div>

          <div className="grid gap-6 items-start lg:grid-cols-[1fr_400px]">
            <div className="space-y-6 min-w-0">
              {/* Cliente */}
              <Card>
                <CardHeader>
                  <CardTitle>
                    <SectionTitle
                      icon={User}
                      hint="Busca por teléfono o crea uno nuevo"
                    >
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
                        onChange={(e) =>
                          setClientForm({
                            ...clientForm,
                            phoneNumber: e.target.value,
                          })
                        }
                        onKeyDown={(e) => e.key === "Enter" && searchClient()}
                      />
                      <Button
                        onClick={searchClient}
                        disabled={!clientForm.phoneNumber || loadingClient}
                      >
                        <Search className="h-4 w-4" />
                      </Button>

                      {(isFound || isNotFound) && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={clearClient}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Formulario */}
                  <div className="p-4 space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label
                          className={
                            clientErrors.fullName ? "text-destructive" : ""
                          }
                        >
                          Nombre completo
                        </Label>
                        <Input
                          disabled={!formEnabled}
                          value={clientForm.fullName}
                          className={
                            clientErrors.fullName ? "border-destructive" : ""
                          }
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
                          <p className="text-xs text-destructive">
                            {clientErrors.fullName}
                          </p>
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
                            <SelectItem value="TRADICIONAL">
                              Tradicional
                            </SelectItem>
                            <SelectItem value="MAYORISTA">Mayorista</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

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

                    <div className="space-y-2">
                      <Label
                        className={
                          clientErrors.address ||
                          clientErrors.department ||
                          clientErrors.province ||
                          clientErrors.district
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
                            className={
                              clientErrors.department
                                ? "border-destructive"
                                : ""
                            }
                          />
                          {clientErrors.department && (
                            <p className="text-[10px] text-destructive mt-1">
                              {clientErrors.department}
                            </p>
                          )}
                        </div>

                        <div>
                          <Combobox
                            disabled={
                              !formEnabled ||
                              !clientForm.department ||
                              isSubmitting
                            }
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
                            className={
                              clientErrors.province ? "border-destructive" : ""
                            }
                          />
                          {clientErrors.province && (
                            <p className="text-[10px] text-destructive mt-1">
                              {clientErrors.province}
                            </p>
                          )}
                        </div>

                        <div>
                          <Combobox
                            disabled={
                              !formEnabled ||
                              !clientForm.province ||
                              isSubmitting
                            }
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
                            className={
                              clientErrors.district ? "border-destructive" : ""
                            }
                          />
                          {clientErrors.district && (
                            <p className="text-[10px] text-destructive mt-1">
                              {clientErrors.district}
                            </p>
                          )}
                        </div>
                      </div>

                      <div>
                        <Input
                          disabled={!formEnabled}
                          placeholder="Dirección exacta"
                          value={clientForm.address}
                          className={
                            clientErrors.address ? "border-destructive" : ""
                          }
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
                          <p className="text-xs text-destructive mt-1">
                            {clientErrors.address}
                          </p>
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
                        Se calcula automáticamente según el departamento, pero
                        puedes cambiarlo manualmente.
                      </p>
                    </div>

                    <Disclosure label="Agregar documento, referencia y ubicación (opcional)">
                      <div className="grid grid-cols-2 gap-2">
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
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Tipo de documento" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="NONE">No aplica</SelectItem>
                            <SelectItem value="DNI">DNI</SelectItem>
                            <SelectItem value="CARNET">
                              Carnet de Extranjería
                            </SelectItem>
                            <SelectItem value="PASAPORTE">Pasaporte</SelectItem>
                          </SelectContent>
                        </Select>

                        <div>
                          <Input
                            disabled={!formEnabled || !clientForm.documentType}
                            placeholder="Número"
                            value={clientForm.documentNumber}
                            className={
                              clientErrors.documentNumber
                                ? "border-destructive"
                                : ""
                            }
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

                      <div className="space-y-1">
                        <Label>
                          Referencia{" "}
                          <span className="text-muted-foreground font-normal">
                            (opcional)
                          </span>
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
                          <span className="text-muted-foreground font-normal">
                            (opcional)
                          </span>
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
                            No pudimos leer coordenadas en este link. Abre el
                            link, copia la URL completa (con “@lat,lng”) o
                            completa Latitud/Longitud a mano.
                          </p>
                        )}
                        {!mapsLinkStatus && (
                          <p className="text-xs text-muted-foreground">
                            Pega el link para completar Latitud y Longitud
                            automáticamente.
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
                    {isNotFound && clientForm.fullName.trim() && (
                      <div className="flex items-start gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700 dark:border-blue-800 dark:bg-blue-500/10 dark:text-blue-300">
                        <span>ℹ️</span>
                        <span>
                          Se creará un nuevo cliente al confirmar la venta.
                        </span>
                      </div>
                    )}

                    {isFound && hasClientChanges && (
                      <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:border-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
                        <span>⚠️</span>
                        <span>
                          Los datos del cliente se actualizarán automáticamente
                          al confirmar la venta.
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
                    <SectionTitle
                      icon={Package}
                      hint="Elige el almacén y busca modelos"
                    >
                      Productos
                    </SectionTitle>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Contexto: tienda y almacén desde donde se vende */}
                  <div className="flex flex-col gap-3 rounded-xl border bg-muted/20 p-3 sm:flex-row sm:items-center">
                    <div className="flex shrink-0 items-center gap-1.5 text-xs font-medium text-muted-foreground">
                      <Store className="h-3.5 w-3.5" />
                      Vendiendo desde
                    </div>
                    <div className="grid flex-1 gap-2 sm:grid-cols-2">
                      <Select
                        disabled={orderId !== null || isSubmitting}
                        value={selectedStoreId ?? ""}
                        onValueChange={(storeId) => setSelectedStore(storeId)}
                      >
                        <SelectTrigger className="h-9 bg-background">
                          <SelectValue placeholder="Tienda" />
                        </SelectTrigger>
                        <SelectContent>
                          {stores.map((store) => (
                            <SelectItem key={store.id} value={store.id}>
                              {store.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Select
                        value={selectedInventory}
                        disabled={!selectedStoreId || isSubmitting}
                        onValueChange={(inventoryId) =>
                          setSelectedInventory(inventoryId)
                        }
                      >
                        <SelectTrigger className="h-9 bg-background">
                          <SelectValue placeholder="Almacén" />
                        </SelectTrigger>
                        <SelectContent>
                          {inventories.map((inv) => (
                            <SelectItem key={inv.id} value={inv.id}>
                              {inv.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Buscador de productos */}
                  <div className="space-y-1.5">
                    <div className="relative">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        className="h-11 rounded-xl pl-10 pr-9 text-[15px] focus-visible:ring-4 focus-visible:ring-primary/10"
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
                      hasMore={
                        productsMeta
                          ? products.length < productsMeta.total
                          : false
                      }
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
                    <SectionTitle icon={ShoppingCart}>
                      Detalle de la venta
                    </SectionTitle>
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
                    pendingHints={packsEngine.pendingHints}
                    isAdmin={isAdmin}
                    onQtyChange={handleCartQtyChange}
                    onRemove={removeFromCart}
                    onSetPrice={handleSetPrice}
                    onApplyDiscount={handleApplyDiscount}
                    onClearDiscount={handleClearDiscount}
                    onBulkPrice={handleBulkPrice}
                    onBulkDiscount={handleBulkDiscount}
                    onRestorePvp={handleRestorePvp}
                    onApplyPack={handleApplyPack}
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
                </CardContent>
              </Card>

              {/* Detalles */}
              <Card>
                <CardHeader>
                  <CardTitle>
                    <SectionTitle icon={ClipboardList}>
                      Detalles de la venta
                    </SectionTitle>
                  </CardTitle>
                </CardHeader>

                <CardContent className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    {/* Tipo de orden */}
                    <div className="space-y-1">
                      <Label>
                        Tipo de orden{" "}
                        <span className="text-destructive">*</span>
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
                          <SelectItem value={OrderType.CAMBIO}>
                            Cambio
                          </SelectItem>
                          <SelectItem value={OrderType.RESERVA}>
                            Reserva
                          </SelectItem>
                          <SelectItem value={OrderType.PREVENTA}>
                            Preventa
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Canal de venta */}
                    <div className="space-y-1">
                      <Label>
                        Canal de venta{" "}
                        <span className="text-destructive">*</span>
                      </Label>
                      <Select
                        disabled={isSubmitting}
                        value={orderDetails.salesChannel ?? ""}
                        onValueChange={(v) =>
                          setOrderDetails({
                            ...orderDetails,
                            salesChannel: v as any,
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar canal de venta" />
                        </SelectTrigger>
                        <SelectContent>
                          {salesChannels.map((channel: string) => (
                            <SelectItem key={channel} value={channel}>
                              {channel.replace(/_/g, " ")}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Canal de cierre */}
                    <div className="space-y-1">
                      <Label>
                        Canal de cierre{" "}
                        <span className="text-destructive">*</span>
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
                        Tipo de entrega{" "}
                        <span className="text-destructive">*</span>
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
                          <SelectItem value={DeliveryType.DOMICILIO}>
                            Envío a domicilio
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Método de envío */}
                    {orderDetails.deliveryType === DeliveryType.DOMICILIO && (
                      <div className="md:col-span-2 space-y-1">
                        <Label>
                          Método de envío{" "}
                          <span className="text-destructive">*</span>
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
                                isLoadingCouriers
                                  ? "Cargando..."
                                  : "Seleccionar método de envío"
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
                      </div>
                    )}
                  </div>

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
                      <Label>ID de publicidad (Meta)</Label>
                      <Input
                        type="text"
                        placeholder="Opcional — ID del panel de ads"
                        value={metaPubliId}
                        onChange={(e) => setMetaPubliId(e.target.value)}
                      />
                    </div>
                  </Disclosure>
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
                        <SelectValue placeholder="Seleccionar método de pago" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="YAPE">Yape</SelectItem>
                        <SelectItem value="PLIN">Plin</SelectItem>
                        <SelectItem value="TRANSFERENCIA">
                          Transferencia
                        </SelectItem>
                        <SelectItem value="EFECTIVO">Efectivo</SelectItem>
                        <SelectItem value="CONTRA_ENTREGA">
                          Contraentrega
                        </SelectItem>
                        <SelectItem value="BCP">BCP</SelectItem>
                        <SelectItem value="BANCO_NACION">
                          Banco de la Nación
                        </SelectItem>
                        <SelectItem value="MERCADO_PAGO">
                          Pago link - Mercado Pago
                        </SelectItem>
                        <SelectItem value="POS">POS</SelectItem>
                      </SelectContent>
                    </Select>
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
                          setShippingTotalDisplay(
                            numVal === 0 ? "" : String(numVal),
                          );
                        }}
                      />
                    </div>
                  )}

                  {/* Adelanto de pago */}
                  <div className="space-y-1">
                    <Label>Adelanto de Pago</Label>
                    <Input
                      type="text"
                      inputMode="decimal"
                      value={advancePaymentDisplay}
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
                        setAdvancePaymentDisplay(
                          numVal === 0 ? "" : String(numVal),
                        );
                      }}
                    />
                  </div>

                  {/* Comprobante de pago */}
                  <div className="space-y-1">
                    <Label>Comprobante de pago (opcional)</Label>
                    <div
                      className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors
                  ${paymentProofFile ? "border-violet-500 bg-violet-50 dark:bg-violet-500/10" : "border-muted-foreground/25 hover:border-violet-400 hover:bg-muted/30"}`}
                      onClick={() => paymentProofInputRef.current?.click()}
                    >
                      <input
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
                            toast.error(
                              "Tipo de archivo no permitido. Use JPG, PNG, WEBP o PDF.",
                            );
                            return;
                          }

                          if (file.size > 5 * 1024 * 1024) {
                            toast.error(
                              "El archivo es muy grande. Máximo 5MB.",
                            );
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
                          <p className="text-sm text-gray-600">
                            Clic para seleccionar comprobante
                          </p>
                          <p className="text-xs text-gray-400">
                            JPG, PNG, WEBP o PDF (máx. 5MB)
                          </p>
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
                            <p className="text-sm text-violet-600 font-medium">
                              PDF seleccionado
                            </p>
                          )}
                          <p className="text-xs text-gray-600 truncate">
                            {paymentProofFile.name}
                          </p>
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

                  {/* Modo de impuestos */}
                  <div className="space-y-1">
                    <Label>Modo de impuestos</Label>
                    <Select
                      disabled={isSubmitting}
                      value={taxMode}
                      onValueChange={(v) =>
                        setTaxMode(v as "AUTOMATICO" | "INCLUIDO")
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar modo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="AUTOMATICO">
                          Cálculo automático (+18% IGV)
                        </SelectItem>
                        <SelectItem value="INCLUIDO">
                          Impuestos incluidos en precio
                        </SelectItem>
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

              {/* Resumen */}
              <Card className="lg:sticky lg:top-6">
                <CardContent className="pt-6 text-sm space-y-1">
                  <div className="flex justify-between py-0.5 text-muted-foreground">
                    <span>Importe productos</span>
                    <span className="text-foreground">
                      S/ {subtotalBruto.toFixed(2)}
                    </span>
                  </div>
                  {totalItemDiscounts > 0 && (
                    <div className="flex justify-between py-0.5 text-emerald-600 dark:text-emerald-400">
                      <span>Total descuentos</span>
                      <span>- S/ {totalItemDiscounts.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between py-0.5 text-muted-foreground">
                    <span>Sub total</span>
                    <span className="text-foreground">
                      S/ {subtotal.toFixed(2)}
                    </span>
                  </div>
                  {taxMode === "AUTOMATICO" && (
                    <div className="flex justify-between py-0.5 text-muted-foreground">
                      <span>IGV 18%</span>
                      <span className="text-foreground">
                        S/ {taxes.toFixed(2)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between py-0.5 text-muted-foreground">
                    <span>Costo de envío</span>
                    <span className="text-foreground">
                      S/ {shippingTotal.toFixed(2)}
                    </span>
                  </div>
                  {advancePayment > 0 && (
                    <div className="flex justify-between py-0.5 text-muted-foreground">
                      <span>Adelanto de pago</span>
                      <span className="text-foreground">
                        S/ {advancePayment.toFixed(2)}
                      </span>
                    </div>
                  )}

                  <div className="flex items-baseline justify-between border-t pt-3.5 mt-1.5">
                    <span className="text-sm font-bold">Total</span>
                    <span className="text-2xl font-extrabold tracking-tight">
                      S/ {grandTotal.toFixed(2)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between rounded-lg bg-amber-50 border border-amber-100 px-3.5 py-2.5 mt-2.5 dark:bg-amber-500/10 dark:border-amber-800">
                    <span className="text-xs font-bold text-amber-600 dark:text-amber-400">
                      Pendiente de pago
                    </span>
                    <span className="text-[15px] font-extrabold text-amber-600 dark:text-amber-400">
                      S/ {pendingPayment.toFixed(2)}
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
                          {ok && (
                            <Check className="h-2.5 w-2.5" strokeWidth={4} />
                          )}
                        </span>
                        {msg}
                      </li>
                    ))}
                  </ul>

                  <Button
                    type="button"
                    size="lg"
                    className={`w-full rounded-xl text-base font-semibold transition-all ${
                      canSubmit && !isSubmitting
                        ? "bg-gradient-to-br from-violet-600 to-green-600 text-white shadow-lg shadow-violet-600/25 hover:opacity-95"
                        : "bg-muted text-muted-foreground"
                    }`}
                    disabled={!canSubmit || isSubmitting}
                    onClick={handleConfirmSale}
                  >
                    {isSubmitting ? (
                      <span className="flex items-center gap-2">
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        Procesando...
                      </span>
                    ) : orderId ? (
                      "Actualizar venta"
                    ) : (
                      "Confirmar venta"
                    )}
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>
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

export default function RegistrarVentaPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-screen">
          Cargando...
        </div>
      }
    >
      <PacksProvider>
        <RegistrarVentaContent />
      </PacksProvider>
    </Suspense>
  );
}
