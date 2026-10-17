"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Plus, Search, Trash2, Package, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { usePacks } from "@/contexts/PacksContext";
import { usePacksEngine } from "@/hooks/usePacksEngine";
import SuggestionsPanel from "@/components/registrar-venta/SuggestionsPanel";
import type { CartItem } from "@/interfaces/IOrder";
import type { InventoryItemForSale } from "@/interfaces/IProduct";
import type { Pack } from "@/interfaces/IPack";
import type {
  CreateQuotationInput,
  Quotation,
  QuotationLine,
  QuotationCatalogItem,
} from "@/types/quotations";
import { createQuotation, getQuotationCatalog, updateQuotation } from "@/services/quotationService";
import { errorMessage, money } from "./quotationHelpers";

function toCart(line: QuotationLine): CartItem {
  return {
    id: line.id || crypto.randomUUID(),
    inventoryItemId: "",
    variantId: line.productVariantId || "",
    productName: line.name,
    sku: line.sku || "",
    attributes: line.variant ? { Variante: line.variant } : {},
    quantity: line.quantity,
    price: Number(line.unitPrice),
    discount: 0,
    packId: line.packId,
    isGift: line.isGift,
  };
}

function catalogVariant(line: QuotationCatalogItem): InventoryItemForSale {
  return {
    inventoryItemId: "",
    variantId: line.productVariantId || "",
    productName: line.name,
    sku: line.sku || "",
    price: Number(line.unitPrice),
    attributes: line.variant ? { Variante: line.variant } : {},
    availableStock: line.stockAvailable ?? 0,
    physicalStock: line.stockAvailable ?? 0,
  };
}

export default function QuotationForm({
  quotation,
  storeId,
  onClose,
  onSaved,
}: {
  quotation?: Quotation;
  storeId: string;
  onClose: () => void;
  onSaved: (quotation: Quotation) => void;
}) {
  const [name, setName] = useState(quotation?.customerName || "");
  const [phone, setPhone] = useState(quotation?.customerPhone || "");
  const [cart, setCart] = useState<CartItem[]>(() => quotation?.lines.map(toCart) || []);
  const [query, setQuery] = useState("");
  const [catalog, setCatalog] = useState<QuotationCatalogItem[]>([]);
  const [stock, setStock] = useState<Record<string, number>>(() =>
    Object.fromEntries(
      (quotation?.lines || [])
        .filter((line) => line.productVariantId && line.stockAvailable != null)
        .map((line) => [line.productVariantId!, line.stockAvailable!]),
    ),
  );
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState("");
  const [validity, setValidity] = useState(quotation ? "custom" : "24");
  const [customExpiry, setCustomExpiry] = useState(() => {
    if (!quotation) return "";
    const date = new Date(quotation.expiresAt);
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  });
  const [paymentType, setPaymentType] = useState<"COMPLETO" | "ADELANTO">(
    quotation?.paymentType || "COMPLETO",
  );
  const [suggested, setSuggested] = useState(
    quotation?.suggestedDeposit != null ? String(quotation.suggestedDeposit) : "",
  );
  const [note, setNote] = useState(quotation?.internalNote || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const { packs } = usePacks();
  const total = cart.reduce((sum, line) => sum + line.quantity * line.price, 0);

  const loadCatalog = useCallback(
    async (search: string) => {
      return getQuotationCatalog({ storeId, search });
    },
    [storeId],
  );

  useEffect(() => {
    let active = true;
    const timeout = setTimeout(() => {
      setCatalogLoading(true);
      loadCatalog(query)
        .then((items) => {
          if (!active) return;
          setCatalog(items);
          setCatalogError("");
          setStock((previous) => ({
            ...previous,
            ...Object.fromEntries(
              items
                .filter((item) => item.productVariantId)
                .map((item) => [item.productVariantId!, item.stockAvailable ?? 0]),
            ),
          }));
        })
        .catch((failure) => {
          if (active) setCatalogError(errorMessage(failure, "No se pudo cargar el catálogo."));
        })
        .finally(() => {
          if (active) setCatalogLoading(false);
        });
    }, 250);
    return () => {
      active = false;
      clearTimeout(timeout);
    };
  }, [loadCatalog, query]);

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const items = await loadCatalog("");
        if (active)
          setStock((previous) => ({
            ...previous,
            ...Object.fromEntries(
              items
                .filter((item) => item.productVariantId)
                .map((item) => [item.productVariantId!, item.stockAvailable ?? 0]),
            ),
          }));
      } catch {
        /* The visible catalog reports load errors; saving always revalidates server stock. */
      }
    };
    const interval = setInterval(refresh, 30000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [loadCatalog]);

  const getVariantsForProduct = useCallback(
    async (productName: string) => {
      const items = await loadCatalog(productName);
      setStock((previous) => ({
        ...previous,
        ...Object.fromEntries(
          items
            .filter((item) => item.productVariantId)
            .map((item) => [item.productVariantId!, item.stockAvailable ?? 0]),
        ),
      }));
      return items.filter((item) => item.name === productName).map(catalogVariant);
    },
    [loadCatalog],
  );

  const engine = usePacksEngine({ packs, cart, setCart, getVariantsForProduct });
  const appliedPacks = useMemo(
    () => ({
      ...Object.fromEntries(cart.filter((line) => line.packId).map((line) => [line.packId!, {}])),
      ...engine.appliedPacks,
    }),
    [cart, engine.appliedPacks],
  );
  const pendingHints = engine.pendingHints.filter(
    (pack) => pack.type !== "GIFT" && !appliedPacks[pack.id],
  );
  const giftHints = engine.pendingHints.filter((pack) => pack.type === "GIFT");
  const quantities = cart.reduce<Record<string, number>>((result, line) => {
    if (line.variantId) result[line.variantId] = (result[line.variantId] || 0) + line.quantity;
    return result;
  }, {});
  const stockIssue = cart.some(
    (line) =>
      line.variantId &&
      stock[line.variantId] != null &&
      quantities[line.variantId] > stock[line.variantId],
  );
  const expiresAt =
    validity === "custom"
      ? customExpiry && new Date(customExpiry)
      : new Date(Date.now() + Number(validity) * 3600000);

  function addProduct(product: InventoryItemForSale, quantity = 1) {
    if (product.availableStock <= 0) {
      toast.error(
        `${product.productName} no tiene stock disponible. Puedes agregar una línea manual.`,
      );
      return;
    }
    if ((quantities[product.variantId] || 0) + quantity > product.availableStock) {
      toast.error(`Sin stock suficiente: quedan ${product.availableStock} unidades.`);
      return;
    }
    setStock((previous) => ({ ...previous, [product.variantId]: product.availableStock }));
    setCart((previous) => {
      const existing = previous.find(
        (line) => line.variantId === product.variantId && !line.packId,
      );
      return existing
        ? previous.map((line) =>
            line.id === existing.id ? { ...line, quantity: line.quantity + quantity } : line,
          )
        : [
            ...previous,
            {
              id: crypto.randomUUID(),
              inventoryItemId: product.inventoryItemId,
              variantId: product.variantId,
              productName: product.productName,
              sku: product.sku,
              attributes: product.attributes,
              quantity,
              price: product.price,
              pvp: product.price,
              discount: 0,
            },
          ];
    });
    setQuery("");
  }

  async function autoAdd(productName: string, quantity = 1) {
    try {
      const variants = await getVariantsForProduct(productName);
      const best = variants
        .filter(
          (product) => product.availableStock >= (quantities[product.variantId] || 0) + quantity,
        )
        .sort((a, b) => b.availableStock - a.availableStock)[0];
      if (!best) return void toast.error("No hay stock suficiente para completar esta promoción.");
      addProduct(best, quantity);
    } catch (failure) {
      toast.error(errorMessage(failure, "No se pudo consultar el stock."));
    }
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (!name.trim()) return setError("Completa el nombre del cliente.");
    if (!phone.trim() || phone.length > 20)
      return setError("Ingresa un teléfono de contacto de hasta 20 caracteres.");
    if (!cart.length) return setError("Agrega al menos un producto.");
    if (
      cart.some(
        (line) =>
          !line.productName.trim() ||
          !Number.isInteger(line.quantity) ||
          line.quantity < 1 ||
          !Number.isFinite(line.price) ||
          line.price < 0,
      )
    )
      return setError(
        "Cada línea necesita un nombre, una cantidad entera mayor a cero y un precio válido.",
      );
    if (stockIssue)
      return setError("Hay productos sin stock suficiente. Reduce la cantidad o quita la línea.");
    if (!expiresAt || Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now())
      return setError("La fecha de vigencia debe ser posterior a ahora.");
    const deposit = suggested === "" ? Math.round(total * 30) / 100 : Number(suggested);
    if (paymentType === "ADELANTO" && (!Number.isFinite(deposit) || deposit <= 0))
      return setError("Ingresa un adelanto sugerido mayor a cero.");
    const payload: CreateQuotationInput = {
      storeId,
      customerName: name.trim(),
      customerPhone: phone.trim(),
      paymentType,
      suggestedDeposit: paymentType === "ADELANTO" ? deposit : undefined,
      ...(validity === "custom"
        ? { expiresAt: expiresAt.toISOString() }
        : { validityHours: Number(validity) }),
      internalNote: note.trim(),
      lines: cart.map((line) => ({
        productVariantId: line.variantId || undefined,
        sku: line.sku || undefined,
        name: line.productName.trim(),
        variant: Object.values(line.attributes || {}).join(" · "),
        quantity: line.quantity,
        unitPrice: line.price,
        isManual: !line.variantId,
        isPack: Boolean(line.packId || quotation?.lines.find((original) => original.id === line.id)?.isPack),
        packId:
          line.packId && packs.find((pack) => pack.id === line.packId)?.synced
            ? line.packId
            : undefined,
        isGift: line.isGift || false,
      })),
    };
    setSaving(true);
    try {
      const saved = quotation
        ? await updateQuotation(quotation.id, payload)
        : await createQuotation(payload);
      onSaved(saved);
    } catch (failure) {
      setError(errorMessage(failure, "No se pudo guardar la cotización."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !saving) onClose();
      }}
    >
      <DialogContent className="max-h-[92vh] overflow-y-auto rounded-2xl sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>{quotation ? `Editar ${quotation.number}` : "Nueva cotización"}</DialogTitle>
          <DialogDescription>
            Solo lo esencial: cliente, teléfono y productos. Completa el despacho cuando conviertas
            en venta.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={save} noValidate className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(260px,1fr)]">
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="quote-name">Nombre completo *</Label>
                  <Input
                    id="quote-name"
                    autoFocus
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    maxLength={150}
                    placeholder="Ej: María Quispe"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="quote-phone">Teléfono *</Label>
                  <Input
                    id="quote-phone"
                    type="tel"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    maxLength={20}
                    placeholder="987 654 321"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="quote-search">Buscar producto por nombre o SKU</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="quote-search"
                    className="pl-9"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Buscar en tu catálogo…"
                    autoComplete="off"
                  />
                </div>
                <div className="max-h-44 overflow-y-auto rounded-xl border" aria-live="polite">
                  {catalogLoading ? (
                    <p className="p-3 text-sm text-muted-foreground">Cargando productos…</p>
                  ) : catalogError ? (
                    <p role="alert" className="p-3 text-sm text-destructive">
                      {catalogError}
                    </p>
                  ) : !catalog.length ? (
                    <p className="p-3 text-sm text-muted-foreground">
                      No se encontraron productos.
                    </p>
                  ) : (
                    catalog.map((line) => {
                      const available = line.stockAvailable ?? 0;
                      return (
                        <button
                          key={line.productVariantId || line.sku}
                          type="button"
                          disabled={available <= 0}
                          onClick={() => addProduct(catalogVariant(line))}
                          className="flex w-full items-center justify-between gap-3 border-b p-3 text-left last:border-0 hover:bg-muted/60 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <span className="min-w-0">
                            <span className="block text-sm font-medium">{line.name}</span>
                            <span className="block text-xs text-muted-foreground">
                              {[line.variant, line.sku].filter(Boolean).join(" · ")} ·{" "}
                              {available > 0 ? `Stock: ${available}` : "Sin stock"}
                            </span>
                          </span>
                          <span className="shrink-0 text-sm font-semibold">
                            {money(line.unitPrice)}
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
              <div className="space-y-2">
                {cart.length === 0 && (
                  <div className="rounded-xl border border-dashed p-5 text-center text-sm text-muted-foreground">
                    <Package className="mx-auto mb-2 h-6 w-6" />
                    Agrega un producto para comenzar.
                  </div>
                )}
                {cart.map((line, index) => {
                  const insufficient = Boolean(
                    line.variantId &&
                      stock[line.variantId] != null &&
                      quantities[line.variantId] > stock[line.variantId],
                  );
                  return (
                    <div
                      key={line.id}
                      className={`space-y-2 rounded-xl border p-3 ${insufficient ? "border-red-300 bg-red-50/40 dark:bg-red-500/5" : ""}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          {line.variantId ? (
                            <>
                              <p className="text-sm font-semibold">{line.productName}</p>
                              <p className="text-xs text-muted-foreground">
                                {Object.values(line.attributes || {}).join(" · ")} {line.sku}
                              </p>
                            </>
                          ) : (
                            <>
                              <Input
                                aria-label={`Nombre línea manual ${index + 1}`}
                                value={line.productName}
                                onChange={(event) =>
                                  setCart((previous) =>
                                    previous.map((item) =>
                                      item.id === line.id
                                        ? { ...item, productName: event.target.value }
                                        : item,
                                    ),
                                  )
                                }
                                placeholder="Nombre del producto"
                              />
                              <p className="mt-1 text-xs text-amber-700">
                                Manual · sin control de stock
                              </p>
                            </>
                          )}
                          {(line.packId || quotation?.lines.find((original) => original.id === line.id)?.isPack) && (
                            <span className="text-xs font-medium text-violet-600">
                              Promoción aplicada
                            </span>
                          )}
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={`Quitar ${line.productName || "línea manual"}`}
                          onClick={() =>
                            setCart((previous) => previous.filter((item) => item.id !== line.id))
                          }
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="flex items-end gap-3">
                        <div className="w-24 space-y-1">
                          <Label htmlFor={`qty-${line.id}`} className="text-xs">
                            Cantidad
                          </Label>
                          <Input
                            id={`qty-${line.id}`}
                            type="number"
                            min={1}
                            step={1}
                            value={line.quantity}
                            onChange={(event) =>
                              setCart((previous) =>
                                previous.map((item) =>
                                  item.id === line.id
                                    ? { ...item, quantity: Number(event.target.value) }
                                    : item,
                                ),
                              )
                            }
                          />
                        </div>
                        <div className="w-32 space-y-1">
                          <Label htmlFor={`price-${line.id}`} className="text-xs">
                            Precio unitario
                          </Label>
                          <Input
                            id={`price-${line.id}`}
                            type="number"
                            min={0}
                            step="0.01"
                            value={line.price}
                            onChange={(event) =>
                              setCart((previous) =>
                                previous.map((item) =>
                                  item.id === line.id
                                    ? { ...item, price: Number(event.target.value) }
                                    : item,
                                ),
                              )
                            }
                          />
                        </div>
                        <strong className="ml-auto pb-2 text-sm">
                          {money(line.quantity * line.price)}
                        </strong>
                      </div>
                      {insufficient && (
                        <p role="alert" className="flex gap-1 text-xs text-red-700">
                          <AlertTriangle className="h-4 w-4 shrink-0" />
                          Sin stock suficiente — quedan {stock[line.variantId]}. Reduce la cantidad
                          o quita la línea.
                        </p>
                      )}
                    </div>
                  );
                })}
                <Button
                  type="button"
                  variant="outline"
                  className="w-full border-dashed"
                  onClick={() =>
                    setCart((previous) => [
                      ...previous,
                      {
                        id: crypto.randomUUID(),
                        inventoryItemId: "",
                        variantId: "",
                        productName: "",
                        sku: "",
                        quantity: 1,
                        price: 0,
                        discount: 0,
                      },
                    ])
                  }
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Agregar línea manual
                </Button>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-teal-50 p-4 dark:bg-teal-500/10">
                <span className="font-medium">Total cotizado</span>
                <strong className="text-xl text-teal-700 dark:text-teal-300">{money(total)}</strong>
              </div>
              <fieldset className="space-y-2">
                <legend className="mb-2 text-sm font-medium">Vigencia de la cotización</legend>
                <div className="flex flex-wrap gap-2">
                  {[
                    ["2", "2 horas"],
                    ["24", "24 horas"],
                    ["72", "3 días"],
                    ["custom", "Otra fecha"],
                  ].map(([value, label]) => (
                    <Button
                      key={value}
                      type="button"
                      size="sm"
                      variant={validity === value ? "default" : "outline"}
                      aria-pressed={validity === value}
                      onClick={() => setValidity(value)}
                    >
                      {label}
                    </Button>
                  ))}
                </div>
                {validity === "custom" && (
                  <Input
                    type="datetime-local"
                    aria-label="Fecha y hora de vigencia"
                    value={customExpiry}
                    onChange={(event) => setCustomExpiry(event.target.value)}
                  />
                )}
                {expiresAt && !Number.isNaN(expiresAt.getTime()) && (
                  <p className="text-xs text-muted-foreground">
                    Válida hasta{" "}
                    {expiresAt.toLocaleString("es-PE", { dateStyle: "medium", timeStyle: "short" })}
                  </p>
                )}
              </fieldset>
              <fieldset className="space-y-2">
                <legend className="mb-2 text-sm font-medium">Tipo de cobro</legend>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={paymentType === "COMPLETO" ? "default" : "outline"}
                    aria-pressed={paymentType === "COMPLETO"}
                    onClick={() => setPaymentType("COMPLETO")}
                  >
                    Pago completo
                  </Button>
                  <Button
                    type="button"
                    variant={paymentType === "ADELANTO" ? "default" : "outline"}
                    aria-pressed={paymentType === "ADELANTO"}
                    onClick={() => {
                      setPaymentType("ADELANTO");
                      if (suggested === "") setSuggested((Math.round(total * 30) / 100).toFixed(2));
                    }}
                  >
                    Con adelanto (COD)
                  </Button>
                </div>
                {paymentType === "ADELANTO" && (
                  <div className="space-y-1.5">
                    <Label htmlFor="quote-deposit">Adelanto sugerido (S/) *</Label>
                    <Input
                      id="quote-deposit"
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={suggested}
                      placeholder={(Math.round(total * 30) / 100).toFixed(2)}
                      onChange={(event) => setSuggested(event.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Por defecto, 30% del total. El resto se cobra contraentrega.
                    </p>
                  </div>
                )}
              </fieldset>
              <div className="space-y-1.5">
                <Label htmlFor="quote-note">Nota interna (opcional)</Label>
                <Textarea
                  id="quote-note"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Solo visible para tu equipo"
                />
              </div>
            </div>
            <aside className="space-y-3 rounded-2xl bg-muted/30 p-4 self-start">
              <SuggestionsPanel
                packs={packs}
                appliedPacks={appliedPacks}
                pendingHints={pendingHints}
                modelQtyInCart={engine.modelQtyInCart}
                subtotalPayable={engine.subtotalPayable}
                totalUnits={engine.totalUnits}
                isAdmin
                onApplyPack={(pack) => engine.applyPack(pack)}
                onAutoFillVolume={(pack: Pack) => {
                  if (pack.type === "VOLUME")
                    void autoAdd(
                      pack.product.productKey,
                      pack.minQty - engine.modelQtyInCart(pack.product.productKey),
                    );
                }}
                onAutoAddBundleItem={(product) => void autoAdd(product)}
              />
              {giftHints.map((pack) => (
                <div
                  key={pack.id}
                  className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm dark:bg-amber-500/10"
                >
                  <strong>Regalo desbloqueado: {pack.name}</strong>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Ofrece este incentivo al cliente. El regalo se define al registrar la venta.
                  </p>
                </div>
              ))}
              {Object.keys(appliedPacks).map((id) => (
                <Button
                  type="button"
                  key={id}
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const affectedIds = new Set(cart.filter((line) => line.packId === id).map((line) => line.id));
                    engine.undoPack(id);
                    setCart((previous) =>
                      previous.map((line) =>
                        affectedIds.has(line.id)
                          ? {
                              ...line,
                              packId: null,
                              price:
                                catalog.find((item) => item.productVariantId === line.variantId)
                                  ?.unitPrice ??
                                line.pvp ??
                                line.price,
                            }
                          : line,
                      ),
                    );
                  }}
                >
                  Quitar {packs.find((pack) => pack.id === id)?.name || "promoción"}
                </Button>
              ))}
              {engine.pvsOpen && (
                <div className="space-y-3 rounded-xl border bg-background p-3">
                  <p className="text-sm font-semibold">Elegir variantes del pack</p>
                  {engine.pvsOpen.variants.map((variant) => (
                    <div key={variant.variantId} className="flex items-center gap-2">
                      <span className="flex-1 text-xs">
                        {Object.values(variant.attributes || {}).join(" · ") || variant.sku} (stock{" "}
                        {variant.availableStock})
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        aria-label={`Restar ${variant.sku}`}
                        onClick={() => engine.pvsChg(variant.variantId, -1)}
                      >
                        −
                      </Button>
                      <span className="text-sm">
                        {engine.pvsOpen?.dist[variant.variantId] || 0}
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        aria-label={`Sumar ${variant.sku}`}
                        onClick={() => engine.pvsChg(variant.variantId, 1)}
                      >
                        +
                      </Button>
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => {
                        if (!engine.pvsConfirm()) toast.error("Completa las unidades del pack.");
                      }}
                    >
                      Aplicar pack
                    </Button>
                    <Button type="button" size="sm" variant="ghost" onClick={engine.pvsCancel}>
                      Cancelar
                    </Button>
                  </div>
                </div>
              )}
            </aside>
          </div>
          {error && (
            <p role="alert" className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" disabled={saving} onClick={onClose}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={saving}
              className="bg-teal-600 text-white hover:bg-teal-700"
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {saving ? "Guardando…" : "Guardar cotización"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
