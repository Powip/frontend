"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Plus,
  Search,
  Trash2,
  Package,
  Loader2,
  Link2,
  ExternalLink,
  RefreshCw,
} from "lucide-react";
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
import type { BundleProductRef, Pack } from "@/interfaces/IPack";
import type {
  CreateQuotationInput,
  Quotation,
  QuotationLine,
  QuotationCatalogItem,
  QuotationAddress,
  QuotationCustomer,
  QuotationInventory,
} from "@/types/quotations";
import {
  createQuotation,
  getQuotationCatalog,
  getQuotationInventories,
  searchQuotationCustomers,
  updateQuotation,
  uploadQuotationLineImage,
} from "@/services/quotationService";
import { errorMessage, money } from "./quotationHelpers";
import { resolveBundleVariant } from "@/utils/resolveBundleVariant";
import { tokenStore } from "@/lib/tokenStore";

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
    imageUrl: line.imageUrl,
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
  const [customerAddress, setCustomerAddress] = useState<QuotationAddress | null | undefined>(
    quotation?.address || undefined,
  );
  const [customerQuery, setCustomerQuery] = useState("");
  const [customers, setCustomers] = useState<QuotationCustomer[]>([]);
  const [customerLoading, setCustomerLoading] = useState(false);
  const [customerError, setCustomerError] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [inventories, setInventories] = useState<QuotationInventory[]>([]);
  const [inventoryId, setInventoryId] = useState(quotation?.inventoryId || "");
  const [inventoryLoading, setInventoryLoading] = useState(true);
  const [inventoryError, setInventoryError] = useState("");
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
  const [catalogPage, setCatalogPage] = useState(1);
  const [hasMoreCatalog, setHasMoreCatalog] = useState(false);
  const [catalogVersion, setCatalogVersion] = useState(0);
  const [mappingLineId, setMappingLineId] = useState<string | null>(null);
  const [uploadingLineId, setUploadingLineId] = useState<string | null>(null);
  const searchInput = useRef<HTMLInputElement>(null);
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
  const bundleScope = useRef({ storeId, inventoryId, active: true });
  bundleScope.current.storeId = storeId;
  bundleScope.current.inventoryId = inventoryId;
  const formScope = bundleScope;
  const currentCart = useRef(cart);
  currentCart.current = cart;
  useEffect(() => {
    bundleScope.current.active = true;
    return () => {
      bundleScope.current.active = false;
    };
  }, []);
  const total = cart.reduce((sum, line) => sum + line.quantity * line.price, 0);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setInventoryLoading(true);
    setInventoryError("");
    getQuotationInventories(storeId, controller.signal)
      .then((items) => {
        if (!active) return;
        const available = items.filter((item) => item.isActive);
        setInventories(available);
        setInventoryId((current) =>
          available.some((item) => item.id === current)
            ? current
            : available.length === 1
              ? available[0].id
              : "",
        );
      })
      .catch((failure) => {
        if (active)
          setInventoryError(errorMessage(failure, "No se pudieron cargar los almacenes."));
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
    const search = customerQuery.trim();
    const controller = new AbortController();
    let active = true;
    setCustomers([]);
    setCustomerError("");
    if (search.length < 2) {
      setCustomerLoading(false);
      return () => controller.abort();
    }
    setCustomerLoading(true);
    const timeout = setTimeout(() => {
      searchQuotationCustomers({ storeId, search }, controller.signal)
        .then((items) => {
          if (active) setCustomers(items);
        })
        .catch((failure) => {
          if (active) setCustomerError(errorMessage(failure, "No se pudo buscar el cliente."));
        })
        .finally(() => {
          if (active) setCustomerLoading(false);
        });
    }, 300);
    return () => {
      active = false;
      clearTimeout(timeout);
      controller.abort();
    };
  }, [customerQuery, storeId]);

  function selectCustomer(customer: QuotationCustomer) {
    setName(customer.name);
    setPhone(customer.phone);
    setSelectedCustomer(customer.name);
    setCustomerAddress(
      customer.address && customer.district
        ? {
            address: customer.address,
            district: customer.district,
            department: customer.department,
            province: customer.province,
            reference: customer.reference,
            documentNumber: customer.documentNumber,
          }
        : null,
    );
    setCustomerQuery("");
    setCustomers([]);
  }

  function editCustomer() {
    // Delivery data belongs to the selected identity; never carry it to another customer.
    setSelectedCustomer("");
    setCustomerAddress(null);
  }

  const loadCatalog = useCallback(
    async (search: string, page?: number, signal?: AbortSignal) => {
      return getQuotationCatalog(
        { storeId, inventoryId, search, ...(page ? { page, limit: 30 } : {}) },
        signal,
      );
    },
    [storeId, inventoryId],
  );

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    if (!inventoryId || inventoryLoading) {
      setCatalog([]);
      setCatalogLoading(false);
      return () => controller.abort();
    }
    const timeout = setTimeout(() => {
      setCatalogLoading(true);
      loadCatalog(query, catalogPage, controller.signal)
        .then((items) => {
          if (!active) return;
          setCatalog((previous) =>
            catalogPage === 1
              ? items
              : [
                  ...previous,
                  ...items.filter(
                    (item) =>
                      !previous.some(
                        (existing) => existing.productVariantId === item.productVariantId,
                      ),
                  ),
                ],
          );
          setHasMoreCatalog(items.length === 30);
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
      controller.abort();
      clearTimeout(timeout);
    };
  }, [loadCatalog, query, inventoryLoading, inventoryId, catalogPage, catalogVersion]);

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      if (!inventoryId) return;
      try {
        const items = await loadCatalog(query, 1);
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
  }, [loadCatalog, query, inventoryId]);

  const getVariantsForProduct = useCallback(
    async (productName: string) => {
      const requestedScope = { storeId, inventoryId };
      const items = await loadCatalog(productName);
      if (
        !formScope.current.active ||
        formScope.current.storeId !== requestedScope.storeId ||
        formScope.current.inventoryId !== requestedScope.inventoryId
      )
        return [];
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
    [loadCatalog, storeId, inventoryId],
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
    if (mappingLineId) {
      const manual = cart.find((line) => line.id === mappingLineId);
      if (!manual) return;
      if ((quantities[product.variantId] || 0) + manual.quantity > product.availableStock) {
        toast.error(`Sin stock suficiente: quedan ${product.availableStock} unidades.`);
        return;
      }
      setStock((previous) => ({ ...previous, [product.variantId]: product.availableStock }));
      setCart((previous) =>
        previous.map((line) =>
          line.id === mappingLineId
            ? {
                ...line,
                variantId: product.variantId,
                inventoryItemId: product.inventoryItemId,
                productName: product.productName,
                sku: product.sku,
                attributes: product.attributes,
              }
            : line,
        ),
      );
      setMappingLineId(null);
      setQuery("");
      setCatalogPage(1);
      toast.success("Producto vinculado. Se conservan la cantidad y el precio acordados.");
      return;
    }
    if (product.availableStock <= 0) {
      toast.error(
        `${product.productName} no tiene stock disponible. Puedes agregar una línea manual.`,
      );
      return;
    }
    const quantityInCart = currentCart.current.reduce(
      (sum, line) => sum + (line.variantId === product.variantId ? line.quantity : 0),
      0,
    );
    if (quantityInCart + quantity > product.availableStock) {
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
              trackingMode: product.trackingMode,
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
    setCatalogPage(1);
  }

  function startMapping(line: CartItem) {
    setMappingLineId(line.id);
    setCatalogPage(1);
    setQuery(line.productName);
    searchInput.current?.focus();
  }

  async function uploadLinePhoto(lineId: string, file?: File) {
    if (!file) return;
    setUploadingLineId(lineId);
    setError("");
    try {
      const imageUrl = await uploadQuotationLineImage(storeId, file);
      setCart((previous) =>
        previous.map((line) => (line.id === lineId ? { ...line, imageUrl } : line)),
      );
    } catch (failure) {
      setError(errorMessage(failure, "No se pudo subir la foto del producto."));
    } finally {
      setUploadingLineId(null);
    }
  }

  async function autoAdd(productName: string, quantity = 1) {
    const requestedScope = { storeId, inventoryId };
    const isCurrent = () =>
      formScope.current.active &&
      formScope.current.storeId === requestedScope.storeId &&
      formScope.current.inventoryId === requestedScope.inventoryId;
    try {
      const variants = await getVariantsForProduct(productName);
      if (!isCurrent()) return;
      const best = variants
        .filter(
          (product) => product.availableStock >= (quantities[product.variantId] || 0) + quantity,
        )
        .sort((a, b) => b.availableStock - a.availableStock)[0];
      if (!best) return void toast.error("No hay stock suficiente para completar esta promoción.");
      addProduct(best, quantity);
    } catch (failure) {
      if (isCurrent()) toast.error(errorMessage(failure, "No se pudo consultar el stock."));
    }
  }

  async function autoAddBundle(item: BundleProductRef) {
    if (!("variantId" in item)) return autoAdd(item.productKey);
    const session = tokenStore.snapshot();
    const requestedStoreId = storeId;
    const requestedInventoryId = inventoryId;
    const isCurrent = () =>
      bundleScope.current.active &&
      bundleScope.current.storeId === requestedStoreId &&
      bundleScope.current.inventoryId === requestedInventoryId &&
      tokenStore.isCurrent(session);
    try {
      const variant = await resolveBundleVariant(item, {
        search: async (search) => ({
          data: (await loadCatalog(search)).map(catalogVariant),
        }),
      });
      if (!isCurrent()) return;
      if (!variant) throw new Error("La variante del bundle no está disponible en esta tienda.");
      addProduct(variant);
    } catch (failure) {
      if (isCurrent())
        toast.error(errorMessage(failure, "No se pudo consultar la variante del bundle."));
    }
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (saving || uploadingLineId) return;
    setError("");
    if (!name.trim()) return setError("Completa el nombre del cliente.");
    if (!phone.trim() || phone.length > 20)
      return setError("Ingresa un teléfono de contacto de hasta 20 caracteres.");
    if (!inventoryId) return setError("Selecciona un almacén para la cotización.");
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
      inventoryId,
      customerName: name.trim(),
      customerPhone: phone.trim(),
      ...(customerAddress !== undefined ? { address: customerAddress } : {}),
      paymentType,
      suggestedDeposit: paymentType === "ADELANTO" ? deposit : undefined,
      ...(validity === "custom"
        ? { expiresAt: expiresAt.toISOString() }
        : { validityHours: Number(validity) }),
      internalNote: note.trim(),
      lines: cart.map((line) => ({
        id: line.id,
        productVariantId: line.variantId || undefined,
        sku: line.sku || undefined,
        name: line.productName.trim(),
        variant: Object.values(line.attributes || {}).join(" · "),
        quantity: line.quantity,
        unitPrice: line.price,
        isManual: !line.variantId,
        isPack: Boolean(
          line.packId || quotation?.lines.find((original) => original.id === line.id)?.isPack,
        ),
        packId:
          line.packId && packs.find((pack) => pack.id === line.packId)?.synced
            ? line.packId
            : undefined,
        isGift: line.isGift || false,
        imageUrl: line.imageUrl,
        addedBy: quotation?.lines.find((original) => original.id === line.id)?.addedBy,
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
              <div className="space-y-1.5">
                <Label htmlFor="quote-customer-search">
                  Buscar cliente existente por nombre o teléfono
                </Label>
                <Input
                  id="quote-customer-search"
                  value={customerQuery}
                  onChange={(event) => setCustomerQuery(event.target.value)}
                  autoComplete="off"
                  placeholder="Escribe al menos 2 caracteres"
                  aria-controls="quote-customer-results"
                />
                {customerLoading && (
                  <p className="text-xs text-muted-foreground" role="status">
                    Buscando clientes…
                  </p>
                )}
                {customerError && (
                  <p role="alert" className="text-xs text-destructive">
                    {customerError}
                  </p>
                )}
                {customerQuery.trim().length >= 2 && !customerLoading && !customerError && (
                  <div
                    id="quote-customer-results"
                    className="max-h-40 overflow-y-auto rounded-lg border"
                  >
                    {customers.length ? (
                      customers.map((customer) => (
                        <button
                          key={customer.id}
                          type="button"
                          className="block w-full p-3 text-left text-sm hover:bg-muted"
                          onClick={() => selectCustomer(customer)}
                        >
                          <span className="font-medium">{customer.name}</span> · {customer.phone}
                          {customer.district && (
                            <span className="block text-xs text-muted-foreground">
                              {customer.district}
                            </span>
                          )}
                        </button>
                      ))
                    ) : (
                      <p className="p-3 text-sm text-muted-foreground">
                        Sin coincidencias. Puedes registrar el nombre y teléfono abajo.
                      </p>
                    )}
                  </div>
                )}
                {selectedCustomer && (
                  <p role="status" className="text-xs text-teal-700">
                    Cliente seleccionado: {selectedCustomer}
                    {customerAddress ? " · Se conservarán sus datos de entrega." : ""}
                  </p>
                )}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="quote-name">Nombre completo *</Label>
                  <Input
                    id="quote-name"
                    autoFocus
                    value={name}
                    onChange={(event) => {
                      editCustomer();
                      setName(event.target.value);
                    }}
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
                    onChange={(event) => {
                      editCustomer();
                      setPhone(event.target.value);
                    }}
                    maxLength={20}
                    placeholder="987 654 321"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="quote-inventory">Almacén *</Label>
                <select
                  id="quote-inventory"
                  value={inventoryId}
                  disabled={inventoryLoading || saving}
                  className="flex h-10 w-full rounded-md border bg-background px-3 text-sm"
                  onChange={(event) => {
                    setInventoryId(event.target.value);
                    setStock({});
                    setCatalog([]);
                    setCatalogPage(1);
                    setCatalogError("");
                  }}
                >
                  <option value="">
                    {inventoryLoading ? "Cargando almacenes…" : "Selecciona un almacén"}
                  </option>
                  {inventories.map((inventory) => (
                    <option key={inventory.id} value={inventory.id}>
                      {inventory.name}
                    </option>
                  ))}
                </select>
                {inventoryError && (
                  <p role="alert" className="text-xs text-destructive">
                    {inventoryError}
                  </p>
                )}
                {!inventoryLoading && !inventoryError && !inventories.length && (
                  <p role="alert" className="text-xs text-amber-700">
                    Esta tienda no tiene almacenes activos. Activa o vincula un almacén para
                    consultar productos.
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="quote-search">Buscar producto por nombre o SKU</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    ref={searchInput}
                    id="quote-search"
                    className="pl-9"
                    value={query}
                    onChange={(event) => {
                      setQuery(event.target.value);
                      setCatalogPage(1);
                    }}
                    placeholder="Buscar en tu catálogo…"
                    autoComplete="off"
                  />
                </div>
                {mappingLineId && (
                  <div
                    role="status"
                    className="flex items-center justify-between gap-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-900"
                  >
                    Selecciona el SKU que reemplaza al producto manual. Su cantidad y precio se
                    conservan.
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setMappingLineId(null)}
                    >
                      Cancelar vínculo
                    </Button>
                  </div>
                )}
                <div className="max-h-44 overflow-y-auto rounded-xl border" aria-live="polite">
                  {catalogLoading ? (
                    <p className="p-3 text-sm text-muted-foreground">Cargando productos…</p>
                  ) : catalogError ? (
                    <p role="alert" className="p-3 text-sm text-destructive">
                      {catalogError}
                    </p>
                  ) : !catalog.length ? (
                    <p className="p-3 text-sm text-muted-foreground">
                      {inventoryId
                        ? "No se encontraron productos."
                        : "Selecciona un almacén para ver sus productos."}
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
                {hasMoreCatalog && !catalogLoading && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setCatalogPage((page) => page + 1)}
                  >
                    Cargar más productos
                  </Button>
                )}
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
                              <div className="mt-2 flex flex-wrap items-center gap-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  disabled={!inventoryId}
                                  onClick={() => startMapping(line)}
                                >
                                  <Link2 className="mr-1 h-3.5 w-3.5" />
                                  Vincular con catálogo
                                </Button>
                                <a
                                  href="/productos"
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={() => startMapping(line)}
                                  className="inline-flex items-center gap-1 text-xs font-medium text-teal-700 underline"
                                >
                                  <ExternalLink className="h-3.5 w-3.5" />
                                  Crear producto en otra pestaña
                                </a>
                              </div>
                              {mappingLineId === line.id && (
                                <div className="mt-2 space-y-2 rounded-lg bg-muted/50 p-2 text-xs">
                                  <p>
                                    Crea el producto con sus variantes y stock en{" "}
                                    {inventories.find((inventory) => inventory.id === inventoryId)
                                      ?.name || "el almacén seleccionado"}
                                    . Vuelve a esta pestaña y busca el SKU creado. Esta cotización
                                    conserva sus datos mientras trabajas en la otra pestaña.
                                  </p>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      setCatalogPage(1);
                                      setQuery(line.productName);
                                      setCatalogVersion((version) => version + 1);
                                      searchInput.current?.focus();
                                    }}
                                  >
                                    <RefreshCw className="mr-1 h-3.5 w-3.5" />
                                    Ya creé el producto: actualizar catálogo
                                  </Button>
                                </div>
                              )}
                              <div className="mt-2 space-y-1">
                                <Label htmlFor={`photo-${line.id}`} className="text-xs">
                                  Foto del producto (opcional)
                                </Label>
                                <Input
                                  id={`photo-${line.id}`}
                                  type="file"
                                  accept="image/jpeg,image/png,image/webp"
                                  disabled={!!uploadingLineId}
                                  onChange={(event) =>
                                    void uploadLinePhoto(line.id, event.target.files?.[0])
                                  }
                                />
                                {uploadingLineId === line.id && (
                                  <p role="status" className="text-xs">
                                    Subiendo foto…
                                  </p>
                                )}
                              </div>
                            </>
                          )}
                          {line.imageUrl && (
                            <div className="mt-2 flex items-center gap-2">
                              {/* Uploaded image URLs are validated by the quotation API. */}
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={line.imageUrl}
                                alt={`Foto de ${line.productName || "producto"}`}
                                className="h-14 w-14 rounded-md border object-cover"
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  setCart((previous) =>
                                    previous.map((item) =>
                                      item.id === line.id ? { ...item, imageUrl: null } : item,
                                    ),
                                  )
                                }
                              >
                                Quitar foto
                              </Button>
                            </div>
                          )}
                          {(line.packId ||
                            quotation?.lines.find((original) => original.id === line.id)
                              ?.isPack) && (
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
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground"
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
                  Otro producto
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
                bundleQtyInCart={engine.bundleQtyInCart}
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
                onAutoAddBundleItem={(item) => void autoAddBundle(item)}
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
                    const affectedIds = new Set(
                      cart.filter((line) => line.packId === id).map((line) => line.id),
                    );
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
              disabled={saving || !!uploadingLineId || inventoryLoading}
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
