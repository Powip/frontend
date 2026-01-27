"use client";

import { Suspense, useEffect, useState, useRef, useMemo } from "react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2, Search } from "lucide-react";
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
import { Client, ClientType, DocumentType } from "@/interfaces/ICliente";
import { searchInventoryItems } from "@/services/inventoryItems.service";
import { InventoryItemForSale } from "@/interfaces/IProduct";
import { CartItem, OrderHeader } from "@/interfaces/IOrder";
import { DeliveryType, OrderType, SalesChannel } from "@/enum/Order.enum";
import axios from "axios";
import { toast } from "sonner";
import OrderReceiptModal from "@/components/modals/orderReceiptModal";
import { useRouter, useSearchParams } from "next/navigation";
import { Checkbox } from "@/components/ui/checkbox";
import ubigeos from "@/utils/json/ubigeos.json";

type ClientSearchState = "idle" | "found" | "not_found";

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
};

function RegistrarVentaContent() {
  /* ---------------- Params ---------------- */
  const searchParams = useSearchParams();
  const orderId = searchParams.get("orderId");
  const isPromo = searchParams.get("isPromo") === "true";

  /* ---------------- Cliente ---------------- */
  const [clientFound, setClientFound] = useState<Client | null>(null);
  const [searchState, setSearchState] = useState<ClientSearchState>("idle");
  const [loadingClient, setLoadingClient] = useState(false);
  const [originalClient, setOriginalClient] = useState<Client | null>(null);
  const [clientForm, setClientForm] = useState(emptyClientForm);

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

  /* ---------------- Detalles ---------------- */

  const [orderDetails, setOrderDetails] = useState({
    orderType: undefined as OrderType | undefined,
    salesChannel: undefined as SalesChannel | undefined,
    closingChannel: undefined as SalesChannel | undefined,
    deliveryType: undefined as DeliveryType | undefined,
    entregaEn: undefined as "DOMICILIO" | "SUCURSAL" | undefined,
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

  /* ---------------- Modal ---------------- */
  const [orderData, setOrderData] = useState<OrderHeader | null>(null);

  const { auth, selectedStoreId, setSelectedStore, inventories } = useAuth();

  const companyId = auth?.company?.id;
  const stores = auth?.company?.stores ?? [];

  const isIdle = searchState === "idle";
  const isFound = searchState === "found";
  const isNotFound = searchState === "not_found";

  const formEnabled = !isIdle;

  useEffect(() => {
    if (!orderId) return;

    const loadOrder = async () => {
      try {
        const response = await axios.get(
          `${process.env.NEXT_PUBLIC_API_VENTAS}/order-header/${orderId}`,
        );

        setOrderData(response.data);
      } catch (error) {
        console.log("Error al obtener la Order", error);
      }
    };
    loadOrder();
  }, [orderId]);

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
      discount: Number(item.discountAmount) || 0,
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
      setAdvancePayment(totalPaidApproved + totalPending);

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
  }, [selectedStoreId]);

  // Auto-calcular salesRegion basándose en el departamento del cliente
  useEffect(() => {
    if (clientForm.department) {
      const autoRegion =
        clientForm.department.toUpperCase() === "LIMA" ? "LIMA" : "PROVINCIA";
      setSalesRegion(autoRegion);
    }
  }, [clientForm.department]);

  // Auto-cargar productos cuando cambia el inventario
  useEffect(() => {
    if (selectedInventory) {
      searchProducts(1);
    }
  }, [selectedInventory]);

  // Búsqueda debounced cuando cambia el query del producto
  useEffect(() => {
    const timer = setTimeout(() => {
      // Solo buscar si hay un inventario seleccionado
      if (selectedInventory) {
        searchProducts(1);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [productQuery, selectedInventory]);

  /* ---------------- Actions ---------------- */

  const searchProducts = async (page = 1) => {
    if (!selectedInventory) return;

    try {
      setProductsLoading(true);

      const res = await searchInventoryItems({
        inventoryId: selectedInventory,
        q: productQuery || undefined,
        page,
        limit: 10,
      });

      setProducts(res.data);
      setProductsMeta({
        total: res.meta.total,
        totalPages: res.meta.totalPages,
      });
      setProductsPage(page);
    } catch (err) {
      console.error("Error searching products", err);
    } finally {
      setProductsLoading(false);
    }
  };

  const searchClient = async () => {
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
    } catch (error) {
      console.error(error);
    } finally {
      setLoadingClient(false);
    }
  };

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
    setPaymentProofFile(null);
    setPaymentProofPreview(null);
    setTaxMode("INCLUIDO");

    // Order data (para modo edición)
    setOrderData(null);
  };

  const handleCreateClient = async () => {
    if (!auth?.company?.id) return;

    try {
      const createdClient = await createClient({
        companyId: auth.company.id,
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
      });
      setClientFound(createdClient);
      setOriginalClient(createdClient);
      setSearchState("found");
    } catch (error) {
      console.error(error);
    }
  };

  const handleConfirmSale = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();

    if (!clientFound?.id) {
      console.error("❌ No hay customerId");
      return;
    }

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

      // --- Modo de impuestos ---
      taxMode: taxMode,

      // --- Notas ---
      notes: orderDetails.notes ?? null,

      // --- Cliente ---
      customerId: clientFound.id,

      // --- Ítems ---
      items: cart.map((item) => ({
        productVariantId: item.variantId,
        sku: item.sku,
        productName: item.productName,
        quantity: item.quantity,
        unitPrice: item.price,
        discountType: item.discount > 0 ? "FIXED" : "NONE",
        discountAmount: item.discount || 0,
        attributes: item.attributes,
      })),

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
    };

    setIsSubmitting(true);
    try {
      if (!orderData) {
        const response = await axios.post(
          `${process.env.NEXT_PUBLIC_API_VENTAS}/order-header`,
          payload,
        );

        const createdOrderId = response.data.id;

        // Si hay comprobante de pago, subirlo al pago recién creado
        if (paymentProofFile && response.data.payments?.length > 0) {
          const firstPaymentId = response.data.payments[0].id;
          try {
            const formData = new FormData();
            formData.append("file", paymentProofFile);

            await axios.patch(
              `${process.env.NEXT_PUBLIC_API_VENTAS}/payments/payments/${firstPaymentId}/upload-proof`,
              formData,
              {
                headers: {
                  "Content-Type": "multipart/form-data",
                },
              },
            );
          } catch (proofError) {
            console.error("Error subiendo comprobante", proofError);
            toast.warning(
              "Venta creada pero hubo un error al subir el comprobante",
            );
          }
        }

        toast.success("Venta registrada");
        setReceiptOrderId(createdOrderId);
        setReceiptOpen(true);

        // Limpiar todo el formulario después de venta exitosa
        resetForm();
      } else {
        // Actualizar orden existente
        const updatePayload = {
          salesChannel: orderDetails.salesChannel,
          closingChannel: orderDetails.closingChannel,
          deliveryType: orderDetails.deliveryType,
          salesRegion: salesRegion,
          shippingTotal: shippingTotal ?? 0,
          courier: orderDetails.enviaPor ?? null,
          taxMode: taxMode,
          notes: orderDetails.notes ?? null,
          customerId: clientFound.id,
          items: cart.map((item) => ({
            productVariantId: item.variantId,
            sku: item.sku,
            productName: item.productName,
            quantity: item.quantity,
            unitPrice: item.price,
            discountType: item.discount > 0 ? "FIXED" : "NONE",
            discountAmount: item.discount || 0,
            attributes: item.attributes,
            // Campos de promo del día (solo para items nuevos cuando isPromo=true)
            isPromoItem: isPromo ? true : undefined,
            addedByUserId: isPromo ? auth?.user?.id : undefined,
            addedAt: isPromo ? new Date().toISOString() : undefined,
          })),
          userId: auth?.user?.id ?? null,
          // Datos de pago
          paymentMethod: paymentMethod || null,
          paymentAmount: advancePayment,
        };

        await axios.put(
          `${process.env.NEXT_PUBLIC_API_VENTAS}/order-header/${orderData.id}`,
          updatePayload,
        );

        toast.success("Venta actualizada correctamente");
        setReceiptOrderId(orderData.id);
        setReceiptOpen(true);
      }
    } catch (error) {
      console.error("❌ Error creating sale", error);
      toast.error("Error al registrar la venta");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getUsedStock = (cart: CartItem[], product: InventoryItemForSale) => {
    return cart
      .filter(
        (item) =>
          item.inventoryItemId === product.inventoryItemId &&
          item.variantId === product.variantId,
      )
      .reduce((acc, item) => acc + item.quantity, 0);
  };

  const addToCart = (product: InventoryItemForSale) => {
    setCart((prev) => {
      // Permitir ventas bajo pedido (stock negativo)
      // El badge "Sin stock - Venta bajo pedido" ya se muestra en el listado

      const existing = prev.find(
        (p) =>
          p.inventoryItemId === product.inventoryItemId &&
          p.variantId === product.variantId &&
          p.price === product.price,
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
          discount: 0,
        },
      ];
    });
  };

  const addAsSeparateItem = (product: InventoryItemForSale) => {
    setCart((prev) => [
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
        discount: 0,
      },
    ]);
  };

  const removeFromCart = (cartItemId: string) => {
    setCart((prev) => prev.filter((item) => item.id !== cartItemId));
  };

  const handleUpdateQuantity = (cartItemId: string, newQuantity: number) => {
    setCart((prev) => {
      // Permitir 0 temporalmente para que el usuario pueda borrar y escribir un nuevo número
      // La validación de cantidad > 0 se hace en hasValidCart al momento de submit
      if (newQuantity < 0) return prev;

      return prev.map((p) =>
        p.id === cartItemId ? { ...p, quantity: newQuantity } : p,
      );
    });
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
      } as any);

      setClientFound(updated);
      setOriginalClient(updated);
      toast.success("Cliente actualizado");
    } catch (error) {
      console.error(error);
      toast.error("Error al actualizar cliente");
    }
  };

  /* ---------------- Totales ---------------- */
  // Subtotal bruto (precio * cantidad)
  const subtotalBruto = cart.reduce((acc, p) => acc + p.price * p.quantity, 0);
  // Total de descuentos por item (manejar strings durante edición)
  const totalItemDiscounts = cart.reduce((acc, p) => {
    const discount =
      typeof p.discount === "number"
        ? p.discount
        : parseFloat(p.discount as any) || 0;
    return acc + discount;
  }, 0);
  // Subtotal neto (después de descuentos por item)
  const subtotal = subtotalBruto - totalItemDiscounts;
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

  const canSubmit =
    !!clientFound &&
    hasValidCart &&
    orderDetails.orderType === OrderType.VENTA &&
    !!orderDetails.salesChannel &&
    !!orderDetails.closingChannel &&
    hasValidDelivery &&
    hasValidPayments;

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
        city: originalClient.city,
        district: originalClient.district,
        address: originalClient.address,
        reference: originalClient.reference,
      });

  if (!auth) return null;

  return (
    <div className="flex h-screen w-full">
      <main className="flex-1 p-6 space-y-6 overflow-auto">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link href="/ventas">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Volver
            </Button>
          </Link>
          <HeaderConfig
            title="Registrar venta"
            description="Carga completa de una venta"
          />
        </div>

        {/* Cliente */}
        <Card>
          <CardHeader>
            <CardTitle>Cliente</CardTitle>
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
                />
                <Button
                  onClick={searchClient}
                  disabled={!clientForm.phoneNumber || loadingClient}
                >
                  <Search className="h-4 w-4" />
                </Button>

                {(isFound || isNotFound) && (
                  <Button variant="ghost" size="icon" onClick={clearClient}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>

            {/* Formulario */}
            <div className="border rounded-md p-4 space-y-4">
              <div className="space-y-1">
                <Label>Nombre completo</Label>
                <Input
                  disabled={!formEnabled}
                  value={clientForm.fullName}
                  onChange={(e) =>
                    setClientForm({ ...clientForm, fullName: e.target.value })
                  }
                />
              </div>

              <div className="space-y-1">
                <Label>Documento (opcional)</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Select
                    disabled={!formEnabled}
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
                      <SelectItem value="CUIT">CUIT</SelectItem>
                      <SelectItem value="PASAPORTE">Pasaporte</SelectItem>
                    </SelectContent>
                  </Select>

                  <Input
                    disabled={!formEnabled || !clientForm.documentType}
                    placeholder="Número"
                    value={clientForm.documentNumber}
                    onChange={(e) =>
                      setClientForm({
                        ...clientForm,
                        documentNumber: e.target.value,
                      })
                    }
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label>Tipo de cliente</Label>
                <Select
                  disabled={!formEnabled}
                  value={clientForm.clientType}
                  onValueChange={(v) =>
                    setClientForm({ ...clientForm, clientType: v as any })
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
                <Label>Dirección</Label>

                <div className="grid grid-cols-3 gap-2">
                  <Combobox
                    disabled={!formEnabled}
                    value={clientForm.department}
                    onValueChange={(value) =>
                      setClientForm({
                        ...clientForm,
                        department: value,
                        province: "",
                        district: "",
                      })
                    }
                    options={departmentOptions}
                    placeholder="Departamento"
                    searchPlaceholder="Buscar departamento..."
                  />

                  <Combobox
                    disabled={!formEnabled || !clientForm.department}
                    value={clientForm.province}
                    onValueChange={(value) =>
                      setClientForm({
                        ...clientForm,
                        province: value,
                        district: "",
                      })
                    }
                    options={provinceOptions}
                    placeholder="Provincia"
                    searchPlaceholder="Buscar provincia..."
                  />

                  <Combobox
                    disabled={!formEnabled || !clientForm.province}
                    value={clientForm.district}
                    onValueChange={(value) =>
                      setClientForm({ ...clientForm, district: value })
                    }
                    options={districtOptions}
                    placeholder="Distrito"
                    searchPlaceholder="Buscar distrito..."
                  />
                </div>

                <Input
                  disabled={!formEnabled}
                  placeholder="Dirección exacta"
                  value={clientForm.address}
                  onChange={(e) =>
                    setClientForm({ ...clientForm, address: e.target.value })
                  }
                />

                <Textarea
                  disabled={!formEnabled}
                  placeholder="Referencia (opcional)"
                  value={clientForm.reference}
                  onChange={(e) =>
                    setClientForm({ ...clientForm, reference: e.target.value })
                  }
                />
              </div>

              {/* Región de Venta - Toggle Pills */}
              <div className="space-y-2">
                <Label>Región de venta</Label>
                <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit">
                  <button
                    type="button"
                    onClick={() => setSalesRegion("LIMA")}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                      salesRegion === "LIMA"
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted-foreground/10"
                    }`}
                  >
                    Lima
                  </button>
                  <button
                    type="button"
                    onClick={() => setSalesRegion("PROVINCIA")}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                      salesRegion === "PROVINCIA"
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted-foreground/10"
                    }`}
                  >
                    Provincia
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Se calcula automáticamente según el departamento, pero puedes
                  cambiarlo manualmente.
                </p>
              </div>

              {/* Acciones */}
              {isNotFound && (
                <Button onClick={handleCreateClient}>Crear cliente</Button>
              )}

              {isFound && hasClientChanges && (
                <Button onClick={handleUpdateClient}>Guardar cambios</Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Productos */}
        <Card>
          <CardHeader>
            <CardTitle>Productos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Tienda seleccionada</Label>
                <Select
                  disabled={orderId !== null}
                  value={selectedStoreId ?? ""}
                  onValueChange={(storeId) => setSelectedStore(storeId)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar tienda" />
                  </SelectTrigger>
                  <SelectContent>
                    {stores.map((store) => (
                      <SelectItem key={store.id} value={store.id}>
                        {store.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label>Inventario seleccionado</Label>
                <Select
                  value={selectedInventory}
                  disabled={!selectedStoreId}
                  onValueChange={(inventoryId) =>
                    setSelectedInventory(inventoryId)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar inventario" />
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

              <div className="space-y-1 md:col-span-2">
                <Label>Buscar producto</Label>
                <div className="flex gap-2 items-start">
                  <div className="flex-1 min-w-0">
                    <Combobox
                      options={products.map((p) => ({
                        value: p.variantId,
                        label: p.productName,
                        sku: p.sku,
                        price: p.price,
                        stock: p.availableStock,
                        attributes: p.attributes,
                      }))}
                      value=""
                      onValueChange={(variantId) => {
                        const p = products.find(
                          (prod) => prod.variantId === variantId,
                        );
                        if (p) addToCart(p);
                      }}
                      onSearchChange={setProductQuery}
                      placeholder="Buscar por nombre o SKU..."
                      searchPlaceholder="Escribe para buscar..."
                      renderLabel={(option) => (
                        <div className="flex justify-between items-center w-full py-1">
                          <div className="flex flex-col gap-0.5 min-w-0 pr-4">
                            <span className="font-medium text-sm truncate">
                              {option.label}
                            </span>
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge
                                variant="outline"
                                className="text-[10px] h-4 px-1"
                              >
                                {option.sku}
                              </Badge>
                              {option.attributes &&
                                Object.entries(option.attributes).map(
                                  ([k, v]) => (
                                    <span
                                      key={k}
                                      className="text-[10px] text-muted-foreground bg-muted px-1 rounded"
                                    >
                                      {k}: {v as string}
                                    </span>
                                  ),
                                )}
                              <span
                                className={cn(
                                  "text-[10px]",
                                  option.stock <= 0
                                    ? "text-destructive font-bold"
                                    : "text-muted-foreground",
                                )}
                              >
                                Stock: {option.stock}
                              </span>
                            </div>
                          </div>
                          <div className="flex flex-col items-end shrink-0">
                            <span className="font-bold text-sm text-primary">
                              ${option.price}
                            </span>
                            {option.stock <= 0 && (
                              <span className="text-[9px] text-destructive font-semibold uppercase">
                                Bajo pedido
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    />
                  </div>
                  <Button
                    variant="outline"
                    className="h-9 px-3 shrink-0"
                    onClick={() => (window.location.href = "/productos")}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    <span className="hidden sm:inline">
                      Crear producto nuevo
                    </span>
                    <span className="sm:hidden">Nuevo</span>
                  </Button>
                </div>
              </div>
            </div>

            {productsLoading && (
              <p className="text-sm text-muted-foreground animate-pulse">
                Buscando productos...
              </p>
            )}

            {!productsLoading && products.length === 0 && productQuery && (
              <p className="text-sm text-muted-foreground italic">
                No se encontraron productos para "{productQuery}"
              </p>
            )}

            <div>
              {cart.length > 0 && (
                <div>
                  <Label>Carrito</Label>
                  {cart.map((item) => (
                    <div
                      key={item.id}
                      className="border rounded-md p-3 mt-2 space-y-2"
                    >
                      <div className="flex justify-between">
                        <div>
                          <p className="font-medium">{item.productName}</p>
                          <p className="text-xs text-muted-foreground">
                            {item.sku}
                          </p>

                          {item.attributes && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {Object.entries(item.attributes).map(([k, v]) => (
                                <span
                                  key={k}
                                  className="text-xs px-2 py-0.5 rounded bg-muted"
                                >
                                  {k}: {v}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => removeFromCart(item.id)}
                        >
                          <Trash2 size={16} />
                        </Button>
                      </div>

                      <div className="grid grid-cols-4 gap-2 items-end">
                        {/* Cantidad */}
                        <div className="space-y-1">
                          <Label className="text-xs">Cantidad</Label>
                          <Input
                            type="text"
                            inputMode="numeric"
                            value={item.quantity === 0 ? "" : item.quantity}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val === "" || /^\d+$/.test(val)) {
                                handleUpdateQuantity(
                                  item.id,
                                  val === "" ? 0 : Number(val),
                                );
                              }
                            }}
                          />
                        </div>

                        {/* Precio editable */}
                        <div className="space-y-1">
                          <Label className="text-xs">Precio</Label>
                          <Input
                            type="text"
                            inputMode="decimal"
                            step="0.01"
                            value={item.price === 0 ? "" : String(item.price)}
                            onChange={(e) => {
                              const val = e.target.value;
                              // Permitir vacío, números enteros y decimales (incluyendo estados intermedios como "10.")
                              if (val === "" || /^\d*\.?\d*$/.test(val)) {
                                setCart((prev) =>
                                  prev.map((p) =>
                                    p.id === item.id
                                      ? {
                                          ...p,
                                          price:
                                            val === ""
                                              ? 0
                                              : ((val.endsWith(".")
                                                  ? val
                                                  : Number(val)) as any),
                                        }
                                      : p,
                                  ),
                                );
                              }
                            }}
                            onBlur={(e) => {
                              // Al perder el foco, asegurarse de que el precio sea un número válido
                              const val = e.target.value;
                              const numVal = parseFloat(val) || 0;
                              setCart((prev) =>
                                prev.map((p) =>
                                  p.id === item.id
                                    ? { ...p, price: numVal }
                                    : p,
                                ),
                              );
                            }}
                          />
                        </div>

                        {/* Descuento por item */}
                        <div className="space-y-1">
                          <Label className="text-xs">
                            Descuento (Precio S/)
                          </Label>
                          <Input
                            type="text"
                            inputMode="decimal"
                            step="0.01"
                            placeholder="0"
                            value={
                              item.discount === 0 ? "" : String(item.discount)
                            }
                            onChange={(e) => {
                              const val = e.target.value;
                              // Permitir vacío, números enteros y decimales (incluyendo estados intermedios como "10.")
                              if (val === "" || /^\d*\.?\d*$/.test(val)) {
                                setCart((prev) =>
                                  prev.map((p) =>
                                    p.id === item.id
                                      ? {
                                          ...p,
                                          discount:
                                            val === ""
                                              ? 0
                                              : ((val.endsWith(".") ||
                                                val.includes(".")
                                                  ? val
                                                  : Number(val)) as any),
                                        }
                                      : p,
                                  ),
                                );
                              }
                            }}
                            onBlur={(e) => {
                              // Al perder el foco, asegurarse de que el descuento sea un número válido
                              const val = e.target.value;
                              const numVal = parseFloat(val) || 0;
                              setCart((prev) =>
                                prev.map((p) =>
                                  p.id === item.id
                                    ? { ...p, discount: numVal }
                                    : p,
                                ),
                              );
                            }}
                          />
                        </div>

                        {/* Subtotal */}
                        <div className="space-y-1 flex flex-col items-end">
                          <Label className="text-xs">Subtotal</Label>
                          <div className="h-9 flex items-center justify-end font-medium">
                            $
                            {(
                              item.price * item.quantity -
                              (typeof item.discount === "number"
                                ? item.discount
                                : parseFloat(item.discount as any) || 0)
                            ).toFixed(2)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Detalles */}
        <Card>
          <CardHeader>
            <CardTitle>Detalles de la venta</CardTitle>
          </CardHeader>

          <CardContent className="grid md:grid-cols-2 gap-4">
            {/* Tipo de orden */}
            <div className="space-y-1">
              <Label>Tipo de orden</Label>
              <Select
                value={orderDetails.orderType}
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
                  <SelectItem value={OrderType.RESERVA} disabled>
                    Reserva
                  </SelectItem>
                  <SelectItem value={OrderType.PREVENTA} disabled>
                    Preventa
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Canal de venta */}
            <div className="space-y-1">
              <Label>Canal de venta</Label>
              <Select
                value={orderDetails.salesChannel}
                onValueChange={(v) =>
                  setOrderDetails({
                    ...orderDetails,
                    salesChannel: v as SalesChannel,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar canal de venta" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SalesChannel.TIENDA_FISICA}>
                    Tienda física
                  </SelectItem>
                  <SelectItem value={SalesChannel.WHATSAPP}>
                    WhatsApp
                  </SelectItem>
                  <SelectItem value={SalesChannel.WEB}>WEB</SelectItem>
                  <SelectItem value={SalesChannel.INSTAGRAM}>
                    Instagram
                  </SelectItem>
                  <SelectItem value={SalesChannel.FACEBOOK}>
                    Facebook
                  </SelectItem>
                  <SelectItem value={SalesChannel.MARKETPLACE}>
                    Marketplace
                  </SelectItem>
                  <SelectItem value={SalesChannel.MERCADOLIBRE}>
                    MercadoLibre
                  </SelectItem>
                  <SelectItem value={SalesChannel.OTRO}>Otro</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Canal de cierre */}
            <div className="space-y-1">
              <Label>Canal de cierre</Label>
              <Select
                value={orderDetails.closingChannel}
                onValueChange={(v) =>
                  setOrderDetails({
                    ...orderDetails,
                    closingChannel: v as SalesChannel,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar canal de cierre" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SalesChannel.TIENDA_FISICA}>
                    Tienda física
                  </SelectItem>
                  <SelectItem value={SalesChannel.WHATSAPP}>
                    WhatsApp
                  </SelectItem>
                  <SelectItem value={SalesChannel.WEB}>WEB</SelectItem>
                  <SelectItem value={SalesChannel.INSTAGRAM}>
                    Instagram
                  </SelectItem>
                  <SelectItem value={SalesChannel.FACEBOOK}>
                    Facebook
                  </SelectItem>
                  <SelectItem value={SalesChannel.MARKETPLACE}>
                    Marketplace
                  </SelectItem>
                  <SelectItem value={SalesChannel.MERCADOLIBRE}>
                    MercadoLibre
                  </SelectItem>
                  <SelectItem value={SalesChannel.OTRO}>Otro</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Tipo de entrega */}
            <div className="space-y-1">
              <Label>Tipo de entrega</Label>
              <Select
                value={orderDetails.deliveryType}
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
              <div className="space-y-1">
                <Label>Método de envío</Label>
                <Select
                  value={orderDetails.enviaPor}
                  onValueChange={(v) =>
                    setOrderDetails({ ...orderDetails, enviaPor: v as any })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar método de envío" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MOTORIZADO_PROPIO">
                      Motorizado Propio
                    </SelectItem>
                    <SelectItem value="SHALOM">Shalom</SelectItem>
                    <SelectItem value="OLVA_COURIER">Olva Courier</SelectItem>
                    <SelectItem value="MARVISUR">Marvisur</SelectItem>
                    <SelectItem value="FLORES">Flores</SelectItem>
                    <SelectItem value="OTROS">Otros</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Comentarios */}
            <div className="md:col-span-2 space-y-1">
              <Label>Comentarios</Label>
              <Textarea
                placeholder="Observaciones adicionales sobre la venta"
                value={orderDetails.notes}
                onChange={(e) =>
                  setOrderDetails({ ...orderDetails, notes: e.target.value })
                }
              />
            </div>
          </CardContent>
        </Card>

        {/* Cierre */}
        <Card>
          <CardHeader>
            <CardTitle>Cierre de venta</CardTitle>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Método de pago */}
            <div className="space-y-1">
              <Label>Método de pago</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar método de pago" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="YAPE">Yape</SelectItem>
                  <SelectItem value="PLIN">Plin</SelectItem>
                  <SelectItem value="TRANSFERENCIA">Transferencia</SelectItem>
                  <SelectItem value="EFECTIVO">Efectivo</SelectItem>
                  <SelectItem value="CONTRA_ENTREGA">Contraentrega</SelectItem>
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
                    setShippingTotalDisplay(numVal === 0 ? "" : String(numVal));
                  }}
                />
              </div>
            )}

            {/* Adelanto de pago */}
            <div className="space-y-1">
              <Label>Monto de Pago</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={advancePayment === 0 ? "" : advancePayment}
                onChange={(e) => {
                  const val = e.target.value;
                  setAdvancePayment(val === "" ? 0 : Number(val));
                }}
              />
            </div>

            {/* Comprobante de pago */}
            <div className="space-y-1">
              <Label>Comprobante de pago (opcional)</Label>
              <div
                className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors
                  ${paymentProofFile ? "border-teal-500 bg-teal-50" : "border-gray-300 hover:border-gray-400"}`}
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
                      <img
                        src={paymentProofPreview}
                        alt="Preview"
                        className="max-h-24 mx-auto rounded-md"
                      />
                    ) : (
                      <p className="text-sm text-teal-600 font-medium">
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

            {/* Resumen */}
            <div className="border-t pt-4 text-sm">
              <table className="w-full">
                <tbody>
                  <tr>
                    <td className="py-1">Importe productos</td>
                    <td className="py-1 text-right">
                      S/ {subtotalBruto.toFixed(2)}
                    </td>
                  </tr>
                  {totalItemDiscounts > 0 && (
                    <tr>
                      <td className="py-1">Total descuentos</td>
                      <td className="py-1 text-right">
                        - S/ {totalItemDiscounts.toFixed(2)}
                      </td>
                    </tr>
                  )}
                  <tr>
                    <td className="py-1">Sub total</td>
                    <td className="py-1 text-right">
                      S/ {subtotal.toFixed(2)}
                    </td>
                  </tr>
                  {taxMode === "AUTOMATICO" && (
                    <tr>
                      <td className="py-1">IGV 18%</td>
                      <td className="py-1 text-right">S/ {taxes.toFixed(2)}</td>
                    </tr>
                  )}
                </tbody>
              </table>

              <table className="w-full border-t mt-2 pt-2">
                <tbody>
                  <tr className="font-semibold">
                    <td className="py-1 pt-2">Total</td>
                    <td className="py-1 pt-2 text-right">
                      S/ {grandTotal.toFixed(2)}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-1">Costo de envío</td>
                    <td className="py-1 text-right">
                      S/ {shippingTotal.toFixed(2)}
                    </td>
                  </tr>
                  {advancePayment > 0 && (
                    <tr>
                      <td className="py-1">Adelanto de pago</td>
                      <td className="py-1 text-right">
                        S/ {advancePayment.toFixed(2)}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>

              <table className="w-full border-t mt-2">
                <tbody>
                  <tr className="text-red-600 font-semibold">
                    <td className="py-1 pt-2">Pendiente de pago</td>
                    <td className="py-1 pt-2 text-right">
                      S/ {pendingPayment.toFixed(2)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <Button
              className="w-full bg-teal-600 hover:bg-teal-700"
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
      </main>
      <OrderReceiptModal
        open={receiptOpen}
        orderId={receiptOrderId}
        onClose={() => setReceiptOpen(false)}
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
      <RegistrarVentaContent />
    </Suspense>
  );
}
