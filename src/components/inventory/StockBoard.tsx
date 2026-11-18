"use client";

import { Fragment, useState } from "react";
import Image from "next/image";
import { Camera, ChevronDown, ChevronRight, History, PackagePlus, Pencil, ShoppingBag, Warehouse } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatMoney } from "@/lib/money";
import { formatVariantLabel } from "@/lib/variantAttributes";
import { isTracked } from "@/services/inventoryTrackingService";
import type { BusinessInventoryItem } from "@/services/businessInventoryItemsService";
import type { BusinessInventory } from "@/services/inventoryCatalogService";
import { STOCK_STATUS_LABEL, type StockProductGroup, type StockStatus, type StockTotals, type StockVariantRow } from "./stockView";

/** Datos de la pantalla de almacenes de la empresa; pueden faltar (la pantalla funciona igual). */
export type WarehouseMeta = Map<string, { type: "PROPIO" | "TIENDA" | "COURIER"; isMain: boolean }>;
const TYPE_LABEL = { PROPIO: "Propio", TIENDA: "Tienda física", COURIER: "Courier" } as const;
const NO_META: WarehouseMeta = new Map();

export type StockTrackingAction = "regularize" | "units" | "transfer" | "write-off";

export interface StockBoardActions {
  canEdit: boolean;
  onImage: (item: BusinessInventoryItem, trigger: HTMLButtonElement) => void;
  onTracking: (item: BusinessInventoryItem, action: StockTrackingAction) => void;
  onAdjust: (item: BusinessInventoryItem) => void;
  onEdit: (variantId: string) => void;
  /** FEAT-24 H10: abre Movimientos filtrado por la variante (`label` = su nombre y SKU). */
  onKardex: (variantId: string, label: string) => void;
}

const STATUS_CLASS: Record<StockStatus, string> = {
  agotado: "border-destructive/40 bg-destructive/10 text-destructive",
  bajo: "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-400",
  normal: "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400",
};

const reservedOf = (row: BusinessInventoryItem) => Number(row.reservedStock ?? 0) || 0;
const availableClass = (available: number) => (available <= 0 ? "text-destructive font-semibold" : "font-semibold");

/** Indicadores de la cabecera (mockup: Físico, Reservado, Disponible; el resto llega con sus hitos). */
export function StockKpis({ totals, variantCount }: { totals: StockTotals; variantCount: number }) {
  const kpis = [
    { label: "Físico", value: totals.physical, hint: "Unidades en estantes" },
    { label: "Reservado", value: totals.reserved, hint: "Ventas confirmadas sin despachar" },
    { label: "Disponible", value: totals.available, hint: "Físico − reservado · se publica en canales" },
  ];
  return (
    <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3" aria-label={`Totales de ${variantCount} variantes`}>
      {kpis.map((kpi) => (
        <div key={kpi.label} className="rounded-lg border bg-card p-4" data-testid={`kpi-${kpi.label.toLowerCase()}`}>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{kpi.label}</p>
          <p className="text-2xl font-semibold tabular-nums">{kpi.value.toLocaleString("es-PE")}</p>
          <p className="text-xs text-muted-foreground">{kpi.hint}</p>
        </div>
      ))}
    </div>
  );
}

function StatusBadge({ status }: { status: StockStatus }) {
  return <span className={`inline-block whitespace-nowrap rounded border px-2 py-0.5 text-xs font-medium ${STATUS_CLASS[status]}`}>{STOCK_STATUS_LABEL[status]}</span>;
}

function InactiveBadge({ item }: { item: BusinessInventoryItem }) {
  if (item.isActive !== false) return null;
  return <span className="ml-2 rounded border px-1.5 py-0.5 text-xs text-muted-foreground">{item.mergedInto ? "Unificada" : "Inactiva"}</span>;
}

/** Acciones de UNA posición (variante en un almacén): son las mismas que tenía la tabla anterior. */
function PositionActions({ item, actions }: { item: BusinessInventoryItem; actions: StockBoardActions }) {
  const { canEdit, onTracking, onAdjust } = actions;
  const tracked = isTracked(item.trackingMode);
  return (
    <>
      {(canEdit || tracked) && (
        <Button size="sm" variant="outline" disabled={!item.productId} onClick={() => onTracking(item, tracked ? "units" : "regularize")}>
          {tracked ? "Ver unidades" : "Asociar IMEI/series"}
        </Button>
      )}
      {canEdit && tracked ? <>
        <Button size="sm" variant="outline" onClick={() => onTracking(item, "transfer")}>Transferir unidades</Button>
        <Button size="sm" variant="outline" onClick={() => onTracking(item, "write-off")}>Registrar merma</Button>
        <Button size="sm" variant="ghost" disabled={!item.productId} onClick={() => onTracking(item, "regularize")}>Revisar activación</Button>
      </> : null}
      {!canEdit || tracked || item.mergedInto ? null : (
        <Button size="icon" variant="ghost" className="h-8 w-8 text-teal-600 hover:text-teal-700 hover:bg-teal-50" title="Ajustar stock" onClick={() => onAdjust(item)}>
          <PackagePlus className="h-4 w-4" />
        </Button>
      )}
    </>
  );
}

function Thumb({ item, actions }: { item: BusinessInventoryItem; actions: StockBoardActions }) {
  return (
    <button
      type="button"
      className="group relative block shrink-0 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      aria-label={`Cambiar imagen de ${item.productName}`}
      title="Cambiar imagen"
      onClick={(event) => { event.stopPropagation(); actions.onImage(item, event.currentTarget); }}
    >
      {item.imageUrl ? (
        <Image src={item.imageUrl} alt={item.productName || "Producto"} width={44} height={44} className="h-11 w-11 rounded-md border object-cover" />
      ) : (
        <div className="flex h-11 w-11 items-center justify-center rounded-md bg-muted text-muted-foreground"><ShoppingBag className="h-5 w-5" /></div>
      )}
      <span className="absolute -bottom-1 -right-1 rounded-full border bg-background p-0.5 text-muted-foreground group-hover:text-primary">
        <Camera className="h-3 w-3" aria-hidden="true" />
      </span>
    </button>
  );
}

function SkuText({ item }: { item: BusinessInventoryItem }) {
  return item.companySku
    ? <span title={`${item.companySku} (POWIP: ${item.sku})`}><span className="font-semibold">{item.companySku}</span> <span className="text-[10px]">{item.sku}</span></span>
    : <span>{item.sku}</span>;
}

function VariantDetail({ variant, actions, colSpan }: { variant: StockVariantRow; actions: StockBoardActions; colSpan: number }) {
  const { first } = variant;
  return (
    <TableRow className="bg-muted/20 hover:bg-muted/20">
      <TableCell colSpan={colSpan} className="py-3">
        <div className="flex flex-wrap items-start gap-x-10 gap-y-3 text-sm">
          <div>
            <p className="text-xs font-medium uppercase text-muted-foreground">Códigos</p>
            <p className="font-mono text-xs">SKU {first.sku}</p>
            {first.companySku ? <p className="font-mono text-xs">SKU empresa {first.companySku}</p> : null}
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-muted-foreground">Variante</p>
            <p>Mínimo {variant.minStock}</p>
            <p>Precio venta {formatMoney(first.priceVta)}</p>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase text-muted-foreground">Por almacén</p>
            <ul className="space-y-1">
              {variant.positions.map((item) => (
                <li key={item.inventoryItemId} className="flex flex-wrap items-center gap-2">
                  <span className="min-w-[180px]">{item.storeName || "Tienda"} · {item.inventoryName}<InactiveBadge item={item} /></span>
                  <span className="tabular-nums text-muted-foreground">{item.physicalStock} fís · {reservedOf(item)} res · <b className={item.availableStock <= 0 ? "text-destructive" : "text-foreground"}>{item.availableStock}</b> disp</span>
                  {variant.positions.length > 1 ? <span className="space-x-1"><PositionActions item={item} actions={actions} /></span> : null}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </TableCell>
    </TableRow>
  );
}

interface ProductViewProps {
  groups: StockProductGroup[];
  inventories: BusinessInventory[];
  isLoading: boolean;
  emptyText: string;
  actions: StockBoardActions;
  meta?: WarehouseMeta;
}

/** Vista «Por producto»: filas por variante agrupadas por producto, una columna por almacén. */
export function StockByProduct({ groups, inventories, isLoading, emptyText, actions, meta = NO_META }: ProductViewProps) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const cols = inventories.length + 4;
  return (
    <div className="flex-1 overflow-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="min-w-[260px]">Producto / variante</TableHead>
            {inventories.map((inv) => (
              <TableHead key={inv.id} className="text-center">
                {inv.name}
                {meta.get(inv.id) || inv.storeName ? (
                  <div className="text-[11px] font-normal text-muted-foreground">
                    {[meta.get(inv.id) ? TYPE_LABEL[meta.get(inv.id)!.type] : null, inv.storeName].filter(Boolean).join(" · ")}
                  </div>
                ) : null}
              </TableHead>
            ))}
            <TableHead className="text-right">Disponible total</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            [...Array(5)].map((_, i) => (
              <TableRow key={i}>
                <TableCell><Skeleton className="h-11 w-56" /></TableCell>
                {inventories.map((inv) => <TableCell key={inv.id}><Skeleton className="mx-auto h-4 w-12" /></TableCell>)}
                <TableCell><Skeleton className="ml-auto h-4 w-12" /></TableCell>
                <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                <TableCell><Skeleton className="ml-auto h-4 w-24" /></TableCell>
              </TableRow>
            ))
          ) : groups.length === 0 ? (
            <TableRow><TableCell colSpan={cols} className="py-6 text-center text-muted-foreground">{emptyText}</TableCell></TableRow>
          ) : groups.map((group) => (
            <Fragment key={group.key}>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableCell colSpan={cols} className="py-2 text-xs font-semibold tracking-wide">
                  <span className="uppercase">{group.productName}</span>
                </TableCell>
              </TableRow>
              {group.variants.map((variant) => {
                const { first } = variant;
                const single = variant.positions.length === 1 ? first : null;
                const isOpen = Boolean(open[variant.variantId]);
                const label = formatVariantLabel(first.attributes);
                return (
                  <Fragment key={variant.variantId}>
                    <TableRow className="cursor-pointer transition-colors hover:bg-muted/30" onClick={() => setOpen((state) => ({ ...state, [variant.variantId]: !isOpen }))}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <button type="button" className="text-muted-foreground" aria-expanded={isOpen} aria-label={`${isOpen ? "Ocultar" : "Ver"} detalle de ${first.productName} ${label}`.trim()}
                            onClick={(event) => { event.stopPropagation(); setOpen((state) => ({ ...state, [variant.variantId]: !isOpen })); }}>
                            {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </button>
                          <Thumb item={first} actions={actions} />
                          <div className="min-w-0">
                            <div className="text-sm font-medium">{label || "Única"}{single ? <InactiveBadge item={single} /> : null}</div>
                            <div className="font-mono text-xs text-muted-foreground"><SkuText item={first} /></div>
                          </div>
                        </div>
                      </TableCell>
                      {inventories.map((inv) => {
                        const item = variant.byInventory.get(inv.id);
                        return item ? (
                          <TableCell key={inv.id} className="text-center">
                            <div className={`tabular-nums ${availableClass(item.availableStock)}`}>{item.availableStock}</div>
                            <div className="whitespace-nowrap text-[11px] text-muted-foreground">{item.physicalStock} fís · {reservedOf(item)} res</div>
                          </TableCell>
                        ) : <TableCell key={inv.id} className="text-center text-muted-foreground">—</TableCell>;
                      })}
                      <TableCell className={`text-right tabular-nums ${availableClass(variant.available)}`}>{variant.available}</TableCell>
                      <TableCell><StatusBadge status={variant.status} /></TableCell>
                      <TableCell className="space-x-1 whitespace-nowrap text-right" onClick={(event) => event.stopPropagation()}>
                        {single ? <PositionActions item={single} actions={actions} /> : (
                          <Button size="sm" variant="outline" onClick={() => setOpen((state) => ({ ...state, [variant.variantId]: true }))}>
                            {variant.positions.length} almacenes
                          </Button>
                        )}
                        <Button size="icon" variant="ghost" className="h-8 w-8" title="Ver movimientos" onClick={() => actions.onKardex(variant.variantId, `${[first.productName, label].filter(Boolean).join(" · ")}${first.sku ? ` (${first.sku})` : ""}`)}>
                          <History className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8" title="Editar Producto" onClick={() => actions.onEdit(variant.variantId)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                    {isOpen ? <VariantDetail variant={variant} actions={actions} colSpan={cols} /> : null}
                  </Fragment>
                );
              })}
            </Fragment>
          ))}
        </TableBody>
      </Table>
      {!isLoading && groups.length > 0 ? (
        <p className="border-t px-4 py-2 text-xs text-muted-foreground">
          Toca una fila para ver códigos, mínimo, precio y el detalle por almacén. Cada celda muestra el <b>disponible</b> y debajo físico y reservado.
        </p>
      ) : null}
    </div>
  );
}

interface WarehouseViewProps {
  variants: StockVariantRow[];
  inventories: BusinessInventory[];
  isLoading: boolean;
  meta?: WarehouseMeta;
}

/** Vista «Por almacén»: una tarjeta por almacén con sus posiciones. */
export function StockByWarehouse({ variants, inventories, isLoading, meta = NO_META }: WarehouseViewProps) {
  if (isLoading) return <div className="space-y-3"><Skeleton className="h-32 w-full" /><Skeleton className="h-32 w-full" /></div>;
  if (inventories.length === 0) return <p className="rounded-md border py-6 text-center text-muted-foreground">No hay almacenes en este alcance</p>;
  return (
    <div className="flex-1 space-y-4 overflow-auto">
      {inventories.map((inv) => {
        const rows = variants.flatMap((variant) => { const item = variant.byInventory.get(inv.id); return item ? [item] : []; });
        const physical = rows.reduce((sum, row) => sum + row.physicalStock, 0);
        const reserved = rows.reduce((sum, row) => sum + reservedOf(row), 0);
        const available = rows.reduce((sum, row) => sum + row.availableStock, 0);
        return (
          <section key={inv.id} className="rounded-md border" aria-label={`Almacén ${inv.name}`}>
            <header className="flex flex-wrap items-center gap-3 border-b p-4">
              <div className="rounded-md bg-muted p-2 text-muted-foreground"><Warehouse className="h-5 w-5" /></div>
              <div className="min-w-0">
                <h3 className="flex flex-wrap items-center gap-2 font-semibold">
                  {inv.name}
                  {meta.get(inv.id)?.isMain ? <span className="rounded border border-teal-300 bg-teal-50 px-1.5 py-0.5 text-xs font-medium text-teal-700 dark:border-teal-800 dark:bg-teal-950/30 dark:text-teal-400">Principal</span> : null}
                  {meta.get(inv.id) ? <span className="rounded border px-1.5 py-0.5 text-xs font-normal text-muted-foreground">{TYPE_LABEL[meta.get(inv.id)!.type]}</span> : null}
                </h3>
                <p className="text-xs text-muted-foreground">{rows.length} SKU · {physical} físico · {reserved} reservado · {available} disponible</p>
              </div>
              {inv.storeName ? <span className="ml-auto rounded border px-2 py-0.5 text-xs text-muted-foreground">{inv.storeName}</span> : null}
            </header>
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Producto</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead className="text-right">Físico</TableHead>
                  <TableHead className="text-right">Reservado</TableHead>
                  <TableHead className="text-right">Disponible</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="py-4 text-center text-muted-foreground">Sin stock en este almacén.</TableCell></TableRow>
                ) : rows.map((item) => {
                  const label = formatVariantLabel(item.attributes);
                  return (
                    <TableRow key={item.inventoryItemId}>
                      <TableCell className="text-sm">{item.productName}{label ? ` · ${label}` : ""}<InactiveBadge item={item} /></TableCell>
                      <TableCell className="font-mono text-xs"><SkuText item={item} /></TableCell>
                      <TableCell className="text-right tabular-nums">{item.physicalStock}</TableCell>
                      <TableCell className="text-right tabular-nums">{reservedOf(item)}</TableCell>
                      <TableCell className={`text-right tabular-nums ${availableClass(item.availableStock)}`}>{item.availableStock}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </section>
        );
      })}
    </div>
  );
}
