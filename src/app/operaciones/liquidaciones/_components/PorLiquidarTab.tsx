"use client";

import { useEffect, useMemo, useState } from "react";
import { DateRange } from "react-day-picker";
import {
  AlertTriangle,
  CalendarIcon,
  ExternalLink,
  Eye,
  FileSpreadsheet,
  LayoutList,
  Mail,
  Table2,
  Wallet,
  X,
} from "lucide-react";
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
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Pagination } from "@/components/ui/pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GuiaPorLiquidar, PagoLiquidacion } from "./types";
import { formatDate, money } from "./utils";
import { RegistrarLiquidacionModal } from "./RegistrarLiquidacionModal";
import { DetallePedidoModal } from "./DetallePedidoModal";
import { ExportModal } from "./ExportModal";
import CustomerServiceModal from "@/components/modals/CustomerServiceModal";

type ViewMode = "pedido" | "courier";
type AntiguedadChip = "todos" | "vencido" | "enplazo";

const ALL_COURIERS = "__todos__";
const ALL_CIUDADES = "__todas__";
const ITEMS_PER_PAGE = 15;

function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

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
  const [detalleGuia, setDetalleGuia] = useState<GuiaPorLiquidar | null>(null);
  const [viewOrderId, setViewOrderId] = useState<string | null>(null);
  const [exportGuias, setExportGuias] = useState<GuiaPorLiquidar[] | null>(null);
  const [exportKind, setExportKind] = useState<"reclamo" | "seleccion" | "todo">("todo");

  const [search, setSearch] = useState("");
  const [courierFilter, setCourierFilter] = useState(ALL_COURIERS);
  const [ciudadFilter, setCiudadFilter] = useState(ALL_CIUDADES);
  const [fechaRange, setFechaRange] = useState<DateRange | undefined>(undefined);
  const [fechaCalendarOpen, setFechaCalendarOpen] = useState(false);
  const [antiguedad, setAntiguedad] = useState<AntiguedadChip>("todos");
  const [page, setPage] = useState(1);

  const pendientes = useMemo(() => guias.filter((g) => g.saldoPendiente > 0), [guias]);

  const couriers = useMemo(
    () => Array.from(new Set(pendientes.map((g) => g.courier))).sort(),
    [pendientes],
  );
  const ciudades = useMemo(
    () => Array.from(new Set(pendientes.map((g) => g.ciudad))).sort(),
    [pendientes],
  );

  // Mismo criterio date-only que el resto de la app (ej. PorDespacharTab) —
  // "YYYY-MM-DD" en horario local, para comparar contra `entregadoAt`.
  const fechaDesde = fechaRange?.from ? dateKey(fechaRange.from) : "";
  const fechaHasta = fechaRange?.to
    ? dateKey(fechaRange.to)
    : fechaRange?.from
      ? dateKey(fechaRange.from)
      : "";

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return pendientes
      .filter((g) => {
        if (term && !g.id.toLowerCase().includes(term) && !g.cliente.toLowerCase().includes(term)) {
          return false;
        }
        if (courierFilter !== ALL_COURIERS && g.courier !== courierFilter) return false;
        if (ciudadFilter !== ALL_CIUDADES && g.ciudad !== ciudadFilter) return false;
        // `entregadoAt` es un timestamp completo (updated_at de la orden);
        // comparar el string tal cual contra "YYYY-MM-DD" excluía pedidos
        // entregados justo el día "hasta" (su parte de hora siempre lo hacía
        // "mayor" al date-only) — se compara solo la parte de fecha.
        const entregadoDate = g.entregadoAt ? g.entregadoAt.slice(0, 10) : null;
        if (fechaDesde && entregadoDate && entregadoDate < fechaDesde) return false;
        if (fechaHasta && entregadoDate && entregadoDate > fechaHasta) return false;
        if (antiguedad === "vencido" && !g.vencido) return false;
        if (antiguedad === "enplazo" && g.vencido) return false;
        return true;
      })
      .sort((a, b) => {
        // Más reciente primero; sin fecha de entrega al final.
        if (!a.entregadoAt && !b.entregadoAt) return 0;
        if (!a.entregadoAt) return 1;
        if (!b.entregadoAt) return -1;
        return new Date(b.entregadoAt).getTime() - new Date(a.entregadoAt).getTime();
      });
  }, [pendientes, search, courierFilter, ciudadFilter, fechaDesde, fechaHasta, antiguedad]);

  useEffect(() => {
    setPage(1);
  }, [search, courierFilter, ciudadFilter, fechaDesde, fechaHasta, antiguedad, viewMode]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const pagedFiltered = filtered.slice(
    (page - 1) * ITEMS_PER_PAGE,
    page * ITEMS_PER_PAGE,
  );

  const kpis = useMemo(() => {
    const totalPorLiquidar = pendientes.reduce((sum, g) => sum + g.saldoPendiente, 0);
    const vencidos = pendientes.filter((g) => g.vencido);
    const totalVencido = vencidos.reduce((sum, g) => sum + g.saldoPendiente, 0);
    const couriersConPendiente = new Set(pendientes.map((g) => g.courier));
    return {
      totalPorLiquidar,
      totalVencido,
      cantVencidos: vencidos.length,
      cantCouriers: couriersConPendiente.size,
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

  const selectedGuias = filtered.filter((g) => selected.has(g.id));

  const byCourier = useMemo(() => {
    const map = new Map<string, GuiaPorLiquidar[]>();
    for (const g of filtered) {
      if (!map.has(g.courier)) map.set(g.courier, []);
      map.get(g.courier)!.push(g);
    }
    return Array.from(map.entries()).map(([courier, items]) => ({
      courier,
      items,
      cantidad: items.length,
      codNeto: items.reduce((s, g) => s + g.codNeto, 0),
      neto: items.reduce((s, g) => s + g.saldoPendiente, 0),
      vencidos: items.filter((g) => g.vencido).length,
    }));
  }, [filtered]);

  const handleRegistrar = (pago: PagoLiquidacion) => {
    onRegistrar(pago);
    setSelected(new Set());
    setModalGuias(null);
  };

  const exportRows = (list: GuiaPorLiquidar[]) =>
    list.map((g) => ({
      Pedido: g.id,
      Cliente: g.cliente,
      Ciudad: g.ciudad,
      Courier: g.courier,
      Entregado: formatDate(g.entregadoAt),
      "Días transcurridos": g.diasTranscurridos,
      "Plazo (días)": g.diasLimite,
      Cobró: g.codNeto,
      "Neto a recibir": g.saldoPendiente,
      Vencido: g.vencido ? "Sí" : "No",
    }));

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
          sub={selectedCourier ? `Courier: ${selectedCourier}` : "Marca filas para gestionar"}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Antigüedad:
        </span>
        {(
          [
            ["todos", `Todos (${pendientes.length})`],
            ["vencido", `Vencido (${pendientes.filter((g) => g.vencido).length})`],
            ["enplazo", `En plazo (${pendientes.filter((g) => !g.vencido).length})`],
          ] as [AntiguedadChip, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setAntiguedad(key)}
            className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
              antiguedad === key
                ? key === "vencido"
                  ? "border-red-300 bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300"
                  : "border-primary/40 bg-primary/10 text-primary"
                : "border-border bg-muted/40 text-muted-foreground hover:bg-muted"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Buscar por pedido o cliente..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-9 max-w-xs flex-1"
        />
        <Select value={courierFilter} onValueChange={setCourierFilter}>
          <SelectTrigger className="h-9 w-[170px]">
            <SelectValue placeholder="Courier" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_COURIERS}>Todos los couriers</SelectItem>
            {couriers.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={ciudadFilter} onValueChange={setCiudadFilter}>
          <SelectTrigger className="h-9 w-[160px]">
            <SelectValue placeholder="Ciudad" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_CIUDADES}>Toda ciudad</SelectItem>
            {ciudades.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Popover open={fechaCalendarOpen} onOpenChange={setFechaCalendarOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-9 gap-2 min-w-[200px] justify-start">
              <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs">
                {fechaRange?.from
                  ? `${fechaRange.from.toLocaleDateString("es-PE", { day: "2-digit", month: "short" })} – ${(
                      fechaRange.to ?? fechaRange.from
                    ).toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" })}`
                  : "Entregado — cualquier fecha"}
              </span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="range"
              selected={fechaRange}
              onSelect={(r) => {
                // Un solo click elige la fecha "desde" — se completa el
                // rango hasta hoy en vez de esperar un segundo click.
                if (r?.from && !r.to) {
                  setFechaRange({ from: r.from, to: new Date() });
                  setFechaCalendarOpen(false);
                  return;
                }
                setFechaRange(r);
                if (r?.from && r?.to) setFechaCalendarOpen(false);
              }}
              initialFocus
            />
          </PopoverContent>
        </Popover>
        {fechaRange?.from && (
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            title="Quitar filtro de fecha"
            onClick={() => setFechaRange(undefined)}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          className="ml-auto gap-1.5"
          onClick={() => {
            setExportKind("todo");
            setExportGuias(filtered);
          }}
        >
          <FileSpreadsheet className="h-3.5 w-3.5" />
          Exportar
        </Button>
      </div>

      {selectedGuias.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-primary/5 p-2.5">
          <span className="text-xs font-semibold text-muted-foreground">
            {selectedGuias.length} pedido{selectedGuias.length === 1 ? "" : "s"} ·{" "}
            {money(selectedGuias.reduce((s, g) => s + g.saldoPendiente, 0))} neto
          </span>
          <Button size="sm" className="h-8 gap-1 text-xs" onClick={() => setModalGuias(selectedGuias)}>
            <Wallet className="h-3.5 w-3.5" />
            Registrar liquidación
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1 text-xs"
            onClick={() => setModalGuias(selectedGuias)}
            title="Abre el mismo formulario — marca diferencia si el monto depositado no coincide"
          >
            <AlertTriangle className="h-3.5 w-3.5" />
            Marcar diferencia
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1 text-xs"
            onClick={() => {
              setExportKind("reclamo");
              setExportGuias(selectedGuias);
            }}
          >
            <Mail className="h-3.5 w-3.5" />
            Reclamar al courier
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1 text-xs"
            onClick={() => {
              setExportKind("seleccion");
              setExportGuias(selectedGuias);
            }}
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            Exportar selección
          </Button>
          <button
            className="ml-auto text-xs text-muted-foreground hover:text-foreground"
            onClick={() => setSelected(new Set())}
          >
            Limpiar ✕
          </button>
        </div>
      )}

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
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Cargando pedidos…</p>
          ) : viewMode === "pedido" ? (
            filtered.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                {pendientes.length === 0
                  ? "No hay pedidos con COD pendiente de depósito 🎉"
                  : "Ningún pedido coincide con los filtros."}
              </p>
            ) : (
              <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/30">
                    <TableRow>
                      <TableHead className="w-8" />
                      <TableHead>Pedido</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Ciudad</TableHead>
                      <TableHead>Entregado</TableHead>
                      <TableHead>Días</TableHead>
                      <TableHead>Courier</TableHead>
                      <TableHead className="text-right">Cobró</TableHead>
                      <TableHead className="text-right">Neto a recibir</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagedFiltered.map((g) => (
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
                        <TableCell className="text-sm text-muted-foreground">{g.ciudad}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(g.entregadoAt)}
                        </TableCell>
                        <TableCell className={g.vencido ? "font-bold text-red-600 dark:text-red-400" : ""}>
                          {g.diasTranscurridos}d / {g.diasLimite}d
                        </TableCell>
                        <TableCell>{g.courier}</TableCell>
                        <TableCell className="text-right">{money(g.codNeto)}</TableCell>
                        <TableCell className="text-right font-bold">{money(g.saldoPendiente)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              title="Ver pedido"
                              onClick={() => setViewOrderId(g.orderId)}
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              title="Ver detalle de liquidación"
                              onClick={() => setDetalleGuia(g)}
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-emerald-600 hover:text-emerald-700"
                              title="Registrar cobro / liquidación de este pedido"
                              onClick={() => setModalGuias([g])}
                            >
                              <Wallet className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              title="Reclamar"
                              onClick={() => {
                                setExportKind("reclamo");
                                setExportGuias([g]);
                              }}
                            >
                              <Mail className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <Pagination
                currentPage={page}
                totalPages={totalPages}
                totalItems={filtered.length}
                itemsPerPage={ITEMS_PER_PAGE}
                onPageChange={setPage}
                itemName="pedidos"
              />
              </>
            )
          ) : byCourier.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              {pendientes.length === 0
                ? "No hay pedidos con COD pendiente de depósito 🎉"
                : "Ningún pedido coincide con los filtros."}
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
                      <TableCell className="text-right font-bold">{money(c.neto)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button size="sm" onClick={() => setModalGuias(c.items)}>
                            Registrar
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            title="Reclamar"
                            onClick={() => {
                              setExportKind("reclamo");
                              setExportGuias(c.items);
                            }}
                          >
                            <Mail className="h-3.5 w-3.5" />
                          </Button>
                        </div>
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

      <DetallePedidoModal guia={detalleGuia} onOpenChange={(o) => !o && setDetalleGuia(null)} />

      <CustomerServiceModal
        open={!!viewOrderId}
        orderId={viewOrderId || ""}
        onClose={() => setViewOrderId(null)}
        isOperaciones
        showTracking
      />

      <ExportModal
        open={!!exportGuias}
        onOpenChange={(o) => !o && setExportGuias(null)}
        title={exportKind === "reclamo" ? "Reclamo a courier" : "Exportar"}
        subtitle={
          exportKind === "reclamo"
            ? "Cuenta por cobrar a courier — respalda el reclamo de depósito."
            : exportKind === "seleccion"
            ? "Exporta la selección actual."
            : "Exporta lo filtrado en Por Liquidar."
        }
        rows={exportRows(exportGuias ?? [])}
        filename={exportKind === "reclamo" ? "reclamo_courier" : "por_liquidar"}
        sheetName="Por liquidar"
      />
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
