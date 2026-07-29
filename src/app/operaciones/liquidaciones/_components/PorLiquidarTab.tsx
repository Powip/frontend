"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, LayoutList, Table2, Wallet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { GuiaPorLiquidar, PagoLiquidacion } from "./types";
import { formatDate, money } from "./utils";
import { RegistrarLiquidacionModal } from "./RegistrarLiquidacionModal";

type ViewMode = "pedido" | "courier";

export function PorLiquidarTab({
  guias,
  loading,
  onRegistrar,
}: {
  guias: GuiaPorLiquidar[];
  loading: boolean;
  onRegistrar: (pago: PagoLiquidacion) => void;
}) {
  const [viewMode, setViewMode] = useState<ViewMode>("pedido");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [modalGuias, setModalGuias] = useState<GuiaPorLiquidar[] | null>(null);

  const pendientes = useMemo(() => guias.filter((g) => g.saldoPendiente > 0), [guias]);

  const kpis = useMemo(() => {
    const totalPorLiquidar = pendientes.reduce((sum, g) => sum + g.saldoPendiente, 0);
    const vencidos = pendientes.filter((g) => g.vencido);
    const totalVencido = vencidos.reduce((sum, g) => sum + g.saldoPendiente, 0);
    const couriers = new Set(pendientes.map((g) => g.courier));
    return {
      totalPorLiquidar,
      totalVencido,
      cantVencidos: vencidos.length,
      cantCouriers: couriers.size,
      cantGuias: pendientes.length,
    };
  }, [pendientes]);

  const selectedCourier = useMemo(() => {
    const first = [...selected][0];
    return first ? pendientes.find((g) => g.id === first)?.courier ?? null : null;
  }, [selected, pendientes]);

  const toggleSelect = (guia: GuiaPorLiquidar) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(guia.id)) {
        next.delete(guia.id);
      } else {
        // BACKEND GAP: no se permite mezclar couriers en una misma
        // liquidación porque cada courier deposita por separado — es una
        // decisión de UI local, no una regla que venga del backend.
        if (selectedCourier && selectedCourier !== guia.courier) return prev;
        next.add(guia.id);
      }
      return next;
    });
  };

  const selectedGuias = pendientes.filter((g) => selected.has(g.id));

  const byCourier = useMemo(() => {
    const map = new Map<string, GuiaPorLiquidar[]>();
    for (const g of pendientes) {
      if (!map.has(g.courier)) map.set(g.courier, []);
      map.get(g.courier)!.push(g);
    }
    return Array.from(map.entries()).map(([courier, items]) => ({
      courier,
      items,
      cantidad: items.length,
      codNeto: items.reduce((s, g) => s + g.codNeto, 0),
      comision: items.reduce((s, g) => s + g.comision, 0),
      neto: items.reduce((s, g) => s + g.saldoPendiente, 0),
      vencidos: items.filter((g) => g.vencido).length,
    }));
  }, [pendientes]);

  const handleRegistrar = (pago: PagoLiquidacion) => {
    onRegistrar(pago);
    setSelected(new Set());
    setModalGuias(null);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          color="amber"
          icon={<Wallet className="h-4 w-4" />}
          label="Total por liquidar"
          value={money(kpis.totalPorLiquidar)}
          sub={`${kpis.cantGuias} pedidos · ${kpis.cantCouriers} couriers`}
        />
        <Kpi
          color="red"
          icon={<AlertTriangle className="h-4 w-4" />}
          label="Vencido"
          value={money(kpis.totalVencido)}
          sub={`${kpis.cantVencidos} pedidos fuera de plazo`}
        />
        <Kpi
          color="blue"
          icon={<Table2 className="h-4 w-4" />}
          label="Couriers con pendiente"
          value={String(kpis.cantCouriers)}
          sub="Con al menos 1 pedido sin depositar"
        />
        <Kpi
          color="teal"
          icon={<LayoutList className="h-4 w-4" />}
          label="Seleccionados"
          value={String(selected.size)}
          sub={selectedCourier ? `Courier: ${selectedCourier}` : "Ninguno seleccionado"}
        />
      </div>

      <Card className="shadow-sm">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 border-b py-4">
          <CardTitle className="text-base">Pedidos con COD sin depositar</CardTitle>
          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-full border p-1">
              <Button
                variant={viewMode === "pedido" ? "secondary" : "ghost"}
                size="sm"
                className="h-7 rounded-full px-3 text-xs"
                onClick={() => setViewMode("pedido")}
              >
                Por pedido
              </Button>
              <Button
                variant={viewMode === "courier" ? "secondary" : "ghost"}
                size="sm"
                className="h-7 rounded-full px-3 text-xs"
                onClick={() => setViewMode("courier")}
              >
                Resumen por courier
              </Button>
            </div>
            {viewMode === "pedido" && (
              <Button
                size="sm"
                disabled={selectedGuias.length === 0}
                onClick={() => setModalGuias(selectedGuias)}
              >
                Registrar liquidación{selectedGuias.length > 0 ? ` (${selectedGuias.length})` : ""}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Cargando pedidos…</p>
          ) : viewMode === "pedido" ? (
            pendientes.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                No hay pedidos con COD pendiente de depósito 🎉
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/30">
                    <TableRow>
                      <TableHead className="w-8" />
                      <TableHead>Pedido</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Entregado</TableHead>
                      <TableHead>Días</TableHead>
                      <TableHead>Courier</TableHead>
                      <TableHead className="text-right">Cobró</TableHead>
                      <TableHead className="text-right">Comisión</TableHead>
                      <TableHead className="text-right">Neto a recibir</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendientes.map((g) => (
                      <TableRow
                        key={g.id}
                        className={g.vencido ? "bg-red-50 hover:bg-red-100 dark:bg-red-500/10 dark:hover:bg-red-500/15" : ""}
                      >
                        <TableCell>
                          <Checkbox
                            checked={selected.has(g.id)}
                            disabled={!!selectedCourier && selectedCourier !== g.courier}
                            onCheckedChange={() => toggleSelect(g)}
                          />
                        </TableCell>
                        <TableCell className="font-semibold">
                          {g.id}
                          {g.entregaParcial && (
                            <div className="mt-0.5">
                              <Badge
                                variant="outline"
                                className="border-orange-200 bg-orange-50 text-[10px] text-orange-700 dark:border-orange-500/30 dark:bg-orange-500/10 dark:text-orange-300"
                                title={g.entregaParcial.motivo}
                              >
                                Entrega parcial
                              </Badge>
                            </div>
                          )}
                        </TableCell>
                        <TableCell>{g.cliente}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(g.entregadoAt)}
                        </TableCell>
                        <TableCell className={g.vencido ? "font-bold text-red-600 dark:text-red-400" : ""}>
                          {g.diasTranscurridos}d / {g.diasLimite}d
                        </TableCell>
                        <TableCell>{g.courier}</TableCell>
                        <TableCell className="text-right">{money(g.codNeto)}</TableCell>
                        <TableCell className="text-right text-red-600 dark:text-red-400">
                          -{money(g.comision)}
                        </TableCell>
                        <TableCell className="text-right font-bold">{money(g.saldoPendiente)}</TableCell>
                        <TableCell className="text-right">
                          {g.vencido ? (
                            <Badge variant="destructive" className="text-[10px]">
                              Vencido
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-[10px]">
                              Pendiente
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )
          ) : byCourier.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              No hay pedidos con COD pendiente de depósito 🎉
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead>Courier</TableHead>
                    <TableHead className="text-right">Pedidos</TableHead>
                    <TableHead className="text-right">Vencidos</TableHead>
                    <TableHead className="text-right">Cobró (neto)</TableHead>
                    <TableHead className="text-right">Comisión</TableHead>
                    <TableHead className="text-right">Neto a recibir</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {byCourier.map((c) => (
                    <TableRow key={c.courier} className={c.vencidos > 0 ? "bg-red-50 dark:bg-red-500/10" : ""}>
                      <TableCell className="font-semibold">{c.courier}</TableCell>
                      <TableCell className="text-right">{c.cantidad}</TableCell>
                      <TableCell className={`text-right ${c.vencidos > 0 ? "font-bold text-red-600 dark:text-red-400" : ""}`}>
                        {c.vencidos}
                      </TableCell>
                      <TableCell className="text-right">{money(c.codNeto)}</TableCell>
                      <TableCell className="text-right text-red-600 dark:text-red-400">-{money(c.comision)}</TableCell>
                      <TableCell className="text-right font-bold">{money(c.neto)}</TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" onClick={() => setModalGuias(c.items)}>
                          Registrar liquidación
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {modalGuias && (
        <RegistrarLiquidacionModal
          open={!!modalGuias}
          onOpenChange={(o) => !o && setModalGuias(null)}
          guias={modalGuias}
          onRegistrar={handleRegistrar}
        />
      )}
    </div>
  );
}

const KPI_COLOR: Record<string, string> = {
  teal: "border-l-teal-500 text-teal-600 dark:text-teal-400",
  blue: "border-l-blue-500 text-blue-600 dark:text-blue-400",
  red: "border-l-red-500 text-red-600 dark:text-red-400",
  amber: "border-l-amber-500 text-amber-600 dark:text-amber-400",
};

function Kpi({
  icon,
  color,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  color: string;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className={`rounded-xl border border-l-4 bg-card p-4 shadow-sm ${KPI_COLOR[color]}`}>
      <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
        {icon}
        {label}
      </div>
      <div className="mt-2 text-2xl font-extrabold">{value}</div>
      <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>
    </div>
  );
}
