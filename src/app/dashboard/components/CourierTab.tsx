"use client";

import { useMemo, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { hasAdminAccess } from "@/config/permissions.config";
import { useDashboardOrders } from "@/hooks/useDashboardOrders";
import { useDashboardCouriersList } from "@/hooks/useDashboardCouriersList";
import { useDashboardReceivables } from "@/hooks/useDashboardReceivables";
import { KpiCard, KpiGrid, SectionCard, SkeletonRows } from "./shared";
import { exportTableToExcel } from "./exportExcel";

interface CourierTabProps {
  fromDate: string;
  toDate: string;
}

export function CourierTab({ fromDate, toDate }: CourierTabProps) {
  const { selectedStoreId, auth } = useAuth();
  const isAdmin = hasAdminAccess(auth?.user?.role);
  const sellerId = isAdmin ? undefined : auth?.user?.id;
  const companyId = auth?.company?.id;

  const ordersQuery = useDashboardOrders(selectedStoreId);
  const couriersListQuery = useDashboardCouriersList(companyId);
  const receivablesQuery = useDashboardReceivables(selectedStoreId, fromDate, toDate, sellerId);

  // El status de la guía (ShippingGuide.status, endpoint de ms-courier) nunca
  // avanza más allá de ASIGNADA para varias tiendas — esa integración no
  // sincroniza el estado real de entrega ahí. OrderHeader.status sí lo hace
  // de forma confiable (ya usado en Operaciones), así que el rendimiento por
  // courier se calcula desde los pedidos, no desde las guías.
  const ordersInPeriod = useMemo(() => {
    const all = ordersQuery.data ?? [];
    const visible = all.filter((o) => o.status !== "INCOMPLETE" && (o.status as string) !== "PREVENTA");
    if (!fromDate || !toDate) return visible;
    return visible.filter((o) => {
      const d = o.created_at.slice(0, 10);
      return d >= fromDate && d <= toDate;
    });
  }, [ordersQuery.data, fromDate, toDate]);

  const couriersRows = useMemo(() => {
    const couriers = couriersListQuery.data ?? [];
    const byName = new Map<string, { envios: number; entregados: number; devueltos: number; tiempoSum: number; tiempoCount: number }>();
    couriers.forEach((c) => byName.set(c.name, { envios: 0, entregados: 0, devueltos: 0, tiempoSum: 0, tiempoCount: 0 }));

    ordersInPeriod.forEach((o) => {
      if (!o.courier) return;
      const entry = byName.get(o.courier) ?? { envios: 0, entregados: 0, devueltos: 0, tiempoSum: 0, tiempoCount: 0 };
      entry.envios += 1;
      if (o.status === "ENTREGADO") {
        entry.entregados += 1;
        const days = (new Date(o.updated_at).getTime() - new Date(o.created_at).getTime()) / (1000 * 60 * 60 * 24);
        entry.tiempoSum += Math.max(days, 0);
        entry.tiempoCount += 1;
      }
      if (o.status === "ANULADO") entry.devueltos += 1;
      byName.set(o.courier, entry);
    });

    return [...byName.entries()]
      .map(([name, s]) => ({
        name,
        envios: s.envios,
        entregados: s.entregados,
        efectividad: s.envios > 0 ? Math.round((s.entregados / s.envios) * 100) : 0,
        devueltos: s.devueltos,
        tiempoProm: s.tiempoCount > 0 ? s.tiempoSum / s.tiempoCount : null,
      }))
      .sort((a, b) => b.envios - a.envios);
  }, [couriersListQuery.data, ordersInPeriod]);

  const total = useMemo(() => {
    const envios = couriersRows.reduce((s, c) => s + c.envios, 0);
    const entregados = couriersRows.reduce((s, c) => s + c.entregados, 0);
    const devueltos = couriersRows.reduce((s, c) => s + c.devueltos, 0);
    return {
      envios,
      entregados,
      efectividad: envios > 0 ? Math.round((entregados / envios) * 100) : 0,
      devueltos,
    };
  }, [couriersRows]);

  const couriersActivos = couriersRows.filter((c) => c.envios > 0).length;
  const isLoadingTable = ordersQuery.isPending || couriersListQuery.isPending;
  const isErrorTable = ordersQuery.isError || couriersListQuery.isError;

  const [exportingCouriers, setExportingCouriers] = useState(false);
  const handleExportCouriers = async () => {
    setExportingCouriers(true);
    try {
      const columns = [
        { header: "Courier", width: 20 },
        { header: "Envíos", width: 12 },
        { header: "Entregados", width: 14 },
        { header: "Efectividad", width: 14 },
        { header: "Devueltos", width: 14 },
        { header: "Tiempo prom. (d)", width: 16 },
      ];
      const rows: (string | number)[][] = couriersRows.map((c) => [
        c.name,
        c.envios,
        c.entregados,
        `${c.efectividad}%`,
        c.devueltos,
        c.tiempoProm !== null ? Number(c.tiempoProm.toFixed(1)) : "—",
      ]);
      await exportTableToExcel("Couriers", `Rendimiento por courier (${fromDate} a ${toDate})`, columns, rows, `Courier_Rendimiento_${fromDate}_a_${toDate}.xlsx`);
    } finally {
      setExportingCouriers(false);
    }
  };

  const kpis = [
    {
      label: "Couriers Activos",
      value: isLoadingTable ? "…" : isErrorTable ? "Error" : couriersActivos,
      sub: `${(couriersListQuery.data ?? []).length} registrados`,
      loading: isLoadingTable,
    },
    {
      label: "Total Despachados",
      value: isLoadingTable ? "…" : isErrorTable ? "Error" : total.envios,
      sub: `${total.entregados} entregados`,
      valueClassName: "text-emerald-600 dark:text-emerald-400",
      loading: isLoadingTable,
    },
    {
      label: "Efectividad Global",
      value: isLoadingTable ? "…" : isErrorTable ? "Error" : `${total.efectividad}%`,
      sub: `${total.entregados} de ${total.envios} despachados`,
      primary: true,
      loading: isLoadingTable,
    },
    {
      label: "COD Pendiente Liquidar",
      value: receivablesQuery.data ? `S/ ${receivablesQuery.data.pendingTotal.toLocaleString("es-PE")}` : receivablesQuery.isError ? "Error" : "—",
      sub: receivablesQuery.data ? `${receivablesQuery.data.pendingOrders.length} pedidos sin liquidar` : "Saldo pendiente",
      accentDanger: true,
      loading: receivablesQuery.isPending,
    },
  ];

  return (
    <div className="flex flex-col gap-4 p-6">
      <KpiGrid cols={4}>
        {kpis.map((kpi) => (
          <KpiCard key={kpi.label} {...kpi} />
        ))}
      </KpiGrid>

      <SectionCard
        title="Rendimiento por courier"
        subtitle="Envíos, entregados, efectividad, devueltos y tiempo promedio del período"
        right={
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs h-7"
            disabled={exportingCouriers || couriersRows.length === 0}
            onClick={handleExportCouriers}
          >
            {exportingCouriers ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            Exportar
          </Button>
        }
        contentClassName="px-0"
      >
        {isLoadingTable ? (
          <div className="px-5">
            <SkeletonRows rows={4} />
          </div>
        ) : isErrorTable ? (
          <p className="text-xs text-red-600 dark:text-red-400 py-6 text-center">No se pudo cargar el rendimiento por courier.</p>
        ) : couriersRows.length === 0 ? (
          <p className="text-xs text-muted-foreground py-6 text-center">Sin envíos en el período.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-5">Courier</TableHead>
                <TableHead className="text-right">Envíos</TableHead>
                <TableHead className="text-right">Entregados</TableHead>
                <TableHead className="text-right">Efectividad</TableHead>
                <TableHead className="text-right">Devueltos</TableHead>
                <TableHead className="text-right">Tiempo prom.</TableHead>
                <TableHead className="text-right pr-5">COD pendiente</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {couriersRows.map((c) => (
                <TableRow key={c.name}>
                  <TableCell className="pl-5 font-semibold">{c.name}</TableCell>
                  <TableCell className="text-right font-semibold">{c.envios}</TableCell>
                  <TableCell className="text-right font-semibold">{c.entregados}</TableCell>
                  <TableCell className="text-right">
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[11px] font-bold",
                        c.efectividad >= 85
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400"
                          : c.efectividad >= 60
                            ? "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400"
                            : "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400"
                      )}
                    >
                      {c.efectividad}%
                    </span>
                  </TableCell>
                  <TableCell className={cn("text-right", c.devueltos > 0 ? "text-red-600 dark:text-red-400" : "text-muted-foreground")}>
                    {c.devueltos}
                  </TableCell>
                  <TableCell className="text-right font-medium">{c.tiempoProm !== null ? `${c.tiempoProm.toFixed(1)}d` : "—"}</TableCell>
                  <TableCell className="text-right pr-5 text-muted-foreground">—</TableCell>
                </TableRow>
              ))}
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableCell className="pl-5 font-extrabold">TOTAL</TableCell>
                <TableCell className="text-right font-extrabold">{total.envios}</TableCell>
                <TableCell className="text-right font-extrabold">{total.entregados}</TableCell>
                <TableCell className="text-right font-extrabold">{total.efectividad}%</TableCell>
                <TableCell className="text-right font-semibold text-red-600 dark:text-red-400">{total.devueltos}</TableCell>
                <TableCell className="text-right text-muted-foreground">—</TableCell>
                <TableCell className="text-right font-extrabold text-red-600 dark:text-red-400 pr-5">
                  {receivablesQuery.data ? `S/ ${receivablesQuery.data.pendingTotal.toLocaleString("es-PE")}` : "—"}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        )}
      </SectionCard>
    </div>
  );
}
