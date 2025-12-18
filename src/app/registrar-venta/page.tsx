"use client";

import { useEffect, useState } from "react";
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
import { HeaderConfig } from "@/components/header/HeaderConfig";
import { createClient, fetchClientByPhone } from "@/services/clients.service";
import { useAuth } from "@/contexts/AuthContext";
import { Client, ClientType, DocumentType } from "@/interfaces/ICliente";
import { searchInventoryItems } from "@/services/inventoryItems.service";
import { InventoryItemForSale } from "@/interfaces/IProduct";
import { CartItem } from "@/interfaces/IOrder";
import { DeliveryType, OrderType, SalesChannel } from "@/enum/Order.enum";
import { Switch } from "@/components/ui/switch";
import axios from "axios";
import { toast } from "sonner";
import OrderReceiptModal from "@/components/modals/orderReceiptModal";

type ClientSearchState = "idle" | "found" | "not_found";

const emptyClientForm = {
  fullName: "",
  phoneNumber: "",
  documentType: undefined as DocumentType | undefined,
  documentNumber: "",
  clientType: "TRADICIONAL" as ClientType,
  province: "",
  city: "",
  district: "",
  address: "",
  reference: "",
};

export default function RegistrarVentaPage() {
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
    enviaPor: undefined as "REPARTIDOR" | "CORREO" | undefined,
    notes: "",
  });

  /* ---------------- Pago ---------------- */
  const [paymentMethod, setPaymentMethod] = useState("");
  const [shippingTotal, setShippingTotal] = useState(0);
  const [advancePayment, setAdvancePayment] = useState(0);
  const [hasDiscount, setHasDiscount] = useState(false);
  const [discountTotal, setDiscountTotal] = useState(0);

  /* ---------------- Modal ---------------- */

  const [receiptOrderId, setReceiptOrderId] = useState("");
  const [receiptOpen, setReceiptOpen] = useState(false);

  const { auth, selectedStoreId, setSelectedStore, inventories } = useAuth();

  const companyId = auth?.company?.id;
  const stores = auth?.company?.stores ?? [];

  const isIdle = searchState === "idle";
  const isFound = searchState === "found";
  const isNotFound = searchState === "not_found";

  const formEnabled = !isIdle;

  useEffect(() => {
    if (searchState === "found" && clientFound) {
      setClientForm({
        fullName: clientFound.fullName ?? "",
        phoneNumber: clientFound.phoneNumber ?? "",
        documentType: clientFound.documentType,
        documentNumber: clientFound.documentNumber ?? "",
        clientType: clientFound.clientType,
        province: clientFound.province ?? "",
        city: clientFound.city ?? "",
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
    setSelectedInventory("");
    setProducts([]);
    setProductsMeta(null);
  }, [selectedStoreId]);

  useEffect(() => {
    if (inventories.length === 1) {
      const inventoryId = inventories[0].id;
      setSelectedInventory(inventoryId);
    }
  }, [inventories]);

  /* ---------------- Actions ---------------- */

  const searchProducts = async (page = 1) => {
    console.log(selectedInventory);
    console.log(productsLoading);

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
        city: clientForm.city,
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

      // --- Envío ---
      shippingTotal: shippingTotal ?? 0,

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
        discountType: "NONE",
        discountAmount: 0,
        attributes: item.attributes,
      })),

      // --- Pagos ---
      payments: [
        {
          paymentMethod,
          amount: grandTotal,
          paymentDate: new Date().toISOString(),
        },
      ],
    };

    console.log("🧾 CREATE SALE PAYLOAD", payload);

    try {
      const response = await axios.post(
        "http://localhost:3002/order-header",
        payload
      );
      toast.success("Venta registrada");

      const orderId = response.data.id;
      setReceiptOrderId(orderId);
      setReceiptOpen(true);
    } catch (error) {
      console.error("❌ Error creating sale", error);
    }
  };

  const getUsedStock = (cart: CartItem[], product: InventoryItemForSale) => {
    return cart
      .filter(
        (item) =>
          item.inventoryItemId === product.inventoryItemId &&
          item.variantId === product.variantId
      )
      .reduce((acc, item) => acc + item.quantity, 0);
  };

  const addToCart = (product: InventoryItemForSale) => {
    setCart((prev) => {
      const usedStock = getUsedStock(prev, product);

      if (usedStock >= product.availableStock) {
        toast.error("No hay stock suficiente");
        return prev;
      }

      const existing = prev.find(
        (p) =>
          p.inventoryItemId === product.inventoryItemId &&
          p.variantId === product.variantId &&
          p.price === product.price
      );

      if (existing) {
        return prev.map((p) =>
          p.id === existing.id ? { ...p, quantity: p.quantity + 1 } : p
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
      },
    ]);
  };

  const removeFromCart = (cartItemId: string) => {
    setCart((prev) => prev.filter((item) => item.id !== cartItemId));
  };

  const updateQuantity = (cartItemId: string, newQuantity: number) => {
    setCart((prev) => {
      if (newQuantity < 1) return prev;

      const item = prev.find((p) => p.id === cartItemId);
      if (!item) return prev;

      const productStock =
        products.find(
          (p) =>
            p.inventoryItemId === item.inventoryItemId &&
            p.variantId === item.variantId
        )?.availableStock ?? Infinity;

      const usedStock =
        prev
          .filter(
            (p) =>
              p.inventoryItemId === item.inventoryItemId &&
              p.variantId === item.variantId &&
              p.id !== cartItemId
          )
          .reduce((acc, p) => acc + p.quantity, 0) + newQuantity;

      if (usedStock > productStock) {
        toast.error("Cantidad supera el stock disponible");
        return prev;
      }

      return prev.map((p) =>
        p.id === cartItemId ? { ...p, quantity: newQuantity } : p
      );
    });
  };

  const handleUpdateClient = () => {};

  /* ---------------- Totales ---------------- */
  const subtotal = cart.reduce((acc, p) => acc + p.price * p.quantity, 0);
  const discount = subtotal * 0.1;
  const taxes = subtotal * 0.21; // esta preparado para IVA(arg) no igv(peru)

  const grandTotal = subtotal + taxes + shippingTotal - discountTotal;

  const pendingPayment = Math.max(grandTotal - advancePayment, 0);

  /* ---------------- Validaciones ---------------- */

  const hasValidCart =
    cart.length > 0 &&
    cart.every((item) => item.quantity > 0 && item.price >= 0);

  const hasValidDelivery =
    orderDetails.deliveryType === DeliveryType.RETIRO_TIENDA ||
    (orderDetails.deliveryType && orderDetails.enviaPor);

  const hasValidPayments =
    !!paymentMethod &&
    discountTotal <= subtotal &&
    advancePayment <= grandTotal;

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

              <div className="space-y-2">
                <Label>Dirección</Label>

                <div className="grid grid-cols-2 gap-2">
                  <Input
                    disabled={!formEnabled}
                    placeholder="Provincia"
                    value={clientForm.province}
                    onChange={(e) =>
                      setClientForm({ ...clientForm, province: e.target.value })
                    }
                  />
                  <Input
                    disabled={!formEnabled}
                    placeholder="Ciudad"
                    value={clientForm.city}
                    onChange={(e) =>
                      setClientForm({ ...clientForm, city: e.target.value })
                    }
                  />
                </div>

                <Input
                  disabled={!formEnabled}
                  placeholder="Barrio / Distrito"
                  value={clientForm.district}
                  onChange={(e) =>
                    setClientForm({ ...clientForm, district: e.target.value })
                  }
                />

                <Input
                  disabled={!formEnabled}
                  placeholder="Dirección"
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
                <div className="flex gap-2">
                  <Input
                    placeholder="Buscar por nombre o SKU"
                    value={productQuery}
                    onChange={(e) => setProductQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        searchProducts(1);
                      }
                    }}
                  />

                  <Button
                    onClick={() => searchProducts(1)}
                    disabled={!selectedInventory || productsLoading}
                  >
                    <Search className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            {productsLoading && (
              <p className="text-sm text-muted-foreground">
                Buscando productos...
              </p>
            )}

            {!productsLoading && products.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No se encontraron productos
              </p>
            )}

            {products.map((p) => (
              <div
                key={`${p.inventoryItemId}-${p.price}`}
                className="flex justify-between items-center border rounded-md p-3"
              >
                <div>
                  <p className="font-medium">{p.productName}</p>
                  <p className="text-xs text-muted-foreground">
                    SKU: {p.sku} • Stock: {p.availableStock}
                  </p>

                  {p.attributes && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {Object.entries(p.attributes).map(([key, value]) => (
                        <span
                          key={key}
                          className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground"
                        >
                          {key}: {value}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    disabled={p.availableStock <= 0}
                    onClick={() => addToCart(p)}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Agregar
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    disabled={p.availableStock <= 0}
                    onClick={() => addAsSeparateItem(p)}
                  >
                    Ítem separado
                  </Button>
                </div>
              </div>
            ))}

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

                      <div className="grid grid-cols-3 gap-2 items-center">
                        {/* Cantidad */}
                        <Input
                          type="number"
                          min={1}
                          value={item.quantity}
                          onChange={(e) =>
                            updateQuantity(item.id, Number(e.target.value))
                          }
                        />

                        {/* Precio editable */}
                        <Input
                          type="number"
                          min={0}
                          value={item.price}
                          onChange={(e) =>
                            setCart((prev) =>
                              prev.map((p) =>
                                p.id === item.id
                                  ? { ...p, price: Number(e.target.value) }
                                  : p
                              )
                            )
                          }
                        />

                        {/* Subtotal */}
                        <div className="text-right font-medium">
                          ${item.price * item.quantity}
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
                    <SelectItem value="REPARTIDOR_INTERNO">
                      Repartidor interno
                    </SelectItem>
                    <SelectItem value="CORREO">Correo</SelectItem>
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
              <Select onValueChange={setPaymentMethod}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar método de pago" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="EFECTIVO">Efectivo</SelectItem>
                  <SelectItem value="TRANSFERENCIA">Transferencia</SelectItem>
                  <SelectItem value="TARJETA_DEBITO">
                    Tarjeta de débito
                  </SelectItem>
                  <SelectItem value="MERCADO_PAGO">Mercado Pago</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Costo de envío */}
            <div className="space-y-1">
              <Label>Costo de envío</Label>
              <Input
                type="number"
                min={0}
                value={shippingTotal}
                onChange={(e) => setShippingTotal(Number(e.target.value))}
              />
            </div>

            {/* Adelanto de pago */}
            <div className="space-y-1">
              <Label>Monto de Pago</Label>
              <Input
                type="number"
                min={0}
                value={advancePayment}
                onChange={(e) => setAdvancePayment(Number(e.target.value))}
              />
            </div>

            {/* Descuento */}
            <div className="flex items-center justify-between">
              <Label>Aplicar descuento</Label>
              <Switch
                checked={hasDiscount}
                onCheckedChange={(v) => {
                  setHasDiscount(v);
                  if (!v) setDiscountTotal(0);
                }}
              />
            </div>

            {hasDiscount && (
              <div className="space-y-1">
                <Label>Monto de descuento</Label>
                <Input
                  type="number"
                  min={0}
                  value={discountTotal}
                  onChange={(e) => setDiscountTotal(Number(e.target.value))}
                />
              </div>
            )}

            {/* Resumen */}
            <div className="border-t pt-4 text-sm space-y-1">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>${subtotal}</span>
              </div>

              <div className="flex justify-between">
                <span>Envío</span>
                <span>${shippingTotal}</span>
              </div>

              {hasDiscount && (
                <div className="flex justify-between text-green-600">
                  <span>Descuento</span>
                  <span>-${discountTotal}</span>
                </div>
              )}

              <div className="flex justify-between font-semibold text-base">
                <span>Total</span>
                <span>${grandTotal}</span>
              </div>

              <div className="flex justify-between text-muted-foreground">
                <span>Pendiente de pago</span>
                <span>${pendingPayment}</span>
              </div>
            </div>

            <Button
              className="w-full bg-teal-600 hover:bg-teal-700"
              disabled={!canSubmit}
              onClick={handleConfirmSale}
            >
              Confirmar venta
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
