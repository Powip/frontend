"use client";

import { useMemo, useState } from "react";
import { AlertCircle, Eye, FileSpreadsheet, MessageSquare, Wallet } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { WhatsAppIcon } from "@/components/shared/WhatsAppIcon";
import { SaldoCliente, saldoRecordatorioEstado } from "./types";
import { formatDate, money } from "./utils";
import { WhatsAppMasivoModal } from "./WhatsAppMasivoModal";
import { RegistrarPagoClienteModal } from "./RegistrarPagoClienteModal";
import { ExportModal } from "./ExportModal";

type AntiguedadChip = "todos" | "mas30" | "semana";
type RecordatorioChip = "todos" | "sin" | "recordado";

const ALL_CIUDADES = "__todas__";

/**
 * Pestaña "Saldos clientes" — pedidos ENTREGADO donde el cliente pagó menos
 * de lo pactado. 100% datos de prueba locales (MOCK_SALDOS_CLIENTES): no
 * existe ninguna señal real para esto — ver BACKEND GAP en types.ts
 * (SaldoCliente) y el informe final.
 */
export function SaldosClientesTab({
  saldos,
  onRegistrarPago,
  onRecordatorioEnviado,
}: {
  saldos: SaldoCliente[];
  onRegistrarPago: (id: string, montoRecibido: number) => void;
  onRecordatorioEnviado: (ids: string[]) => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [ciudadFilter, setCiudadFilter] = useState(ALL_CIUDADES);
  const [antiguedad, setAntiguedad] = useState<AntiguedadChip>("todos");
  const [recordatorio, setRecordatorio] = useState<RecordatorioChip>("todos");

  const [waSeleccion, setWaSeleccion] = useState<SaldoCliente[] | null>(null);
  const [pagoCliente, setPagoCliente] = useState<SaldoCliente | null>(null);
  const [detalleCliente, setDetalleCliente] = useState<SaldoCliente | null>(null);
  const [exportRows, setExportRows] = useState<SaldoCliente[] | null>(null);

  const ciudades = useMemo(() => Array.from(new Set(saldos.map((s) => s.ciudad))).sort(), [saldos]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const now = Date.now();
    return saldos.filter((s) => {
      if (
        term &&
        !s.orderNumber.toLowerCase().includes(term) &&
        !s.cliente.toLowerCase().includes(term) &&
        !s.telefono.includes(term)
      ) {
        return false;
      }
      if (ciudadFilter !== ALL_CIUDADES && s.ciudad !== ciudadFilter) return false;
      const dias = Math.floor((now - new Date(s.entregadoAt).getTime()) / 86_400_000);
      if (antiguedad === "mas30" && dias < 30) return false;
      if (antiguedad === "semana" && dias > 7) return false;
      const estado = saldoRecordatorioEstado(s);
      if (recordatorio === "sin" && estado !== "SIN_RECORDAR") return false;
      if (recordatorio === "recordado" && estado !== "RECORDADO") return false;
      return true;
    });
  }, [saldos, search, ciudadFilter, antiguedad, recordatorio]);

  const kpis = useMemo(() => {
    const now = Date.now();
    const totalSaldo = saldos.reduce((s, c) => s + c.saldo, 0);
    const mas30 = saldos.filter((c) => (now - new Date(c.entregadoAt).getTime()) / 86_400_000 > 30);
    const totalMas30 = mas30.reduce((s, c) => s + c.saldo, 0);
    const recordatoriosEnviados = saldos.reduce((s, c) => s + c.recordatoriosEnviados, 0);
    return { totalSaldo, cantMas30: mas30.length, totalMas30, recordatoriosEnviados };
  }, [saldos]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = (checked: boolean) => {
    setSelected(checked ? new Set(filtered.map((s) => s.id)) : new Set());
  };

  const selectedClientes = filtered.filter((s) => selected.has(s.id));

  const exportData = (list: SaldoCliente[]) =>
    list.map((s) => ({
      Pedido: s.orderNumber,
      Cliente: s.cliente,
      Teléfono: s.telefono,
      Ciudad: s.ciudad,
      Entregado: formatDate(s.entregadoAt),
      Total: s.total,
      Pagó: s.pagado,
      Saldo: s.saldo,
      Recordatorios: s.recordatoriosEnviados,
    }));

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <p>
          <b>Tab nuevo:</b> pedidos <b>entregados con saldo pendiente del cliente</b> (pagó de
          menos). Acá se cobra al cliente — distinto a lo que debe el courier en Por Liquidar.
          Filtra, exporta y manda recordatorio masivo por WhatsApp.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          color="red"
          icon={<Wallet className="h-4 w-4" />}
          label="Saldo de clientes por cobrar"
          value={money(kpis.totalSaldo)}
          sub={`${saldos.length} pedidos entregados con saldo`}
        />
        <Kpi
          color="amber"
          icon={<AlertCircle className="h-4 w-4" />}
          label="+30 días sin pagar"
          value={money(kpis.totalMas30)}
          sub={`${kpis.cantMas30} clientes · riesgo de pérdida`}
        />
        <Kpi
          color="purple"
          icon={<MessageSquare className="h-4 w-4" />}
          label="Recordatorios enviados"
          value={String(kpis.recordatoriosEnviados)}
          sub="Acumulado de esta sesión"
        />
        <Kpi
          color="teal"
          icon={<Eye className="h-4 w-4" />}
          label="Seleccionados"
          value={String(selected.size)}
          sub="Para recordatorio o registro"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Antigüedad:
        </span>
        {(
          [
            ["todos", "Todos"],
            ["mas30", "+30 días"],
            ["semana", "Última semana"],
          ] as [AntiguedadChip, string][]
        ).map(([key, label]) => (
          <Chip key={key} active={antiguedad === key} onClick={() => setAntiguedad(key)} danger={key === "mas30"}>
            {label}
          </Chip>
        ))}
        <span className="ml-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Recordatorio:
        </span>
        {(
          [
            ["todos", "Todos"],
            ["sin", "Sin recordar"],
            ["recordado", "Ya recordado"],
          ] as [RecordatorioChip, string][]
        ).map(([key, label]) => (
          <Chip key={key} active={recordatorio === key} onClick={() => setRecordatorio(key)}>
            {label}
          </Chip>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Cliente, teléfono u orden..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-9 max-w-xs flex-1"
        />
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
        <Button
          variant="outline"
          size="sm"
          className="ml-auto gap-1.5"
          onClick={() => setExportRows(filtered)}
        >
          <FileSpreadsheet className="h-3.5 w-3.5" />
          Exportar lista
        </Button>
      </div>

      {selectedClientes.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2.5 dark:border-amber-500/30 dark:bg-amber-500/10">
          <span className="text-xs font-semibold text-amber-800 dark:text-amber-200">
            {selectedClientes.length} cliente{selectedClientes.length === 1 ? "" : "s"} ·{" "}
            {money(selectedClientes.reduce((s, c) => s + c.saldo, 0))} por cobrar
          </span>
          <Button
            size="sm"
            className="h-8 gap-1 bg-emerald-600 text-xs text-white hover:bg-emerald-700"
            onClick={() => setWaSeleccion(selectedClientes)}
          >
            <WhatsAppIcon className="h-3.5 w-3.5" />
            Recordatorio WhatsApp masivo
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1 text-xs"
            onClick={() => setExportRows(selectedClientes)}
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            Exportar selección
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1 text-xs"
            onClick={() => {
              selectedClientes.forEach((c) => onRegistrarPago(c.id, c.saldo));
              setSelected(new Set());
            }}
          >
            <Wallet className="h-3.5 w-3.5" />
            Registrar pago recibido
          </Button>
          <button
            className="ml-auto text-xs text-amber-800/70 hover:text-amber-900 dark:text-amber-200/70"
            onClick={() => setSelected(new Set())}
          >
            Limpiar ✕
          </button>
        </div>
      )}

      <Card className="shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between border-b py-4">
          <CardTitle className="text-base">Clientes con saldo pendiente</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              {saldos.length === 0
                ? "Sin saldos pendientes de clientes 🎉"
                : "Ningún cliente coincide con los filtros."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead className="w-8">
                      <Checkbox
                        checked={filtered.length > 0 && filtered.every((s) => selected.has(s.id))}
                        onCheckedChange={(c) => toggleAll(!!c)}
                      />
                    </TableHead>
                    <TableHead>Pedido</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Teléfono</TableHead>
                    <TableHead>Entregado</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Pagó</TableHead>
                    <TableHead className="text-right">Saldo</TableHead>
                    <TableHead>Recordatorios</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell>
                        <Checkbox checked={selected.has(s.id)} onCheckedChange={() => toggle(s.id)} />
                      </TableCell>
                      <TableCell className="font-semibold">{s.orderNumber}</TableCell>
                      <TableCell>{s.cliente}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{s.telefono}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(s.entregadoAt)}
                      </TableCell>
                      <TableCell className="text-right">{money(s.total)}</TableCell>
                      <TableCell className="text-right text-emerald-600 dark:text-emerald-400">
                        {money(s.pagado)}
                      </TableCell>
                      <TableCell className="text-right font-bold text-red-600 dark:text-red-400">
                        {money(s.saldo)}
                      </TableCell>
                      <TableCell>
                        {s.recordatoriosEnviados === 0 ? (
                          <Badge variant="secondary" className="text-[10px]">
                            Sin recordar
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="border-amber-200 bg-amber-50 text-[10px] text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300"
                          >
                            {s.recordatoriosEnviados} enviado{s.recordatoriosEnviados === 1 ? "" : "s"}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-emerald-600 hover:text-emerald-700"
                            title="Recordatorio WhatsApp"
                            onClick={() => setWaSeleccion([s])}
                          >
                            <WhatsAppIcon className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            title="Registrar pago"
                            onClick={() => setPagoCliente(s)}
                          >
                            <Wallet className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            title="Ver detalle"
                            onClick={() => setDetalleCliente(s)}
                          >
                            <Eye className="h-3.5 w-3.5" />
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

      {waSeleccion && (
        <WhatsAppMasivoModal
          open={!!waSeleccion}
          onOpenChange={(o) => !o && setWaSeleccion(null)}
          seleccionados={waSeleccion}
          onSent={(ids) => {
            onRecordatorioEnviado(ids);
            setSelected(new Set());
          }}
          onExport={() => setExportRows(waSeleccion)}
        />
      )}

      <RegistrarPagoClienteModal
        cliente={pagoCliente}
        onOpenChange={(o) => !o && setPagoCliente(null)}
        onConfirm={onRegistrarPago}
      />

      <Dialog open={!!detalleCliente} onOpenChange={(o) => !o && setDetalleCliente(null)}>
        <DialogContent className="max-w-sm">
          {detalleCliente && (
            <>
              <DialogHeader>
                <DialogTitle>Pedido {detalleCliente.orderNumber}</DialogTitle>
                <p className="text-sm text-muted-foreground">
                  {detalleCliente.cliente} · entregado {formatDate(detalleCliente.entregadoAt)}
                </p>
              </DialogHeader>
              <div className="rounded-lg border bg-muted/20 p-4 text-sm">
                <div className="flex justify-between border-b border-dashed py-1.5">
                  <span className="text-muted-foreground">Total pedido</span>
                  <b>{money(detalleCliente.total)}</b>
                </div>
                <div className="flex justify-between border-b border-dashed py-1.5">
                  <span className="text-muted-foreground">Pagó</span>
                  <b className="text-emerald-600 dark:text-emerald-400">{money(detalleCliente.pagado)}</b>
                </div>
                <div className="flex justify-between py-1.5 text-base">
                  <span className="font-semibold text-muted-foreground">Saldo pendiente</span>
                  <b className="text-red-600 dark:text-red-400">{money(detalleCliente.saldo)}</b>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {detalleCliente.recordatoriosEnviados === 0
                  ? "Todavía no se le envió ningún recordatorio."
                  : `${detalleCliente.recordatoriosEnviados} recordatorio(s) enviados, último el ${formatDate(
                      detalleCliente.ultimoRecordatorioAt,
                    )}.`}
              </p>
            </>
          )}
        </DialogContent>
      </Dialog>

      <ExportModal
        open={!!exportRows}
        onOpenChange={(o) => !o && setExportRows(null)}
        title="Exportar lista de cobranza"
        subtitle="Cliente · teléfono · orden · saldo — para tu herramienta de WhatsApp masivo."
        rows={exportData(exportRows ?? [])}
        filename="saldos_clientes"
        sheetName="Saldos clientes"
      />
    </div>
  );
}

const KPI_COLOR: Record<string, string> = {
  teal: "border-l-teal-500 text-teal-600 dark:text-teal-400",
  red: "border-l-red-500 text-red-600 dark:text-red-400",
  amber: "border-l-amber-500 text-amber-600 dark:text-amber-400",
  purple: "border-l-violet-500 text-violet-600 dark:text-violet-400",
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

function Chip({
  active,
  danger,
  onClick,
  children,
}: {
  active: boolean;
  danger?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
        active
          ? danger
            ? "border-red-300 bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300"
            : "border-primary/40 bg-primary/10 text-primary"
          : "border-border bg-muted/40 text-muted-foreground hover:bg-muted"
      }`}
    >
      {children}
    </button>
  );
}
