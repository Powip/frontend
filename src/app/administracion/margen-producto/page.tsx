"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useAdminPeriod } from "@/contexts/AdminPeriodContext";
import { useAdminOrders } from "@/hooks/useAdminQueries";
import { IMargenProducto } from "@/interfaces/IAdmin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";

type SortKey = "margenPct" | "unidadesVendidas" | "contribucion";
type SortDir = "desc" | "asc";

function fmt(n: number) { return `S/ ${Number(n).toLocaleString("es-PE", { minimumFractionDigits: 2 })}`; }
function marginColor(p: number) { return p >= 40 ? "text-green-600" : p >= 20 ? "text-amber-600" : "text-destructive"; }

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: "margenPct", label: "Margen %" },
  { key: "unidadesVendidas", label: "Uds. vendidas" },
  { key: "contribucion", label: "Contribución" },
];

export default function MargenProductoPage() {
  const { auth } = useAuth();
  const { fromDate, toDate } = useAdminPeriod();
  const [productos, setProductos] = useState<(IMargenProducto & { contribucion: number })[]>([]);
  const [enriching, setEnriching] = useState(false);
  const [sortBy, setSortBy] = useState<SortKey>("margenPct");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const companyId = auth?.company?.id ?? "";
  const { data: orders = [], isLoading } = useAdminOrders(companyId, fromDate, toDate);

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
    const byProduct: Record<string, { nombre: string; sku: string; precioVenta: number; unidadesVendidas: number; count: number }> = {};
    for (const order of entregadas) {
      const items: any[] = order.items || [];
      for (const item of items) {
        const pid = item.productVariantId || item.id || "unknown";
        if (!byProduct[pid]) byProduct[pid] = { nombre: item.productName || "Producto", sku: item.sku || pid, precioVenta: 0, unidadesVendidas: 0, count: 0 };
        byProduct[pid].precioVenta += Number(item.unitPrice || 0);
        byProduct[pid].unidadesVendidas += Number(item.quantity || 1);
        byProduct[pid].count += 1;
      }
    }

    const variantIds = Object.keys(byProduct).filter((id) => id !== "unknown");
    setEnriching(true);

    Promise.all(
      variantIds.map(async (variantId) => {
        try {
          const res = await fetch(`${process.env.NEXT_PUBLIC_API_PRODUCTOS}/product-variant/${variantId}`);
          if (res.ok) {
            const data = await res.json();
            return [variantId, Number(data.priceBase ?? 0)] as [string, number];
          }
        } catch {}
        return [variantId, 0] as [string, number];
      })
    ).then((entries) => {
      const costMap = Object.fromEntries(entries);
      const result = Object.entries(byProduct).map(([id, p]) => {
        const precioVenta = p.count > 0 ? p.precioVenta / p.count : 0;
        const precioCosto = costMap[id] ?? 0;
        const margen = precioVenta - precioCosto;
        const margenPct = precioVenta > 0 ? 100 - (precioCosto / precioVenta) * 100 : 0;
        const contribucion = margen * p.unidadesVendidas;
        return { id, nombre: p.nombre, sku: p.sku, precioVenta, precioCosto, margen, margenPct, unidadesVendidas: p.unidadesVendidas, contribucion };
      });
      setProductos(result);
    }).finally(() => setEnriching(false));
  }, [orders, isLoading]);

  const loading = isLoading || enriching;

  const sorted = [...productos].sort((a, b) =>
    sortDir === "desc" ? b[sortBy] - a[sortBy] : a[sortBy] - b[sortBy]
  );

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortBy !== col) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40" />;
    return sortDir === "desc" ? <ArrowDown className="h-3 w-3 ml-1" /> : <ArrowUp className="h-3 w-3 ml-1" />;
  };

  return (
    <div className="p-8">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Margen por Producto</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Producto</TableHead>
                  <TableHead className="text-right">Precio venta</TableHead>
                  <TableHead className="text-right">Precio costo</TableHead>
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
                ) : sorted.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <div><p className="text-sm font-medium">{p.nombre}</p><p className="text-xs text-muted-foreground">{p.sku}</p></div>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">{fmt(p.precioVenta)}</TableCell>
                    <TableCell className="text-right font-mono text-sm text-muted-foreground">{fmt(p.precioCosto)}</TableCell>
                    <TableCell className="text-right">
                      <span className={`font-mono font-semibold text-sm ${marginColor(p.margenPct)}`}>{p.margenPct.toFixed(1)}%</span>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">{p.unidadesVendidas}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{fmt(p.contribucion)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
