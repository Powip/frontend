"use client";

/**
 * Control diario de pauta — §9 doc técnica.
 *
 * CONECTADO A DATOS REALES: Órdenes, Unidades y Venta por día y por canal
 * salen de `getOrdersByCompany`, agrupados por `salesChannel` real (ver
 * `_lib/realData.ts`). El periodo es el mismo mes que el selector del
 * topbar (`useAdminPeriod`).
 *
 * SIGUE MOCK / SIN DATO REAL:
 * - Inversión, CPO, CPV, ROAS, objetivo de CPV y presupuesto del mes: no
 *   existe ninguna entidad de inversión diaria por canal (`pauta_registro`
 *   solo guarda un monto total por registro, no un desglose día a día — ver
 *   `administracion/pauta`). Se muestran en 0 / "—" hasta que exista esa
 *   fuente.
 * - Canales: usa el `SalesChannel` real (7 valores), más genérico que los 8
 *   canales del doc (no hay TikTok ni Falabella/Ripley/Web-COD separados).
 */

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useAdminPeriod } from "@/contexts/AdminPeriodContext";
import { getOrdersByCompany } from "@/api/Ventas";
import { CANALES_REALES, agruparPorDia, agruparPorCanal } from "../_lib/realData";
import { fmtMoney, fmtNum } from "../_lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type Vista = "canal" | "todos";

const STALE = 5 * 60 * 1000;

export default function ControlDiarioPage() {
  const { auth } = useAuth();
  const { fromDate, toDate } = useAdminPeriod();
  const [vista, setVista] = useState<Vista>("canal");
  const [canalId, setCanalId] = useState(CANALES_REALES[0].id);

  const companyId = auth?.company?.id ?? "";
  const [anio, mesNum] = fromDate.split("-").map(Number);

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["admin-diario-orders", companyId, fromDate, toDate],
    queryFn: () => getOrdersByCompany(companyId, fromDate, toDate),
    enabled: !!companyId,
    staleTime: STALE,
  });

  const diasEnMes = new Date(anio, mesNum, 0).getDate();
  const diasDelCanal = useMemo(() => {
    const map = agruparPorDia(orders as any[], canalId, mesNum, anio);
    return Array.from({ length: diasEnMes }, (_, i) => {
      const dia = i + 1;
      return { dia, ...(map[dia] ?? { ordenes: 0, unidades: 0, venta: 0 }) };
    }).filter((d) => d.ordenes > 0 || d.dia <= new Date().getDate());
  }, [orders, canalId, mesNum, anio, diasEnMes]);

  const totales = diasDelCanal.reduce(
    (a, d) => ({ ordenes: a.ordenes + d.ordenes, unidades: a.unidades + d.unidades, venta: a.venta + d.venta }),
    { ordenes: 0, unidades: 0, venta: 0 },
  );

  const semanas = useMemo(() => {
    const rangos: [number, number][] = [[1, 7], [8, 14], [15, 21], [22, diasEnMes]];
    return rangos
      .filter(([a]) => a <= diasEnMes)
      .map(([a, b], i) => {
        const sub = diasDelCanal.filter((d) => d.dia >= a && d.dia <= Math.min(b, diasEnMes));
        const t = sub.reduce((x, d) => ({ ordenes: x.ordenes + d.ordenes, unidades: x.unidades + d.unidades, venta: x.venta + d.venta }), { ordenes: 0, unidades: 0, venta: 0 });
        return { label: `S${i + 1} (${a}-${Math.min(b, diasEnMes)})`, ...t };
      });
  }, [diasDelCanal, diasEnMes]);

  const canalActual = CANALES_REALES.find((c) => c.id === canalId)!;

  if (isLoading) {
    return <div className="p-8 space-y-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}</div>;
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-[10px] font-bold text-primary uppercase tracking-[0.2em]">Órdenes y venta real · sin inversión conectada</p>
          <h2 className="text-lg font-bold mt-0.5">Control diario de pauta</h2>
        </div>
        <div className="inline-flex bg-muted rounded-lg p-1 gap-1">
          <button onClick={() => setVista("canal")} className={cn("px-3 py-1.5 rounded-md text-xs font-semibold", vista === "canal" ? "bg-background shadow-sm" : "text-muted-foreground")}>Por canal</button>
          <button onClick={() => setVista("todos")} className={cn("px-3 py-1.5 rounded-md text-xs font-semibold", vista === "todos" ? "bg-background shadow-sm" : "text-muted-foreground")}>Todos los canales</button>
        </div>
      </div>

      <div className="rounded-lg border bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30 p-3.5 text-xs text-amber-800 dark:text-amber-300">
        ⚠️ Inversión, CPO, CPV y ROAS no tienen fuente real todavía (ver Pauta por canal) — esta tabla solo muestra órdenes, unidades y venta reales por día.
      </div>

      {vista === "canal" ? (
        <>
          <div className="flex flex-wrap gap-1.5">
            {CANALES_REALES.map((c) => (
              <button
                key={c.id}
                onClick={() => setCanalId(c.id)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors",
                  canalId === c.id ? "bg-primary text-primary-foreground border-primary" : "bg-background text-muted-foreground border-border hover:text-foreground",
                )}
              >
                {c.nombre}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <KpiCard label="Órdenes del mes" valor={fmtNum(totales.ordenes)} sub={`${fmtNum(totales.unidades)} unidades`} />
            <KpiCard label="Venta del mes" valor={fmtMoney(totales.venta)} sub={canalActual.nombre} />
            <KpiCard label="Ticket promedio" valor={totales.ordenes > 0 ? fmtMoney(totales.venta / totales.ordenes, 2) : "—"} sub="venta ÷ órdenes" />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">
                Seguimiento diario — {canalActual.nombre} <span className="text-xs font-normal text-muted-foreground">Órdenes · Unidades · Venta</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Día</TableHead>
                    <TableHead className="text-right">Órdenes</TableHead>
                    <TableHead className="text-right">Unidades</TableHead>
                    <TableHead className="text-right">Venta S/</TableHead>
                    <TableHead className="text-right">Inversión</TableHead>
                    <TableHead className="text-right">CPV</TableHead>
                    <TableHead className="text-right">ROAS</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {diasDelCanal.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Sin pedidos entregados de este canal en el periodo.</TableCell></TableRow>
                  ) : diasDelCanal.map((d) => {
                    const esHoy = d.dia === new Date().getDate() && mesNum === new Date().getMonth() + 1 && anio === new Date().getFullYear();
                    return (
                      <TableRow key={d.dia} className={esHoy ? "bg-primary/5" : ""}>
                        <TableCell className="font-semibold">{d.dia}{esHoy ? " · hoy" : ""}</TableCell>
                        <TableCell className="text-right font-mono">{d.ordenes}</TableCell>
                        <TableCell className="text-right font-mono">{d.unidades}</TableCell>
                        <TableCell className="text-right font-mono">{fmtMoney(d.venta)}</TableCell>
                        <TableCell className="text-right font-mono text-muted-foreground">—</TableCell>
                        <TableCell className="text-right font-mono text-muted-foreground">—</TableCell>
                        <TableCell className="text-right font-mono text-muted-foreground">—</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
                <TableFooter>
                  <TableRow className="bg-primary/10 font-bold">
                    <TableCell>MES</TableCell>
                    <TableCell className="text-right font-mono">{totales.ordenes}</TableCell>
                    <TableCell className="text-right font-mono">{totales.unidades}</TableCell>
                    <TableCell className="text-right font-mono">{fmtMoney(totales.venta)}</TableCell>
                    <TableCell className="text-right font-mono text-muted-foreground">—</TableCell>
                    <TableCell className="text-right font-mono text-muted-foreground">—</TableCell>
                    <TableCell className="text-right font-mono text-muted-foreground">—</TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-sm">Desglose por semana</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow><TableHead>Semana</TableHead><TableHead className="text-right">Órdenes</TableHead><TableHead className="text-right">Unidades</TableHead><TableHead className="text-right">Venta</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {semanas.map((s) => (
                    <TableRow key={s.label}>
                      <TableCell className="font-semibold">{s.label}</TableCell>
                      <TableCell className="text-right font-mono">{s.ordenes}</TableCell>
                      <TableCell className="text-right font-mono">{s.unidades}</TableCell>
                      <TableCell className="text-right font-mono">{fmtMoney(s.venta)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      ) : (
        <Card>
          <CardHeader><CardTitle className="text-sm">Todos los canales — comparado (venta real)</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Canal</TableHead>
                  <TableHead>Grupo</TableHead>
                  <TableHead className="text-right">Pedidos</TableHead>
                  <TableHead className="text-right">Unidades</TableHead>
                  <TableHead className="text-right">Venta</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(() => {
                  const porCanal = agruparPorCanal(orders as any[]);
                  return CANALES_REALES.map((c) => {
                    const t = porCanal[c.id] ?? { ventas: 0, unidades: 0, pedidos: 0 };
                    return (
                      <TableRow key={c.id} className="cursor-pointer" onClick={() => { setCanalId(c.id); setVista("canal"); }}>
                        <TableCell className="font-semibold">{c.nombre}</TableCell>
                        <TableCell><Badge variant="outline" className="text-[10px]">{c.grupo === "ecommerce" ? "Ecommerce" : "Marketplace"}</Badge></TableCell>
                        <TableCell className="text-right font-mono">{t.pedidos}</TableCell>
                        <TableCell className="text-right font-mono">{t.unidades}</TableCell>
                        <TableCell className="text-right font-mono">{fmtMoney(t.ventas)}</TableCell>
                      </TableRow>
                    );
                  });
                })()}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function KpiCard({ label, valor, sub }: { label: string; valor: string; sub: string }) {
  return (
    <Card>
      <CardContent className="pt-4">
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-bold font-mono mt-1">{valor}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
      </CardContent>
    </Card>
  );
}
