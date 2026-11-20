"use client";
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Minus, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { crmKeys } from "@/lib/crmSse";
import { linkConversationQuote } from "@/services/crmService";
import {
  createQuotation,
  getQuotationCatalog,
  getQuotationInventories,
} from "@/services/quotationService";
import { errorMessage, money } from "@/components/quotations/quotationHelpers";
import type { Client } from "@/interfaces/ICliente";
import type { Conversation } from "@/types/crm";
import type {
  CreateQuotationInput,
  Quotation,
  QuotationAddress,
  QuotationCatalogItem,
  QuotationInventory,
  QuotationPaymentType,
} from "@/types/quotations";
import CustomerPhoneField from "./CustomerPhoneField";
import { NATIVE_SELECT_CLASS, phoneForCustomer } from "./format";
import { toLocalPhone } from "@/lib/crmPhone";
import { quoteMessage } from "./quotes";

interface CartLine {
  productVariantId: string;
  name: string;
  variant: string;
  sku: string;
  imageUrl?: string;
  unitPrice: number;
  quantity: number;
  stock: number;
}

interface Props {
  conversation: Conversation;
  /** Cliente de Core vinculado a la conversación (si existe). */
  client: Client | null | undefined;
  onClose: () => void;
  /** Recibe el texto con el enlace para dejarlo en la caja del chat (sin enviarlo). */
  onInsertMessage?: (text: string) => void;
}

/** Misma dirección que arma Cotizaciones al elegir un cliente existente. */
/**
 * Dirección del cliente de Core para la cotización. Core exige las cuatro
 * partes (departamento, provincia, distrito y dirección); si falta alguna no
 * se envía nada y el cliente la completa al abrir el enlace. En Clientes, el
 * departamento se guarda en `city`.
 */
function addressFromClient(client: Client): QuotationAddress | null {
  const department = client.city?.trim();
  const province = client.province?.trim();
  return client.address?.trim() && client.district?.trim() && department && province
    ? {
        address: client.address,
        district: client.district,
        department,
        province,
        // Sin valor se omiten: Core falla si llegan como null.
        ...(client.reference?.trim() ? { reference: client.reference.trim() } : {}),
        ...(client.documentNumber?.trim() ? { documentNumber: client.documentNumber.trim() } : {}),
      }
    : null;
}

/**
 * Armar pedido desde el chat: crea una cotización de Core (con enlace público
 * `/c/<token>`), la vincula a la conversación y deja el enlace en la caja.
 */
export default function ArmarPedidoDialog({
  conversation,
  client,
  onClose,
  onInsertMessage,
}: Props) {
  const { auth, selectedStoreId } = useAuth();
  const qc = useQueryClient();
  const stores = auth?.company?.stores ?? [];
  const phone = phoneForCustomer(conversation);

  const [storeId, setStoreId] = useState(
    stores.some((s) => s.id === selectedStoreId)
      ? (selectedStoreId as string)
      : (stores[0]?.id ?? ""),
  );
  const [inventories, setInventories] = useState<QuotationInventory[]>([]);
  const [inventoryId, setInventoryId] = useState("");
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [inventoryError, setInventoryError] = useState("");
  const [query, setQuery] = useState("");
  const [catalog, setCatalog] = useState<QuotationCatalogItem[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [name, setName] = useState(client?.fullName || conversation.contactName || "");
  const [paymentType, setPaymentType] = useState<QuotationPaymentType>("COMPLETO");
  const [deposit, setDeposit] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  // Si la cotización se creó pero falló el vínculo, el reintento solo repite el vínculo.
  const created = useRef<Quotation | null>(null);

  const total = cart.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0);
  const stockIssue = cart.some((l) => l.quantity > l.stock);

  useEffect(() => {
    if (!storeId) return;
    const controller = new AbortController();
    let active = true;
    setInventoryLoading(true);
    setInventoryError("");
    getQuotationInventories(storeId, controller.signal)
      .then((items) => {
        if (!active) return;
        const available = items.filter((i) => i.isActive);
        setInventories(available);
        setInventoryId((current) =>
          available.some((i) => i.id === current)
            ? current
            : available.length === 1
              ? available[0].id
              : "",
        );
      })
      .catch((e) => {
        if (active) setInventoryError(errorMessage(e, "No se pudieron cargar los almacenes."));
      })
      .finally(() => {
        if (active) setInventoryLoading(false);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [storeId]);

  useEffect(() => {
    if (!storeId || !inventoryId) {
      setCatalog([]);
      return;
    }
    const controller = new AbortController();
    let active = true;
    const timer = setTimeout(() => {
      setCatalogLoading(true);
      getQuotationCatalog(
        { storeId, inventoryId, search: query, page: 1, limit: 30 },
        controller.signal,
      )
        .then((items) => {
          if (!active) return;
          setCatalog(Array.isArray(items) ? items : []);
          setCatalogError("");
        })
        .catch((e) => {
          if (active) setCatalogError(errorMessage(e, "No se pudo cargar el catálogo."));
        })
        .finally(() => {
          if (active) setCatalogLoading(false);
        });
    }, 250);
    return () => {
      active = false;
      controller.abort();
      clearTimeout(timer);
    };
  }, [storeId, inventoryId, query]);

  const add = (item: QuotationCatalogItem) => {
    const stock = item.stockAvailable ?? 0;
    setCart((prev) => {
      const existing = prev.find((l) => l.productVariantId === item.productVariantId);
      if (existing) {
        return prev.map((l) => (l === existing ? { ...l, quantity: l.quantity + 1, stock } : l));
      }
      return [
        ...prev,
        {
          productVariantId: item.productVariantId,
          name: item.name,
          variant: item.variant ?? "",
          sku: item.sku ?? "",
          imageUrl: item.imageUrl,
          unitPrice: Number(item.unitPrice),
          quantity: 1,
          stock,
        },
      ];
    });
  };
  const setQty = (id: string, quantity: number) =>
    setCart((prev) => prev.map((l) => (l.productVariantId === id ? { ...l, quantity } : l)));
  const remove = (id: string) => setCart((prev) => prev.filter((l) => l.productVariantId !== id));

  async function save() {
    if (saving) return;
    setError("");
    if (!name.trim()) return setError("Completa el nombre del cliente.");
    if (!phone) return setError("Guarda el teléfono del cliente antes de armar el pedido.");
    if (phone.length > 20) return setError("El teléfono debe tener hasta 20 caracteres.");
    if (!storeId) return setError("Selecciona una tienda.");
    if (!inventoryId) return setError("Selecciona un almacén para el pedido.");
    if (!cart.length) return setError("Agrega al menos un producto.");
    if (cart.some((l) => !Number.isInteger(l.quantity) || l.quantity < 1))
      return setError("Cada producto necesita una cantidad entera mayor a cero.");
    if (stockIssue)
      return setError("Hay productos sin stock suficiente. Reduce la cantidad o quita la línea.");
    const suggestedDeposit = deposit === "" ? Math.round(total * 30) / 100 : Number(deposit);
    if (paymentType === "ADELANTO" && (!Number.isFinite(suggestedDeposit) || suggestedDeposit <= 0))
      return setError("Ingresa un adelanto sugerido mayor a cero.");
    if (paymentType === "ADELANTO" && suggestedDeposit > total)
      return setError("El adelanto no puede ser mayor al total.");

    const clientAddress = client ? addressFromClient(client) : null;
    const payload: CreateQuotationInput = {
      storeId,
      inventoryId,
      customerName: name.trim(),
      // Mismo formato que Clientes de Core: 9 dígitos si es de Perú.
      customerPhone: toLocalPhone(phone),
      ...(clientAddress ? { address: clientAddress } : {}),
      paymentType,
      suggestedDeposit: paymentType === "ADELANTO" ? suggestedDeposit : undefined,
      validityHours: 24,
      internalNote: "Armado desde el chat de ventas",
      lines: cart.map((l) => ({
        productVariantId: l.productVariantId,
        sku: l.sku || undefined,
        name: l.name.trim(),
        variant: l.variant,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        isManual: false,
        isPack: false,
        isGift: false,
        imageUrl: l.imageUrl,
      })),
    };

    setSaving(true);
    try {
      if (!created.current) created.current = await createQuotation(payload);
      const quotation = created.current;
      await linkConversationQuote(conversation.id, {
        quotationId: quotation.id,
        quotationNumber: quotation.number,
        publicUrl: quotation.publicUrl,
      });
      void qc.invalidateQueries({ queryKey: crmKeys.quotes(conversation.id) });
      void qc.invalidateQueries({ queryKey: crmKeys.messages(conversation.id) });
      onInsertMessage?.(quoteMessage(quotation.publicUrl));
      toast.success(`POWIP Link ${quotation.number} listo. Revisa el mensaje y envíalo.`);
      onClose();
    } catch (e) {
      setError(
        created.current
          ? `La cotización ${created.current.number} se creó, pero no se pudo vincular al chat: ${errorMessage(e, "intenta de nuevo")}. Pulsa de nuevo para reintentar.`
          : errorMessage(e, "No se pudo crear el pedido."),
      );
    } finally {
      setSaving(false);
    }
  }

  const locked = cart.length > 0 || !!created.current;
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !saving) onClose();
      }}
    >
      <DialogContent className="max-h-[92vh] overflow-y-auto rounded-2xl sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Armar pedido</DialogTitle>
          <DialogDescription>
            Arma el pedido y obtén un POWIP Link: el cliente lo abre, confirma su dirección y paga
            por Yape o transferencia.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="armar-tienda">Tienda</Label>
            <select
              id="armar-tienda"
              className={NATIVE_SELECT_CLASS}
              value={storeId}
              disabled={locked || stores.length <= 1}
              onChange={(e) => setStoreId(e.target.value)}
            >
              {stores.length === 0 && <option value="">Sin tiendas</option>}
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="armar-almacen">Almacén</Label>
            <select
              id="armar-almacen"
              className={NATIVE_SELECT_CLASS}
              value={inventoryId}
              disabled={locked || inventoryLoading || inventories.length === 0}
              onChange={(e) => setInventoryId(e.target.value)}
            >
              <option value="" disabled>
                {inventoryLoading ? "Cargando…" : "Selecciona un almacén"}
              </option>
              {inventories.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </select>
            {inventoryError && (
              <p role="alert" className="text-xs text-destructive">
                {inventoryError}
              </p>
            )}
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="armar-buscar">Buscar producto</Label>
            <div className="relative">
              <Search className="absolute left-2 top-2 h-4 w-4 text-muted-foreground" />
              <Input
                id="armar-buscar"
                className="pl-8"
                value={query}
                disabled={!inventoryId}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={inventoryId ? "Nombre, SKU o variante" : "Elige un almacén primero"}
              />
            </div>
            {catalogLoading && (
              <p role="status" className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Cargando catálogo…
              </p>
            )}
            {catalogError && (
              <p role="alert" className="text-xs text-destructive">
                {catalogError}
              </p>
            )}
            {!catalogLoading && !catalogError && inventoryId && catalog.length === 0 && (
              <p className="text-xs text-muted-foreground">No hay productos para esa búsqueda.</p>
            )}
            <ul className="max-h-64 space-y-1.5 overflow-y-auto" aria-label="Catálogo">
              {catalog.map((item) => {
                const stock = item.stockAvailable ?? 0;
                return (
                  <li
                    key={item.productVariantId}
                    className="flex items-center justify-between gap-2 rounded-md border p-2 text-sm"
                    data-testid="catalog-item"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{item.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {[item.variant, money(item.unitPrice)].filter(Boolean).join(" · ")} ·{" "}
                        {stock > 0 ? `Stock ${stock}` : "Sin stock"}
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={stock <= 0}
                      aria-label={`Agregar ${item.name}${item.variant ? ` ${item.variant}` : ""}`}
                      onClick={() => add(item)}
                    >
                      <Plus />
                    </Button>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Pedido</p>
            {cart.length === 0 && (
              <p className="text-sm text-muted-foreground">Aún no agregaste productos.</p>
            )}
            <ul className="space-y-1.5" aria-label="Líneas del pedido">
              {cart.map((l) => (
                <li
                  key={l.productVariantId}
                  className="space-y-1 rounded-md border p-2 text-sm"
                  data-testid="cart-line"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{l.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {[l.variant, money(l.unitPrice)].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      aria-label={`Quitar ${l.name}`}
                      onClick={() => remove(l.productVariantId)}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        aria-label={`Menos ${l.name}`}
                        disabled={l.quantity <= 1}
                        onClick={() => setQty(l.productVariantId, l.quantity - 1)}
                      >
                        <Minus />
                      </Button>
                      <Input
                        type="number"
                        min={1}
                        className="h-8 w-16 text-center"
                        aria-label={`Cantidad ${l.name}`}
                        value={Number.isNaN(l.quantity) ? "" : l.quantity}
                        onChange={(e) => setQty(l.productVariantId, e.target.valueAsNumber)}
                      />
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        aria-label={`Más ${l.name}`}
                        onClick={() => setQty(l.productVariantId, (l.quantity || 0) + 1)}
                      >
                        <Plus />
                      </Button>
                    </div>
                    <span className="font-medium">{money(l.quantity * l.unitPrice)}</span>
                  </div>
                  {l.quantity > l.stock && (
                    <p role="alert" className="text-xs text-destructive">
                      Stock insuficiente: quedan {l.stock}.
                    </p>
                  )}
                </li>
              ))}
            </ul>
            <p className="flex justify-between border-t pt-2 text-sm font-semibold">
              <span>Total</span>
              <span data-testid="armar-total">{money(total)}</span>
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="armar-nombre">Cliente</Label>
            <Input id="armar-nombre" value={name} onChange={(e) => setName(e.target.value)} />
            {phone ? (
              <p className="text-xs text-muted-foreground">Teléfono: {phone}</p>
            ) : (
              <CustomerPhoneField conversation={conversation} />
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="armar-pago">Tipo de pago</Label>
            <select
              id="armar-pago"
              className={NATIVE_SELECT_CLASS}
              value={paymentType}
              onChange={(e) => setPaymentType(e.target.value as QuotationPaymentType)}
            >
              <option value="COMPLETO">Pago completo</option>
              <option value="ADELANTO">Adelanto</option>
            </select>
            {paymentType === "ADELANTO" && (
              <div className="space-y-1">
                <Label htmlFor="armar-adelanto" className="text-xs">
                  Adelanto sugerido (S/)
                </Label>
                <Input
                  id="armar-adelanto"
                  type="number"
                  min={0}
                  step="0.01"
                  value={deposit}
                  onChange={(e) => setDeposit(e.target.value)}
                  placeholder={String(Math.round(total * 30) / 100)}
                />
                <p className="text-xs text-muted-foreground">
                  Si lo dejas vacío se sugiere el 30 % del total.
                </p>
              </div>
            )}
          </div>
        </div>

        {error && (
          <p role="alert" className="text-sm font-medium text-destructive">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" disabled={saving} onClick={onClose}>
            Cancelar
          </Button>
          <Button type="button" onClick={save} disabled={saving}>
            {saving && <Loader2 className="animate-spin" />} Crear POWIP Link
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
