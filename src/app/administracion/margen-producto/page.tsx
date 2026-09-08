"use client";

/**
 * Margen x Producto.
 *
 * `OrderItem` (ms-ventas) no trae costo por ítem — `costAmount` solo existe a
 * nivel de pedido completo (ver `_lib/pnl.ts`), no desglosado por SKU. Por
 * eso esta página, a diferencia de todo el resto del módulo, no puede usar
 * el costo real al momento de la venta: en su lugar consulta el costo
 * *actual* del catálogo (`priceBase` de ms-products) por cada variante
 * vendida en el periodo. Si el costo del producto cambió desde que se
 * vendió, el margen mostrado usa el costo de hoy, no el histórico — es una
 * limitación de datos, no se puede resolver sin que ms-ventas guarde el
 * costo por ítem al momento de la venta (ver `BACKEND_REQUERIMIENTOS.md`).
 *
 * Antes, si el fetch a ms-products fallaba o el variant ya no existía, el
 * costo caía a S/ 0 silenciosamente → el producto se mostraba con 100% de
 * margen (el peor caso posible: parece el producto más rentable cuando en
 * realidad es un dato faltante). Ahora esos casos muestran "—", y además se
 * puede corregir el costo a mano (`_lib/margenStorage.ts`) — útil tanto
 * cuando la sincronización automática falla como cuando el usuario
 * simplemente necesita ajustarlo.
 *
 * Agrupación: por modelo (nombre de producto), no por variante — antes cada
 * talla/color aparecía como fila propia, generando listados larguísimos en
 * catálogos con muchas variantes. El detalle por variante sigue disponible
 * al expandir la fila del modelo.
 *
 * Precio neto vs. PVP: `OrderItem.subtotal` es el precio neto (sin IGV) —
 * mismo criterio que usa `subtotal` a nivel de pedido en `_lib/pnl.ts`. El
 * PVP se estima aplicando la tasa de IGV de la empresa sobre ese neto. Es
 * una aproximación de tasa plana (igual que el IGV estimado del resto del
 * módulo): no distingue `taxMode` por pedido (`AUTOMATICO` vs `INCLUIDO`),
 * así que en catálogos con ambos modos mezclados el PVP mostrado es
 * referencial, no exacto.
 */

import { Fragment, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useAdminPeriod } from "@/contexts/AdminPeriodContext";
import { useAdminOrders } from "@/hooks/useAdminQueries";
import { useCostoOverrides } from "../_lib/margenStorage";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowUpDown, ArrowUp, ArrowDown, ChevronRight, ChevronDown, Pencil, Check, X, RotateCcw } from "lucide-react";
import { toast } from "sonner";

type SortKey = "margenPct" | "unidadesVendidas" | "contribucion";
type SortDir = "desc" | "asc";

function fmt(n: number) { return `S/ ${Number(n).toLocaleString("es-PE", { minimumFractionDigits: 2 })}`; }
function marginColor(p: number) { return p >= 40 ? "text-green-600" : p >= 20 ? "text-amber-600" : "text-destructive"; }

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: "margenPct", label: "Margen %" },
  { key: "unidadesVendidas", label: "Uds. vendidas" },
  { key: "contribucion", label: "Contribución" },
];

interface VarianteMargen {
  variantId: string;
  sku: string;
  attributes: string;
  ventaTotal: number;
  unidadesVendidas: number;
  costoRaw: number | null;
}

interface ModeloAcc {
  modelo: string;
  variantes: VarianteMargen[];
  ventaTotal: number;
  unidadesVendidas: number;
  costoAutoTotal: number;
  unidadesConCostoAuto: number;
}

interface FilaMargen {
  modelo: string;
  variantes: VarianteMargen[];
  unidadesVendidas: number;
  precioNeto: number;
  precioPVP: number;
  costoAuto: number | null;
  costoOverride: number | null;
  costoEfectivo: number | null;
  sinCosto: boolean;
  costoParcial: boolean;
  margen: number;
  margenPct: number;
  contribucion: number;
}

export default function MargenProductoPage() {
  const { auth } = useAuth();
  const { fromDate, toDate } = useAdminPeriod();
  const [modelos, setModelos] = useState<ModeloAcc[]>([]);
  const [enriching, setEnriching] = useState(false);
  const [sortBy, setSortBy] = useState<SortKey>("margenPct");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [expandido, setExpandido] = useState<Set<string>>(new Set());
  const [editando, setEditando] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const companyId = auth?.company?.id ?? "";
  const ivaRate = (auth?.company?.iva ?? 18) / 100;
  const { data: orders = [], isLoading } = useAdminOrders(companyId, fromDate, toDate);
  const [costoOverrides, setCostoOverrides] = useCostoOverrides(companyId);

  const handleSort = (key: SortKey) => {
    if (sortBy === key) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortBy(key);
      setSortDir("desc");
    }
  };

  useEffect(() => {
    if (isLoading) return;

    const entregadas = (orders as any[]).filter((o) => o.status === "ENTREGADO");

    // Paso 1: agregar por variante (necesario para el costo real de
    // ms-products, que es por variante, y para el detalle expandible).
    const byVariant: Record<string, { modelo: string; sku: string; attributes: string; ventaTotal: number; unidadesVendidas: number }> = {};
    for (const order of entregadas) {
      const items: any[] = order.items || [];
      for (const item of items) {
        const vid = item.productVariantId || item.id || "unknown";
        if (!byVariant[vid]) {
          const attrs =
            item.attributes && typeof item.attributes === "object"
              ? Object.entries(item.attributes as Record<string, string>)
                  .map(([k, v]) => `${k}: ${v}`)
                  .join(" · ")
              : "";
          byVariant[vid] = { modelo: item.productName || "Producto", sku: item.sku || vid, attributes: attrs, ventaTotal: 0, unidadesVendidas: 0 };
        }
        byVariant[vid].ventaTotal += Number(item.subtotal ?? Number(item.unitPrice || 0) * Number(item.quantity || 1));
        byVariant[vid].unidadesVendidas += Number(item.quantity || 1);
      }
    }

    const variantIds = Object.keys(byVariant).filter((id) => id !== "unknown");
    setEnriching(true);

    Promise.all(
      variantIds.map(async (variantId) => {
        try {
          const res = await fetch(`${process.env.NEXT_PUBLIC_API_PRODUCTOS}/product-variant/${variantId}`);
          if (res.ok) {
            const data = await res.json();
            if (data.priceBase != null) return [variantId, Number(data.priceBase)] as [string, number];
          }
        } catch {}
        return [variantId, null] as [string, number | null];
      })
    ).then((entries) => {
      const costMap = Object.fromEntries(entries) as Record<string, number | null>;

      // Paso 2: agrupar variantes "por modelo" (nombre de producto), no por
      // talla/color, para evitar listados extensos.
      const byModelo: Record<string, ModeloAcc> = {};
      for (const [vid, v] of Object.entries(byVariant)) {
        const key = v.modelo;
        if (!byModelo[key]) {
          byModelo[key] = { modelo: key, variantes: [], ventaTotal: 0, unidadesVendidas: 0, costoAutoTotal: 0, unidadesConCostoAuto: 0 };
        }
        const costoRaw = costMap[vid] ?? null;
        byModelo[key].variantes.push({ variantId: vid, sku: v.sku, attributes: v.attributes, ventaTotal: v.ventaTotal, unidadesVendidas: v.unidadesVendidas, costoRaw });
        byModelo[key].ventaTotal += v.ventaTotal;
        byModelo[key].unidadesVendidas += v.unidadesVendidas;
        if (costoRaw != null) {
          byModelo[key].costoAutoTotal += costoRaw * v.unidadesVendidas;
          byModelo[key].unidadesConCostoAuto += v.unidadesVendidas;
        }
      }

      setModelos(Object.values(byModelo));
    }).finally(() => setEnriching(false));
  }, [orders, isLoading]);

  const filas: FilaMargen[] = useMemo(
    () =>
      modelos.map((m) => {
        const precioNeto = m.unidadesVendidas > 0 ? m.ventaTotal / m.unidadesVendidas : 0;
        const precioPVP = precioNeto * (1 + ivaRate);
        const costoAuto = m.unidadesConCostoAuto > 0 ? m.costoAutoTotal / m.unidadesConCostoAuto : null;
        const override = costoOverrides[m.modelo] ?? null;
        const costoEfectivo = override ?? costoAuto;
        const sinCosto = costoEfectivo == null;
        const costoParcial = override == null && costoAuto != null && m.unidadesConCostoAuto < m.unidadesVendidas;
        const margen = sinCosto ? 0 : precioNeto - (costoEfectivo as number);
        const margenPct = sinCosto || precioNeto <= 0 ? 0 : (margen / precioNeto) * 100;
        const contribucion = sinCosto ? 0 : margen * m.unidadesVendidas;
        return {
          modelo: m.modelo,
          variantes: m.variantes,
          unidadesVendidas: m.unidadesVendidas,
          precioNeto,
          precioPVP,
          costoAuto,
          costoOverride: override,
          costoEfectivo,
          sinCosto,
          costoParcial,
          margen,
          margenPct,
          contribucion,
        };
      }),
    [modelos, costoOverrides, ivaRate],
  );

  const loading = isLoading || enriching;

  const sorted = [...filas].sort((a, b) =>
    sortDir === "desc" ? b[sortBy] - a[sortBy] : a[sortBy] - b[sortBy]
  );

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortBy !== col) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40" />;
    return sortDir === "desc" ? <ArrowDown className="h-3 w-3 ml-1" /> : <ArrowUp className="h-3 w-3 ml-1" />;
  };

  function toggleExpand(modelo: string) {
    setExpandido((prev) => {
      const next = new Set(prev);
      if (next.has(modelo)) next.delete(modelo);
      else next.add(modelo);
      return next;
    });
  }

  function startEdit(fila: FilaMargen) {
    setEditando(fila.modelo);
    setEditValue(fila.costoEfectivo != null ? fila.costoEfectivo.toFixed(2) : "");
  }

  function saveEdit(modelo: string) {
    const val = parseFloat(editValue);
    if (isNaN(val) || val < 0) {
      toast.error("Ingresa un costo válido");
      return;
    }
    setCostoOverrides((prev) => ({ ...prev, [modelo]: val }));
    setEditando(null);
    toast.success("Costo actualizado a mano para este producto");
  }

  function clearOverride(modelo: string) {
    setCostoOverrides((prev) => {
      const next = { ...prev };
      delete next[modelo];
      return next;
    });
    toast.success("Vuelve a usar el costo automático del catálogo");
  }

  return (
    <div className="p-8 space-y-4">
      <div className="rounded-lg border bg-amber-50/60 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30 p-3.5 text-xs text-amber-800 dark:text-amber-300 space-y-1">
        <p>El precio de costo es el actual del catálogo, no el que tenía el producto al momento de cada venta — ms-ventas no guarda costo por ítem, solo un total por pedido. Si el costo cambió después de vender, o si no se pudo sincronizar, corregilo a mano con el lápiz de la columna Costo.</p>
        <p>PVP estimado = precio neto × (1 + IGV de la empresa). Es una aproximación de tasa plana, no distingue pedidos con impuesto incluido de los que lo suman aparte.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Margen por Producto <span className="text-xs font-normal text-muted-foreground">agrupado por modelo — clic en un producto para ver el detalle por talla/color</span></CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Producto</TableHead>
                  <TableHead className="text-right">Precio neto</TableHead>
                  <TableHead className="text-right">PVP (est.)</TableHead>
                  <TableHead className="text-right">Costo</TableHead>
                  {COLUMNS.map(({ key, label }) => (
                    <TableHead key={key} className="text-right cursor-pointer select-none hover:text-foreground" onClick={() => handleSort(key)}>
                      <span className="inline-flex items-center justify-end w-full">
                        {label}<SortIcon col={key} />
                      </span>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No hay datos de productos para este período</TableCell></TableRow>
                ) : sorted.map((p) => {
                  const abierto = expandido.has(p.modelo);
                  return (
                    <Fragment key={p.modelo}>
                      <TableRow className="cursor-pointer" onClick={() => toggleExpand(p.modelo)}>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            {abierto ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                            <div>
                              <p className="text-sm font-medium">{p.modelo}</p>
                              <p className="text-xs text-muted-foreground">{p.variantes.length === 1 ? p.variantes[0].sku : `${p.variantes.length} variantes`}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">{fmt(p.precioNeto)}</TableCell>
                        <TableCell className="text-right font-mono text-sm text-muted-foreground">{fmt(p.precioPVP)}</TableCell>
                        <TableCell className="text-right font-mono text-sm" onClick={(e) => e.stopPropagation()}>
                          {editando === p.modelo ? (
                            <div className="flex items-center justify-end gap-1">
                              <Input
                                type="number"
                                min={0}
                                step={0.01}
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                className="h-7 w-24 text-right font-mono text-xs px-2"
                                autoFocus
                              />
                              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => saveEdit(p.modelo)}>
                                <Check className="h-3.5 w-3.5 text-green-600" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setEditando(null)}>
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-end gap-1">
                              {p.sinCosto ? (
                                <span className="text-xs text-muted-foreground" title="No se pudo obtener el costo actual del catálogo">Sin costo</span>
                              ) : (
                                <span title={p.costoParcial ? "Solo algunas variantes de este modelo tienen costo — promedio parcial" : undefined}>
                                  {fmt(p.costoEfectivo as number)}{p.costoParcial && !p.costoOverride ? " *" : ""}
                                </span>
                              )}
                              {p.costoOverride != null && (
                                <span className="text-[9px] font-bold text-primary bg-primary/10 px-1 py-0.5 rounded" title="Editado a mano">manual</span>
                              )}
                              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => startEdit(p)}>
                                <Pencil className="h-3 w-3 text-muted-foreground" />
                              </Button>
                              {p.costoOverride != null && (
                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => clearOverride(p.modelo)} title="Volver al costo automático">
                                  <RotateCcw className="h-3 w-3 text-muted-foreground" />
                                </Button>
                              )}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {p.sinCosto ? (
                            <span className="text-xs text-muted-foreground">—</span>
                          ) : (
                            <span className={`font-mono font-semibold text-sm ${marginColor(p.margenPct)}`}>{p.margenPct.toFixed(1)}%</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">{p.unidadesVendidas}</TableCell>
                        <TableCell className="text-right font-mono text-sm">{p.sinCosto ? "—" : fmt(p.contribucion)}</TableCell>
                      </TableRow>
                      {abierto && p.variantes.map((v) => (
                        <TableRow key={v.variantId} className="bg-muted/30">
                          <TableCell className="pl-9">
                            <p className="text-xs font-medium">{v.attributes || "Sin atributos"}</p>
                            <p className="text-[10px] text-muted-foreground">{v.sku}</p>
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs text-muted-foreground">{v.unidadesVendidas > 0 ? fmt(v.ventaTotal / v.unidadesVendidas) : "—"}</TableCell>
                          <TableCell className="text-right font-mono text-xs text-muted-foreground">{v.unidadesVendidas > 0 ? fmt((v.ventaTotal / v.unidadesVendidas) * (1 + ivaRate)) : "—"}</TableCell>
                          <TableCell className="text-right font-mono text-xs text-muted-foreground">{v.costoRaw != null ? fmt(v.costoRaw) : "Sin costo"}</TableCell>
                          <TableCell />
                          <TableCell className="text-right font-mono text-xs text-muted-foreground">{v.unidadesVendidas}</TableCell>
                          <TableCell />
                        </TableRow>
                      ))}
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
