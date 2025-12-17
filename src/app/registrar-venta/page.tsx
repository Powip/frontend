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
  const [clientQuery, setClientQuery] = useState("");
  const [clientFound, setClientFound] = useState<Client | null>(null);
  const [searchState, setSearchState] = useState<ClientSearchState>("idle");
  const [loadingClient, setLoadingClient] = useState(false);
  const [originalClient, setOriginalClient] = useState<Client | null>(null);
  const [clientForm, setClientForm] = useState(emptyClientForm);

  const [newClient, setNewClient] = useState({
    fullName: "",
    phoneNumber: clientQuery,
    documentType: undefined as DocumentType | undefined,
    documentNumber: "",
    clientType: "TRADICIONAL" as ClientType,
    province: "",
    city: "",
    district: "",
    address: "",
    reference: "",
  });

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
  const [gestion, setGestion] = useState("");
  const [canal, setCanal] = useState("");
  const [canalCierre, setCanalCierre] = useState("");
  const [entregaEn, setEntregaEn] = useState("");
  const [enviaPor, setEnviaPor] = useState("");
  const [comentarios, setComentarios] = useState("");

  const [orderDetails, setOrderDetails] = useState({
    orderType: undefined as OrderType | undefined,
    salesChannel: undefined as SalesChannel | undefined,
    closingChannel: undefined as SalesChannel | undefined,
    deliveryType: DeliveryType.RETIRO_TIENDA,

    entregaEn: undefined as "DOMICILIO" | "SUCURSAL" | undefined,
    enviaPor: undefined as "REPARTIDOR" | "CORREO" | undefined,

    notes: "",
  });

  /* ---------------- Pago ---------------- */
  const [paymentMethod, setPaymentMethod] = useState("");
  const [installments, setInstallments] = useState("");

  const { auth, selectedStoreId, setSelectedStore, inventories } = useAuth();

  const companyId = auth?.company?.id;
  const stores = auth?.company?.stores ?? [];

  const isIdle = searchState === "idle";
  const isFound = searchState === "found";
  const isNotFound = searchState === "not_found";

  const phoneEnabled = true;
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
        phoneNumber: clientQuery,
      });
    }
  }, [searchState, clientQuery]);

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
    setClientQuery("");
    setSearchState("idle");
    setClientForm(emptyClientForm);
  };

  const handleCreateClient = async () => {
    if (!auth?.company?.id) return;

    try {
      const createdClient = await createClient({
        companyId: auth.company.id,
        fullName: newClient.fullName,
        phoneNumber: newClient.phoneNumber || undefined,
        documentType: newClient.documentType,
        documentNumber: newClient.documentType
          ? newClient.documentNumber
          : undefined,
        clientType: newClient.clientType,
        province: newClient.province,
        city: newClient.city,
        district: newClient.district,
        address: newClient.address,
        reference: newClient.reference || undefined,
      });

      setClientFound(createdClient);
      setSearchState("found");
    } catch (error) {
      console.error(error);
    }
  };

  const addToCart = (product: InventoryItemForSale) => {
    setCart((prev) => {
      const existing = prev.find(
        (p) =>
          p.inventoryItemId === product.inventoryItemId &&
          p.price === product.price // 🔑 misma línea solo si el precio coincide
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

  const handleUpdateClient = () => {};

  /* ---------------- Totales ---------------- */
  const subtotal = cart.reduce((acc, p) => acc + p.price * p.quantity, 0);
  const discount = subtotal * 0.1;
  const taxes = subtotal * 0.21;
  const total = subtotal - discount + taxes;

  const canSubmit =
    clientFound &&
    cart.length > 0 &&
    gestion &&
    canal &&
    canalCierre &&
    entregaEn &&
    enviaPor &&
    paymentMethod;

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
            <div className="flex gap-2">
              <Input
                placeholder="Teléfono"
                value={clientForm.phoneNumber}
                onChange={(e) =>
                  setClientForm({ ...clientForm, phoneNumber: e.target.value })
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

            {/* Formulario */}
            <div className="border rounded-md p-4 space-y-4">
              <Input
                placeholder="Nombre completo"
                value={clientForm.fullName}
                disabled={!formEnabled}
                onChange={(e) =>
                  setClientForm({ ...clientForm, fullName: e.target.value })
                }
              />

              <Label>Tipo de documento (opcional)</Label>
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
                    <SelectValue placeholder="Tipo doc" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE">No aplica</SelectItem>
                    <SelectItem value="DNI">DNI</SelectItem>
                    <SelectItem value="CUIT">CUIT</SelectItem>
                    <SelectItem value="PASAPORTE">Pasaporte</SelectItem>
                  </SelectContent>
                </Select>

                <Input
                  placeholder="Número documento"
                  disabled={!formEnabled || !clientForm.documentType}
                  value={clientForm.documentNumber}
                  onChange={(e) =>
                    setClientForm({
                      ...clientForm,
                      documentNumber: e.target.value,
                    })
                  }
                />
              </div>

              <Select
                disabled={!formEnabled}
                value={clientForm.clientType}
                onValueChange={(v) =>
                  setClientForm({ ...clientForm, clientType: v as any })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Tipo de cliente" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TRADICIONAL">Tradicional</SelectItem>
                  <SelectItem value="MAYORISTA">Mayorista</SelectItem>
                </SelectContent>
              </Select>

              <div className="grid grid-cols-2 gap-2">
                <Input
                  placeholder="Provincia"
                  disabled={!formEnabled}
                  value={clientForm.province}
                  onChange={(e) =>
                    setClientForm({ ...clientForm, province: e.target.value })
                  }
                />
                <Input
                  placeholder="Ciudad"
                  disabled={!formEnabled}
                  value={clientForm.city}
                  onChange={(e) =>
                    setClientForm({ ...clientForm, city: e.target.value })
                  }
                />
              </div>

              <Input
                placeholder="Barrio / Distrito"
                disabled={!formEnabled}
                value={clientForm.district}
                onChange={(e) =>
                  setClientForm({ ...clientForm, district: e.target.value })
                }
              />

              <Input
                placeholder="Dirección"
                disabled={!formEnabled}
                value={clientForm.address}
                onChange={(e) =>
                  setClientForm({ ...clientForm, address: e.target.value })
                }
              />

              <Textarea
                placeholder="Referencia (opcional)"
                disabled={!formEnabled}
                value={clientForm.reference}
                onChange={(e) =>
                  setClientForm({ ...clientForm, reference: e.target.value })
                }
              />

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
              <Select
                value={selectedStoreId ?? ""}
                onValueChange={(storeId) => setSelectedStore(storeId)}
              >
                <SelectTrigger>
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
                disabled={!selectedStoreId}
                onValueChange={(inventoryId) =>
                  setSelectedInventory(inventoryId)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Inventario" />
                </SelectTrigger>
                <SelectContent>
                  {inventories.map((inv) => (
                    <SelectItem key={inv.id} value={inv.id}>
                      {inv.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="flex gap-2">
                <Input
                  placeholder="Buscar producto por nombre o SKU"
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
                key={p.inventoryItemId}
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
                            setCart((prev) =>
                              prev.map((p) =>
                                p.id === item.id
                                  ? { ...p, quantity: Number(e.target.value) }
                                  : p
                              )
                            )
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
            <Select
              value={orderDetails.orderType}
              onValueChange={(v) =>
                setOrderDetails({ ...orderDetails, orderType: v as OrderType })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Tipo de orden" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={OrderType.VENTA}>Venta</SelectItem>
                <SelectItem value={OrderType.RESERVA}>Reserva</SelectItem>
                <SelectItem value={OrderType.PREVENTA}>Preventa</SelectItem>
              </SelectContent>
            </Select>

            {/*   <Select onValueChange={setGestion}>
              <SelectTrigger>
                <SelectValue placeholder="Gestión" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="telefonica">Telefónica</SelectItem>
                <SelectItem value="fisica">Física</SelectItem>
                <SelectItem value="online">Online</SelectItem>
              </SelectContent>
            </Select> */}

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
                <SelectValue placeholder="Canal de venta" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SalesChannel.TIENDA_FISICA}>
                  Tienda física
                </SelectItem>
                <SelectItem value={SalesChannel.WHATSAPP}>WhatsApp</SelectItem>
                <SelectItem value={SalesChannel.INSTAGRAM}>
                  Instagram
                </SelectItem>
                <SelectItem value={SalesChannel.FACEBOOK}>Facebook</SelectItem>
                <SelectItem value={SalesChannel.MARKETPLACE}>
                  Marketplace
                </SelectItem>
                <SelectItem value={SalesChannel.MERCADOLIBRE}>
                  MercadoLibre
                </SelectItem>
                <SelectItem value={SalesChannel.OTRO}>Otro</SelectItem>
              </SelectContent>
            </Select>

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
                <SelectValue placeholder="Canal de cierre" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SalesChannel.TIENDA_FISICA}>
                  Tienda física
                </SelectItem>
                <SelectItem value={SalesChannel.WHATSAPP}>WhatsApp</SelectItem>
                <SelectItem value={SalesChannel.INSTAGRAM}>
                  Instagram
                </SelectItem>
                <SelectItem value={SalesChannel.FACEBOOK}>Facebook</SelectItem>
                <SelectItem value={SalesChannel.MARKETPLACE}>
                  Marketplace
                </SelectItem>
                <SelectItem value={SalesChannel.MERCADOLIBRE}>
                  MercadoLibre
                </SelectItem>
                <SelectItem value={SalesChannel.OTRO}>Otro</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={orderDetails.deliveryType}
              onValueChange={(v) =>
                setOrderDetails({
                  ...orderDetails,
                  deliveryType: v as DeliveryType,
                  entregaEn: undefined,
                  enviaPor: undefined,
                })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Tipo de entrega" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={DeliveryType.RETIRO_TIENDA}>
                  Retiro en tienda
                </SelectItem>
                <SelectItem value={DeliveryType.DOMICILIO}>
                  Envío a domicilio
                </SelectItem>
                <SelectItem value={DeliveryType.PUNTO_EXTERNO}>
                  Envío a punto externo
                </SelectItem>
              </SelectContent>
            </Select>

            {orderDetails.deliveryType !== DeliveryType.RETIRO_TIENDA && (
              <Select
                value={orderDetails.entregaEn}
                onValueChange={(v) =>
                  setOrderDetails({ ...orderDetails, entregaEn: v as any })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Entrega en" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DOMICILIO">Domicilio</SelectItem>
                  <SelectItem value="SUCURSAL">Sucursal de envío</SelectItem>
                </SelectContent>
              </Select>
            )}

            {orderDetails.deliveryType !== DeliveryType.RETIRO_TIENDA && (
              <Select
                value={orderDetails.enviaPor}
                onValueChange={(v) =>
                  setOrderDetails({ ...orderDetails, enviaPor: v as any })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Envía por" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="REPARTIDOR">Repartidor interno</SelectItem>
                  <SelectItem value="CORREO">Correo</SelectItem>
                </SelectContent>
              </Select>
            )}

            <Textarea
              className="md:col-span-2"
              placeholder="Comentarios"
              value={orderDetails.notes}
              onChange={(e) =>
                setOrderDetails({ ...orderDetails, notes: e.target.value })
              }
            />
          </CardContent>
        </Card>

        {/* Cierre */}
        <Card>
          <CardHeader>
            <CardTitle>Cierre de venta</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Select onValueChange={setPaymentMethod}>
              <SelectTrigger>
                <SelectValue placeholder="Método de pago" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="efectivo">Efectivo</SelectItem>
                <SelectItem value="tarjeta">Tarjeta</SelectItem>
                <SelectItem value="transferencia">Transferencia</SelectItem>
              </SelectContent>
            </Select>

            {paymentMethod === "tarjeta" && (
              <Select onValueChange={setInstallments}>
                <SelectTrigger>
                  <SelectValue placeholder="Cuotas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 cuota</SelectItem>
                  <SelectItem value="3">3 cuotas</SelectItem>
                  <SelectItem value="6">6 cuotas</SelectItem>
                </SelectContent>
              </Select>
            )}

            <div className="border-t pt-4 text-sm space-y-1">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>${subtotal}</span>
              </div>
              <div className="flex justify-between text-green-600">
                <span>Descuento</span>
                <span>-${discount}</span>
              </div>
              <div className="flex justify-between">
                <span>Impuestos</span>
                <span>${taxes}</span>
              </div>
              <div className="flex justify-between font-semibold text-base">
                <span>Total</span>
                <span>${total}</span>
              </div>
            </div>

            <Button
              className="w-full bg-teal-600 hover:bg-teal-700"
              disabled={!canSubmit}
            >
              Confirmar venta
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
/* 
se pueda agregar dos items separados en el carrito por si se quiere cambiar a diferentes precio
numeros negativos en carrito ni menor a stock
  se pueda editar el precio de venta en los productos(front)
  el form de cliente debe estar siempre
  mandar por wsp el pedido al confirmar la vent

*/
/* 
@Entity('orderHeader')
export class OrderHeader {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: ReceiptType })
  receiptType: ReceiptType; // BOLETA, FACTURA

  @Column({ type: 'enum', enum: OrderType })
  orderType: OrderType; //VENTA, RESERVA, PREVENTA

  @Column({ type: 'uuid', nullable: false })
  storeId: string;

  @ManyToOne(() => Client, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'customer_id' })
  customer: Client;

  @Column({ type: 'enum', enum: SalesChannel })
  salesChannel: SalesChannel; //TIENDA_FISICA, WHATSAPP, INSTAGRAM, FACEBOOK, MARKETPLACE, MERCADOLIBRE, OTRO

  @Column({ type: 'enum', enum: SalesChannel })
  closingChannel: SalesChannel; //TIENDA_FISICA, WHATSAPP, INSTAGRAM, FACEBOOK, MARKETPLACE, MERCADOLIBRE, OTRO

  @Column({ type: 'enum', enum: DeliveryType })
  deliveryType: DeliveryType; // RETIRO_TIENDA, DOMICILIO, PUNTO_EXTERNO

  @Column({ type: 'uuid', nullable: true })
  courierId?: string | null;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  subtotal: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  taxTotal: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  shippingTotal: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  discountTotal: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: false })
  grandTotal: number;

  @Column({ type: 'enum', enum: OrderStatus })
  status: OrderStatus; // PENDIENTE, CONFIRMADA, PAGADA, EN_PREPARACION, ENVIADA, ENTRAGADA, ANULADA

  @Column({ type: 'varchar', length: 500, nullable: true })
  notes?: string | null;

  @OneToMany(() => OrderItems, (item) => item.order, {
    cascade: true,
  })
  items: OrderItems[];

  @OneToMany(() => Payments, (payment) => payment.order, {
    cascade: true,
  })
  payments: Payments[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}


*/
