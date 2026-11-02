"use client";

/** Courier balances come from explicit Finance confirmations and persistent settlements.
 * Manual accounts remain notes stored on this device, separate from courier accounting.
 */

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, subDays } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
import { getOrdersByCompany } from "@/api/Ventas";
import { enTransito, paidAmount } from "../_lib/realData";
import { useCuentasManualCobrar, useCuentasManualPagar, useCuentasHistorial } from "../_lib/cuentasStorage";
import { getCourierSettlements, settlementMoney } from "@/services/courierSettlementsService";
import { courierSettlementBalances } from "../_lib/courierSettlementBalances";
import { MESES_LARGOS } from "../_mock/data";
import { fmtMoney } from "../_lib/format";
import { NivelPill } from "../_components/nivel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Check } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface CuentaLocal {
  id: string;
  icono: string;
  concepto: string;
  descripcion: string;
  monto: number;
  vencimiento: string;
  urgencia: "rojo" | "ambar" | "azul";
  auto: boolean;
}

const STALE = 5 * 60 * 1000;

function mesLabel(m: string) {
  const [y, mm] = m.split("-");
  return `${MESES_LARGOS[Number(mm) - 1]} ${y}`;
}

export default function CuentasPage() {
  const { auth } = useAuth();
  const companyId = auth?.company?.id ?? "";

  const hoy = new Date();
  const desde = format(subDays(hoy, 90), "yyyy-MM-dd");
  const hasta = format(hoy, "yyyy-MM-dd");

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["admin-cuentas-orders", companyId, desde, hasta],
    queryFn: () => getOrdersByCompany(companyId, desde, hasta),
    enabled: !!companyId,
    staleTime: STALE,
  });

  const [cobrarManual, setCobrarManual] = useCuentasManualCobrar(companyId);
  const [pagarManual, setPagarManual] = useCuentasManualPagar(companyId);
  const [historial, setHistorial] = useCuentasHistorial(companyId);
  const [tab, setTab] = useState<"abiertas" | "historial">("abiertas");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogTipo, setDialogTipo] = useState<"cobrar" | "pagar">("cobrar");
  const [form, setForm] = useState({ concepto: "", descripcion: "", monto: 0, vencimiento: "" });

  const settlementQuery = useQuery({
    queryKey: ["courier-settlements", companyId, auth?.user?.id],
    queryFn: ({ signal }) => getCourierSettlements(companyId, signal),
    enabled: !!companyId && !!auth?.user?.id,
    retry: false,
  });
  const courierBalances = useMemo(
    () => courierSettlementBalances(settlementQuery.data?.collections ?? []),
    [settlementQuery.data],
  );
  const cobrarAuto = useMemo((): CuentaLocal[] => {
    const transito = enTransito(orders as any[]).filter((o) => !o.currency || o.currency === "PEN");
    const monto = transito.reduce((sum, order) => sum + Math.max(0, Number(order.grandTotal || 0) - paidAmount(order)), 0);
    return monto > 0 ? [{
      id: "__transito__", icono: "🚚", concepto: "Saldos COD en tránsito (PEN)",
      descripcion: `${transito.length} pedidos pendientes de entrega; cobro por confirmar`,
      monto, vencimiento: "En tránsito", urgencia: "azul", auto: true,
    }] : [];
  }, [orders]);

  const cobrar = [...cobrarAuto, ...cobrarManual];
  const pagar = pagarManual;

  const totCobrar = cobrar.reduce((a, c) => a + c.monto, 0);
  const totPagar = pagar.reduce((a, c) => a + c.monto, 0);
  const neto = totCobrar - totPagar;

  const vencidas = [...cobrar, ...pagar].filter((c) => c.urgencia === "rojo");
  const proximas = [...cobrar, ...pagar].filter((c) => c.urgencia === "ambar");

  function confirmar(tipo: "cobrar" | "pagar", item: CuentaLocal) {
    if (item.auto) return;
    if (tipo === "cobrar") setCobrarManual((prev) => prev.filter((c) => c.id !== item.id));
    else setPagarManual((prev) => prev.filter((c) => c.id !== item.id));
    setHistorial((prev) => [
      { id: `h-${Date.now()}`, mes: format(hoy, "yyyy-MM"), tipo: tipo === "cobrar" ? "ingreso" : "egreso", concepto: item.concepto, monto: item.monto },
      ...prev,
    ]);
    toast.success(`${tipo === "cobrar" ? "Cobrado" : "Pagado"} · ${fmtMoney(item.monto)} · guardado en este dispositivo`);
  }

  function handleAdd() {
    if (!form.concepto.trim() || form.monto <= 0) {
      toast.error("Completa concepto y monto");
      return;
    }
    const item: CuentaLocal = {
      id: `m-${Date.now()}`,
      icono: dialogTipo === "cobrar" ? "💵" : "💸",
      concepto: form.concepto,
      descripcion: form.descripcion || "Cuenta manual",
      monto: form.monto,
      vencimiento: form.vencimiento || "Registrado",
      urgencia: "azul",
      auto: false,
    };
    if (dialogTipo === "cobrar") setCobrarManual((prev) => [...prev, item]);
    else setPagarManual((prev) => [...prev, item]);
    setDialogOpen(false);
    setForm({ concepto: "", descripcion: "", monto: 0, vencimiento: "" });
    toast.success("Cuenta agregada");
  }

  const historialOrdenado = useMemo(() => [...historial].sort((a, b) => b.mes.localeCompare(a.mes)), [historial]);
  const ingTotal = historial.filter((m) => m.tipo === "ingreso").reduce((a, m) => a + m.monto, 0);
  const egTotal = historial.filter((m) => m.tipo === "egreso").reduce((a, m) => a + m.monto, 0);

  if (isLoading) {
    return <div className="p-8 space-y-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}</div>;
  }

  return (
    <div className="p-8 space-y-6">
      <Card className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-500/10 dark:to-teal-500/10 border-emerald-200 dark:border-emerald-500/30">
        <CardContent className="pt-5 flex items-center justify-between flex-wrap gap-4">
          <div>
            <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 uppercase">Cuentas manuales y saldos en tránsito (PEN)</p>
            <p className={cn("text-3xl font-bold font-mono mt-1", neto >= 0 ? "text-emerald-700 dark:text-emerald-300" : "text-destructive")}>{neto >= 0 ? "+" : ""}{fmtMoney(neto)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Por cobrar {fmtMoney(totCobrar)} − Por pagar {fmtMoney(totPagar)} · excluye liquidaciones de courier</p>
          </div>
          <div className="flex gap-3">
            <div className="bg-emerald-100 dark:bg-emerald-500/15 rounded-xl px-5 py-3 text-center">
              <p className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 tracking-wide">POR COBRAR</p>
              <p className="text-xl font-bold font-mono text-emerald-700 dark:text-emerald-300">{fmtMoney(totCobrar)}</p>
            </div>
            <div className="bg-red-100 dark:bg-red-500/15 rounded-xl px-5 py-3 text-center">
              <p className="text-[10px] font-bold text-red-700 dark:text-red-300 tracking-wide">POR PAGAR</p>
              <p className="text-xl font-bold font-mono text-red-700 dark:text-red-300">{fmtMoney(totPagar)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm">Cobros confirmados pendientes de liquidar</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">Saldos del courier al negocio, separados por moneda. Los depósitos en revisión siguen pendientes hasta su aprobación.</p>
          {settlementQuery.isPending ? <p role="status">Consultando liquidaciones…</p> : settlementQuery.isError ? (
            <div role="alert"><p>No se pudieron verificar los saldos del courier.</p><Button variant="outline" onClick={() => settlementQuery.refetch()}>Reintentar</Button></div>
          ) : courierBalances.length === 0 ? <p>No hay saldos pendientes entre los cobros confirmados. Los cobros aún por verificar se revisan en Liquidaciones.</p> : courierBalances.map((balance) => (
            <div key={balance.key} className="flex justify-between gap-4 rounded border p-3">
              <div><p className="font-medium">{balance.courierName}</p><p className="text-xs text-muted-foreground">{balance.collections} cobros · en revisión {settlementMoney(balance.reservedAmount, balance.currency)}</p></div>
              <span className="font-mono">{settlementMoney(balance.remainingAmount, balance.currency)}</span>
            </div>
          ))}
          <Button asChild variant="outline"><Link href="/operaciones/liquidaciones">Revisar liquidaciones y comprobantes</Link></Button>
        </CardContent>
      </Card>

      <div className="rounded-lg border bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30 p-3.5 text-xs text-amber-800 dark:text-amber-300">
        Las cuentas manuales y su historial se guardan solo en este dispositivo. No registran pagos ni liquidaciones. Los saldos en tránsito todavía requieren confirmar la entrega y el cobro.
      </div>

      {vencidas.length > 0 && (
        <div className="rounded-lg border bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/30 p-3.5 text-sm text-red-800 dark:text-red-300">
          🔴 <b>{vencidas.length} cuenta{vencidas.length > 1 ? "s" : ""} vencida{vencidas.length > 1 ? "s" : ""}:</b> {vencidas.map((v) => `${v.concepto} (${fmtMoney(v.monto)})`).join(" · ")}.
        </div>
      )}
      {proximas.length > 0 && (
        <div className="rounded-lg border bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30 p-3.5 text-sm text-amber-800 dark:text-amber-300">
          ⚠️ <b>{proximas.length} próxima{proximas.length > 1 ? "s" : ""} a vencer:</b> {proximas.map((v) => `${v.concepto} (${fmtMoney(v.monto)})`).join(" · ")}.
        </div>
      )}

      <div className="inline-flex bg-muted rounded-lg p-1 gap-1">
        <button onClick={() => setTab("abiertas")} className={cn("px-3 py-1.5 rounded-md text-xs font-semibold", tab === "abiertas" ? "bg-background shadow-sm" : "text-muted-foreground")}>Abiertas</button>
        <button onClick={() => setTab("historial")} className={cn("px-3 py-1.5 rounded-md text-xs font-semibold", tab === "historial" ? "bg-background shadow-sm" : "text-muted-foreground")}>Historial</button>
      </div>

      {tab === "abiertas" ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-sm">💵 Por cobrar</CardTitle>
              <Button size="sm" variant="outline" onClick={() => { setDialogTipo("cobrar"); setDialogOpen(true); }}><Plus className="h-3.5 w-3.5 mr-1" /> Agregar</Button>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {cobrar.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">Nada pendiente por cobrar.</p>}
              {cobrar.map((c) => <CuentaCard key={c.id} item={c} tono="emerald" onConfirmar={() => confirmar("cobrar", c)} accionLabel="Cobrado" />)}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-sm">💸 Por pagar</CardTitle>
              <Button size="sm" variant="outline" onClick={() => { setDialogTipo("pagar"); setDialogOpen(true); }}><Plus className="h-3.5 w-3.5 mr-1" /> Agregar</Button>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {pagar.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">Nada pendiente por pagar registrado manualmente.</p>}
              {pagar.map((c) => <CuentaCard key={c.id} item={c} tono="red" onConfirmar={() => confirmar("pagar", c)} accionLabel="Pagado" />)}
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card>
          <CardHeader><CardTitle className="text-sm">Historial de movimientos <span className="text-xs font-normal text-muted-foreground">guardado en este dispositivo</span></CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            {historialOrdenado.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Sin movimientos confirmados todavía.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow><TableHead>Mes</TableHead><TableHead>Tipo</TableHead><TableHead>Concepto</TableHead><TableHead className="text-right">Monto</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {historialOrdenado.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell>{mesLabel(m.mes)}</TableCell>
                      <TableCell><NivelPill nivel={m.tipo === "ingreso" ? "verde" : "rojo"}>{m.tipo === "ingreso" ? "Ingreso" : "Egreso"}</NivelPill></TableCell>
                      <TableCell className="font-medium">{m.concepto}</TableCell>
                      <TableCell className={cn("text-right font-mono", m.tipo === "ingreso" ? "text-emerald-600" : "text-destructive")}>{m.tipo === "ingreso" ? "+" : "−"}{fmtMoney(m.monto)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow className="bg-primary/10 font-bold">
                    <TableCell colSpan={3}>NETO · +{fmtMoney(ingTotal)} cobrado / −{fmtMoney(egTotal)} pagado</TableCell>
                    <TableCell className="text-right font-mono">{ingTotal - egTotal >= 0 ? "+" : "−"}{fmtMoney(Math.abs(ingTotal - egTotal))}</TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Agregar cuenta por {dialogTipo === "cobrar" ? "cobrar" : "pagar"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label className="text-xs">Concepto</Label><Input value={form.concepto} onChange={(e) => setForm((f) => ({ ...f, concepto: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label className="text-xs">Descripción</Label><Input value={form.descripcion} onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label className="text-xs">Monto S/</Label><Input type="number" value={form.monto || ""} onChange={(e) => setForm((f) => ({ ...f, monto: Number(e.target.value) || 0 }))} /></div>
              <div className="space-y-1.5"><Label className="text-xs">Vencimiento / estado</Label><Input value={form.vencimiento} onChange={(e) => setForm((f) => ({ ...f, vencimiento: e.target.value }))} placeholder="Ej: Vence 30 mayo" /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleAdd}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CuentaCard({ item, tono, onConfirmar, accionLabel }: { item: CuentaLocal; tono: "emerald" | "red"; onConfirmar: () => void; accionLabel: string }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border p-3">
      <span className="text-xl w-8 text-center shrink-0">{item.icono}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate">{item.concepto}</p>
        <p className="text-xs text-muted-foreground truncate">{item.descripcion} {item.auto && "· Auto"}</p>
      </div>
      <div className="text-right shrink-0">
        <p className={cn("font-bold font-mono text-sm", tono === "emerald" ? "text-emerald-600" : "text-destructive")}>{fmtMoney(item.monto)}</p>
        <NivelPill nivel={item.urgencia} className="mt-0.5">{item.vencimiento}</NivelPill>
        {item.auto ? <Button asChild size="sm" variant="outline" className="mt-1.5"><Link href="/registrar-venta">Revisar pedidos</Link></Button> : <Button size="sm" variant={tono === "emerald" ? "default" : "outline"} className="mt-1.5 h-6 text-[11px] px-2" onClick={onConfirmar}>
          <Check className="h-3 w-3 mr-1" /> {accionLabel}
        </Button>}
      </div>
    </div>
  );
}
