"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Info, Loader2, Plus, Search, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { warehouseErrorMessage } from "@/components/forms/warehouseUi";
import {
  addFormLines,
  buildOrderBody,
  emptyOrderForm,
  formatDay,
  formatMoney,
  formFromOrder,
  IGV_RATE,
  orderFormProblem,
  PAYMENT_TERMS_LABEL,
  parseOrderLine,
  previewForm,
  RECEIPT_TYPES,
  roundTo,
  type OrderForm,
  type OrderFormLine,
} from "@/lib/purchaseOrders";
import { formatVariantLabel } from "@/lib/variantAttributes";
import {
  createPurchaseOrder,
  getVariantCosts,
  listProductVariants,
  listPurchasableProducts,
  listPurchaseSuppliers,
  placePurchaseOrder,
  updatePurchaseOrder,
  type PurchasableProduct,
  type PurchaseOrder,
} from "@/services/purchasesService";
import { getSupplierPrices, type SupplierPrice } from "@/services/suggestedPurchaseService";
import { getInventoryRules, listWarehouses } from "@/services/warehousesService";
import { useMyWarehouses } from "@/hooks/useMyWarehouses";
import { Money, SELECT_CLASS } from "./PurchaseBits";

// FEAT-24 H3-E — nueva orden de compra o edición de un BORRADOR (mockup mOC).
// Se elige el producto y entran sus variantes activas, cada una con la unidad
// de compra del producto (caja × 12) que se puede cambiar. Los montos de abajo
// son una vista previa: el servidor los calcula al guardar.
// FEAT-24 H13-D4: con el proveedor elegido, el precio inicial de cada variante es
// el último costo que se le pagó a ESE proveedor (si no hay, el costo promedio).
// Es solo un valor inicial: un precio que el usuario escribió no se toca.

const MAX_PRODUCT_MATCHES = 30;

/** Se guardó (creó o editó) pero no se pudo emitir: el reintento edita esa misma OC. */
class NotEmittedError extends Error {
  constructor(
    readonly order: PurchaseOrder,
    readonly failure: unknown,
  ) {
    super("No se pudo emitir la orden de compra");
  }
}

interface Props {
  companyId: string;
  /** BORRADOR a editar; sin esto, es una OC nueva. */
  order?: PurchaseOrder | null;
  /** Rol con costos: sugiere el precio desde el costo promedio. */
  canSeeCosts: boolean;
  onClose: () => void;
  onSaved: (order: PurchaseOrder) => void;
}

const fold = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

export default function PurchaseOrderFormDialog({ companyId, order, canSeeCosts, onClose, onSaved }: Props) {
  const [form, setForm] = useState<OrderForm>(() => (order ? formFromOrder(order) : emptyOrderForm()));
  /** Id de la OC ya guardada (si «Emitir» guardó pero no pudo emitir, el próximo intento no crea otra). */
  const [savedId, setSavedId] = useState<string | null>(order?.id ?? null);
  const [productQuery, setProductQuery] = useState("");
  const [productId, setProductId] = useState("");
  const [adding, setAdding] = useState(false);
  const [addInfo, setAddInfo] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  // Variantes con precio escrito a mano (o guardado en el borrador): la sugerencia no las pisa.
  const typedPrices = useRef<Set<string>>(new Set(order?.lines.map((line) => line.variantId) ?? []));
  // Costo promedio por unidad de stock de cada variante agregada (la sugerencia de respaldo).
  const averageCosts = useRef<Map<string, number>>(new Map());
  // FEAT-24 H6: la OC llega solo a un almacén que el usuario opera (el borrador conserva el suyo).
  const myWarehouses = useMyWarehouses();

  const suppliersQuery = useQuery({
    queryKey: ["purchase-suppliers", companyId, "active"],
    queryFn: ({ signal }) => listPurchaseSuppliers(false, signal),
    enabled: !!companyId,
  });
  const warehousesQuery = useQuery({
    queryKey: ["company-warehouses", companyId],
    queryFn: () => listWarehouses(),
    enabled: !!companyId,
  });
  const rulesQuery = useQuery({
    queryKey: ["inventory-rules", companyId],
    queryFn: () => getInventoryRules(),
    enabled: !!companyId,
    retry: false,
  });
  const productsQuery = useQuery({
    queryKey: ["purchasable-products", companyId],
    queryFn: ({ signal }) => listPurchasableProducts(companyId, signal),
    enabled: !!companyId,
    staleTime: 60_000,
  });

  const supplierPricesQuery = useQuery({
    queryKey: ["supplier-prices", companyId, "supplier", form.supplierId],
    queryFn: ({ signal }) => getSupplierPrices({ supplierId: form.supplierId }, signal),
    enabled: !!companyId && canSeeCosts && !!form.supplierId,
    retry: false,
    staleTime: 60_000,
  });

  const igvAffected = rulesQuery.data?.igvAffected ?? true;
  const allowCourier = rulesQuery.data?.allowPurchaseToCourier ?? false;
  const suppliers = useMemo(() => {
    const list = suppliersQuery.data ?? [];
    // Un borrador con un proveedor ya desactivado lo sigue mostrando, para no perderlo al editar.
    if (order?.supplierId && !list.some((supplier) => supplier.id === order.supplierId))
      return [...list, { id: order.supplierId, name: `${order.supplierName ?? "Proveedor"} (inactivo)`, ruc: null, paymentTerms: "contado" as const }];
    return list;
  }, [suppliersQuery.data, order]);
  const warehouses = useMemo(
    () =>
      (warehousesQuery.data?.warehouses ?? []).filter(
        (warehouse) =>
          (warehouse.status || warehouse.id === order?.inventoryId) &&
          (warehouse.type !== "COURIER" || allowCourier || warehouse.id === order?.inventoryId) &&
          (myWarehouses.canOperate(warehouse.id) || warehouse.id === order?.inventoryId),
      ),
    [warehousesQuery.data, allowCourier, order, myWarehouses],
  );
  const products = useMemo(() => (productsQuery.data ?? []).filter((product) => product.status), [productsQuery.data]);
  const matches = useMemo(() => {
    const query = fold(productQuery.trim());
    if (!query) return products.slice(0, MAX_PRODUCT_MATCHES);
    return products
      .filter((product) => [product.name, product.sku, product.companySku ?? ""].some((value) => fold(value).includes(query)))
      .slice(0, MAX_PRODUCT_MATCHES);
  }, [products, productQuery]);

  // Último costo (sin IGV, por unidad de stock) de cada variante con el proveedor elegido.
  const supplierCosts = useMemo(() => {
    const byVariant = new Map<string, SupplierPrice>();
    for (const price of supplierPricesQuery.data?.items ?? [])
      if (price.supplierId === form.supplierId && typeof price.lastUnitCost === "number") byVariant.set(price.variantId, price);
    return byVariant;
  }, [supplierPricesQuery.data, form.supplierId]);
  const igvFactor = igvAffected && form.pricesIncludeIgv ? 1 + IGV_RATE : 1;
  const linesKey = form.lines.map((line) => `${line.variantId}:${line.purchaseFactor}`).join("|");
  useEffect(() => {
    // Precio sugerido de las líneas que el usuario no tocó: último costo con este proveedor, si no el promedio.
    setForm((current) => {
      let changed = false;
      const lines = current.lines.map((line) => {
        if (typedPrices.current.has(line.variantId)) return line;
        const cost = supplierCosts.get(line.variantId)?.lastUnitCost ?? averageCosts.current.get(line.variantId) ?? null;
        const factor = Number(line.purchaseFactor);
        if (cost === null || !Number.isInteger(factor) || factor < 1) return line;
        const unitPrice = String(roundTo(cost * factor * igvFactor, 4));
        if (unitPrice === line.unitPrice) return line;
        changed = true;
        return { ...line, unitPrice };
      });
      return changed ? { ...current, lines } : current;
    });
  }, [supplierCosts, linesKey, igvFactor]);

  const preview = previewForm(form, igvAffected);
  const problem = orderFormProblem(form);
  const supplier = suppliers.find((candidate) => candidate.id === form.supplierId);

  const change = (patch: Partial<OrderForm>) => {
    setServerError(null);
    setForm((current) => ({ ...current, ...patch }));
  };
  const changeLine = (variantId: string, patch: Partial<OrderFormLine>) => {
    setServerError(null);
    setForm((current) => ({
      ...current,
      lines: current.lines.map((line) => (line.variantId === variantId ? { ...line, ...patch } : line)),
    }));
  };
  const removeLine = (variantId: string) => {
    typedPrices.current.delete(variantId);
    setForm((current) => ({ ...current, lines: current.lines.filter((line) => line.variantId !== variantId) }));
  };

  const addProduct = async (product: PurchasableProduct) => {
    setAdding(true);
    setAddInfo(null);
    try {
      const variants = (await listProductVariants(product.id)).filter((variant) => variant.isActive && !variant.mergedInto);
      if (variants.length === 0) {
        setAddInfo(`${product.name} no tiene variantes activas para comprar.`);
        return;
      }
      // Precio sugerido = costo promedio × factor (solo a quien ve costos; si falla, queda en 0).
      const costs = new Map<string, number>();
      if (canSeeCosts) {
        try {
          for (const cost of await getVariantCosts(variants.map((variant) => variant.id)))
            if (cost.averageCost !== null) costs.set(cost.variantId, cost.averageCost);
        } catch {
          // sin sugerencia
        }
      }
      for (const [variantId, cost] of costs) averageCosts.current.set(variantId, cost);
      const lines: OrderFormLine[] = variants.map((variant) => {
        const attributes = formatVariantLabel(variant.attributeValues);
        const cost = costs.get(variant.id);
        return {
          variantId: variant.id,
          label: [product.name, attributes].filter(Boolean).join(" · "),
          sku: variant.companySku || variant.sku,
          purchaseUnit: product.purchaseUnit ?? "",
          purchaseFactor: String(product.purchaseFactor || 1),
          purchaseQuantity: "1",
          unitPrice: cost !== undefined ? String(roundTo(cost * (product.purchaseFactor || 1), 4)) : "0",
        };
      });
      const { added } = addFormLines(form, lines);
      setForm((current) => addFormLines(current, lines).form);
      setAddInfo(
        added === 0
          ? `Las variantes de ${product.name} ya están en la compra.`
          : `${added === 1 ? "Se agregó 1 variante" : `Se agregaron ${added} variantes`} de ${product.name}.`,
      );
      setProductId("");
    } catch (error) {
      setAddInfo(warehouseErrorMessage(error, "No se pudieron traer las variantes. Inténtalo de nuevo."));
    } finally {
      setAdding(false);
    }
  };

  const save = useMutation({
    mutationFn: async (emit: boolean) => {
      const body = buildOrderBody(form);
      const saved = savedId ? await updatePurchaseOrder(savedId, body) : await createPurchaseOrder(body);
      setSavedId(saved.id);
      if (!emit) return { saved, emit };
      try {
        return { saved: await placePurchaseOrder(saved.id), emit };
      } catch (cause) {
        throw new NotEmittedError(saved, cause);
      }
    },
    onSuccess: ({ saved, emit }) => {
      toast.success(emit ? `${saved.number} emitida` : `${saved.number} guardada como borrador`, {
        description: emit ? "Aparece para recibir cuando llegue la mercadería." : undefined,
      });
      onSaved(saved);
    },
    onError: (error) => {
      if (error instanceof NotEmittedError) {
        setServerError(
          `${error.order.number} quedó guardada como borrador, pero no se pudo emitir: ${warehouseErrorMessage(error.failure, "inténtalo de nuevo.")}`,
        );
        return;
      }
      setServerError(warehouseErrorMessage(error, "No se pudo guardar la compra. Inténtalo de nuevo."));
    },
  });
  const busy = save.isPending;
  const submit = (emit: boolean) => {
    setTouched(true);
    if (problem) return;
    save.mutate(emit);
  };

  const loadError = suppliersQuery.error ?? warehousesQuery.error ?? productsQuery.error;
  const title = order ? `Editar ${order.number}` : "Nueva compra";

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Se guarda como borrador hasta emitirla. El stock entra recién al recibir.</DialogDescription>
        </DialogHeader>

        {loadError ? (
          <div role="alert" className="rounded-md border border-destructive/50 bg-destructive/5 p-3 text-sm text-destructive">
            {warehouseErrorMessage(loadError, "No se pudieron cargar los proveedores, almacenes o productos.")}
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-1">
            <Label htmlFor="oc-supplier">Proveedor</Label>
            <select
              id="oc-supplier"
              className={SELECT_CLASS}
              value={form.supplierId}
              disabled={busy}
              onChange={(e) => change({ supplierId: e.target.value })}
            >
              <option value="">{suppliersQuery.isLoading ? "Cargando…" : "Elige el proveedor"}</option>
              {suppliers.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              {supplier
                ? [supplier.ruc ? `RUC ${supplier.ruc}` : "Sin RUC", PAYMENT_TERMS_LABEL[supplier.paymentTerms]].join(" · ")
                : suppliersQuery.data && suppliersQuery.data.length === 0
                  ? "No tienes proveedores activos: créalos en la pestaña Proveedores."
                  : " "}
            </p>
          </div>

          <div className="space-y-1">
            <Label htmlFor="oc-warehouse">Llega a</Label>
            <select
              id="oc-warehouse"
              className={SELECT_CLASS}
              value={form.inventoryId}
              disabled={busy}
              onChange={(e) => change({ inventoryId: e.target.value })}
            >
              <option value="">{warehousesQuery.isLoading ? "Cargando…" : "Elige el almacén"}</option>
              {warehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.name}
                  {warehouse.type === "COURIER" ? " · directo a courier" : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="oc-date">Fecha de compra</Label>
            <Input id="oc-date" type="date" value={form.purchaseDate} disabled={busy} onChange={(e) => change({ purchaseDate: e.target.value })} />
          </div>

          <div className="space-y-1">
            <Label htmlFor="oc-receipt-type">Comprobante</Label>
            <select
              id="oc-receipt-type"
              className={SELECT_CLASS}
              value={form.receiptType}
              disabled={busy}
              onChange={(e) => change({ receiptType: e.target.value })}
            >
              {RECEIPT_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="oc-document">Serie y número</Label>
            <Input
              id="oc-document"
              className="font-mono"
              placeholder="F001-000000"
              maxLength={100}
              value={form.document}
              disabled={busy}
              onChange={(e) => change({ document: e.target.value })}
            />
          </div>

          <div className="space-y-1">
            <span className="text-sm font-medium">Precios</span>
            <div className="flex h-9 items-center gap-3">
              <Switch
                id="oc-includes-igv"
                checked={igvAffected && form.pricesIncludeIgv}
                disabled={busy || !igvAffected}
                onCheckedChange={(pricesIncludeIgv) => change({ pricesIncludeIgv })}
              />
              <Label htmlFor="oc-includes-igv" className="font-normal">
                Incluyen IGV
              </Label>
            </div>
            <p className="text-xs text-muted-foreground">
              {igvAffected
                ? "El costo se guarda sin IGV."
                : "Tu empresa no está afecta al IGV: no se separa y el costo es lo que pagas."}
            </p>
          </div>
        </div>

        <div className="space-y-2 rounded-md border p-3">
          <Label htmlFor="oc-product-search">Agregar producto</Label>
          <div className="flex flex-col gap-2 md:flex-row">
            <div className="relative md:w-72">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <Input
                id="oc-product-search"
                className="pl-8"
                placeholder="Busca por nombre o SKU"
                value={productQuery}
                disabled={busy}
                onChange={(e) => {
                  setProductQuery(e.target.value);
                  setProductId("");
                }}
              />
            </div>
            <select
              aria-label="Producto"
              className={`${SELECT_CLASS} md:flex-1`}
              value={productId}
              disabled={busy || adding}
              onChange={(e) => setProductId(e.target.value)}
            >
              <option value="">{productsQuery.isLoading ? "Cargando productos…" : `Elige un producto (${matches.length})`}</option>
              {matches.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                  {product.companySku || product.sku ? ` · ${product.companySku || product.sku}` : ""}
                  {product.purchaseUnit && product.purchaseFactor > 1 ? ` · ${product.purchaseUnit} × ${product.purchaseFactor}` : ""}
                </option>
              ))}
            </select>
            <Button
              type="button"
              variant="outline"
              disabled={!productId || adding || busy}
              onClick={() => {
                const product = products.find((candidate) => candidate.id === productId);
                if (product) void addProduct(product);
              }}
            >
              {adding ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              Agregar producto con sus variantes
            </Button>
          </div>
          {addInfo ? (
            <p role="status" className="text-xs text-muted-foreground">
              {addInfo}
            </p>
          ) : null}
        </div>

        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground">
              <tr>
                <th className="p-2 text-left">Variante</th>
                <th className="p-2 text-left">Unidad de compra</th>
                <th className="p-2 text-right">Factor</th>
                <th className="p-2 text-right">Cantidad</th>
                <th className="p-2 text-right">Unidades</th>
                <th className="p-2 text-right">Precio por unidad de compra</th>
                <th className="p-2 text-right">Costo final unit.</th>
                <th className="p-2 text-right">Subtotal sin IGV</th>
                <th className="p-2" />
              </tr>
            </thead>
            <tbody>
              {form.lines.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-6 text-center text-muted-foreground">
                    Agrega productos.
                  </td>
                </tr>
              ) : (
                form.lines.map((line, index) => {
                  const lineProblem = parseOrderLine(line).problem;
                  const previewLine = preview.lines[index];
                  const lastPrice = supplierCosts.get(line.variantId);
                  return (
                    <tr key={line.variantId} className="border-t align-top">
                      <td className="p-2">
                        <div className="font-medium">{line.label}</div>
                        <div className="font-mono text-xs text-muted-foreground">{line.sku}</div>
                        {touched && lineProblem ? <p className="text-xs text-destructive">{lineProblem}</p> : null}
                      </td>
                      <td className="p-2">
                        <Input
                          aria-label={`Unidad de compra: ${line.label}`}
                          className="w-28"
                          placeholder="Unidad"
                          maxLength={30}
                          value={line.purchaseUnit}
                          disabled={busy}
                          onChange={(e) => changeLine(line.variantId, { purchaseUnit: e.target.value })}
                        />
                      </td>
                      <td className="p-2 text-right">
                        <Input
                          aria-label={`Factor: ${line.label}`}
                          className="ml-auto w-20 text-right"
                          inputMode="numeric"
                          value={line.purchaseFactor}
                          disabled={busy}
                          onChange={(e) => changeLine(line.variantId, { purchaseFactor: e.target.value })}
                        />
                      </td>
                      <td className="p-2 text-right">
                        <Input
                          aria-label={`Cantidad: ${line.label}`}
                          className="ml-auto w-20 text-right"
                          inputMode="numeric"
                          value={line.purchaseQuantity}
                          disabled={busy}
                          onChange={(e) => changeLine(line.variantId, { purchaseQuantity: e.target.value })}
                        />
                      </td>
                      <td className="p-2 text-right tabular-nums" data-testid={`units-${line.variantId}`}>
                        {previewLine?.quantity ?? 0}
                      </td>
                      <td className="p-2 text-right">
                        <Input
                          aria-label={`Precio: ${line.label}`}
                          className="ml-auto w-28 text-right"
                          inputMode="decimal"
                          value={line.unitPrice}
                          disabled={busy}
                          onChange={(e) => {
                            typedPrices.current.add(line.variantId);
                            changeLine(line.variantId, { unitPrice: e.target.value });
                          }}
                        />
                        {lastPrice ? (
                          <p
                            className="mt-1 whitespace-nowrap text-xs text-muted-foreground"
                            data-testid={`last-price-${line.variantId}`}
                            title="Último costo pagado a este proveedor, sin IGV, por unidad de stock"
                          >
                            Último: {formatMoney(lastPrice.lastUnitCost, 4)} c/u · {formatDay(lastPrice.lastDate)}
                          </p>
                        ) : null}
                      </td>
                      <td className="p-2 text-right" data-testid={`entry-cost-${line.variantId}`}>
                        <Money value={previewLine?.entryCost ?? 0} decimals={4} />
                      </td>
                      <td className="p-2 text-right">
                        <Money value={roundTo(previewLine?.lineNet ?? 0, 2)} />
                      </td>
                      <td className="p-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={`Quitar ${line.label}`}
                          disabled={busy}
                          onClick={() => removeLine(line.variantId)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="oc-expenses">Gastos de la compra (flete, estiba…)</Label>
              <Input
                id="oc-expenses"
                inputMode="decimal"
                value={form.expenses}
                disabled={busy}
                onChange={(e) => change({ expenses: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">Se reparten en el costo de cada producto según su valor; no suman al total.</p>
            </div>
            <div className="space-y-1">
              <Label htmlFor="oc-notes">Notas</Label>
              <Textarea id="oc-notes" maxLength={1000} value={form.notes} disabled={busy} onChange={(e) => change({ notes: e.target.value })} />
            </div>
          </div>

          <dl className="space-y-2 rounded-md border bg-muted/30 p-4 text-sm" aria-label="Resumen de la compra">
            <div className="flex justify-between">
              <dt>Unidades</dt>
              <dd className="font-semibold tabular-nums">{preview.units}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Subtotal sin IGV</dt>
              <dd data-testid="oc-subtotal">
                <Money value={preview.subtotal} />
              </dd>
            </div>
            <div className="flex justify-between">
              <dt>{igvAffected ? "IGV 18 %" : "IGV (no afecta)"}</dt>
              <dd data-testid="oc-igv">
                <Money value={preview.igvAmount} />
              </dd>
            </div>
            <div className="flex justify-between border-t pt-2 text-base">
              <dt className="font-semibold">Total a pagar</dt>
              <dd className="font-semibold" data-testid="oc-total">
                <Money value={preview.total} />
              </dd>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <dt>Gastos (van al costo)</dt>
              <dd>
                <Money value={preview.expenses} />
              </dd>
            </div>
            <p className="flex gap-1 pt-1 text-xs text-muted-foreground">
              <Info className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              Vista previa: los montos definitivos los calcula el sistema al guardar.
            </p>
          </dl>
        </div>

        {touched && problem ? (
          <p role="alert" className="text-sm text-destructive">
            {problem}
          </p>
        ) : null}
        {serverError ? (
          <div role="alert" className="rounded-md border border-destructive/50 bg-destructive/5 p-3 text-sm text-destructive">
            {serverError}
          </div>
        ) : null}

        <DialogFooter>
          <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
            Cancelar
          </Button>
          <Button type="button" variant="secondary" disabled={busy} onClick={() => submit(false)}>
            Guardar borrador
          </Button>
          <Button type="button" disabled={busy} onClick={() => submit(true)}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Emitir orden
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
