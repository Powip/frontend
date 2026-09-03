"use client";

/**
 * Capital & ROI — §14 doc técnica.
 *
 * CONECTADO A DATOS REALES: "Utilidad acumulada" y "Tiempo de recupero" del
 * hero salen de `useAdminYearPnl` (profit real acumulado del año en curso,
 * mismo agregado simplificado que usa Flujo de Caja — sin IGV/comisión
 * POWIP/merma).
 *
 * SOLUCIÓN PUENTE (localStorage, sin backend): no existe `capital_entry` ni
 * `prestamo_cuota` en ningún microservicio (§20 doc). La lista de capital y
 * el préstamo (si registras uno) se guardan en `localStorage` por empresa
 * (`_lib/capitalStorage.ts`) — a diferencia de la versión anterior de esta
 * pantalla, YA NO arranca con un préstamo BCP de ejemplo ni con aportes
 * falsos: arranca vacía, y lo que registres sobrevive a recargar la página,
 * pero vive solo en este navegador/dispositivo, no se comparte entre
 * usuarios ni equipos. La amortización del préstamo se genera en el
 * frontend (`generarAmortizacion`) a partir de los datos que ingreses al
 * registrar un capital de tipo "Préstamo".
 */

import { useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useAdminYearPnl } from "../_lib/useMonthlyPnl";
import { useCapitalEntries, useCuotasPagadas, generarAmortizacion, type CapitalTipo } from "../_lib/capitalStorage";
import { fmtMoney, fmtPct } from "../_lib/format";
import { NivelPill } from "../_components/nivel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Trash2, Check } from "lucide-react";
import { toast } from "sonner";

const TIPOS: CapitalTipo[] = ["Capital propio", "Aumento de capital", "Préstamo", "Utilidad reinvertida"];
const ICONOS: Record<CapitalTipo, string> = { "Capital propio": "💰", "Aumento de capital": "💰", "Préstamo": "🏦", "Utilidad reinvertida": "♻️" };

const emptyForm = { tipo: TIPOS[0], descripcion: "", tienda: "Consolidado", monto: 0, tasaAnualPct: 0, plazoCuotas: 12, cuotaMensual: 0, fechaInicio: new Date().toISOString().slice(0, 10) };

export default function CapitalRoiPage() {
  const { auth } = useAuth();
  const companyId = auth?.company?.id ?? "";
  const token = auth?.accessToken ?? "";
  const storeIds = useMemo(() => (auth?.company?.stores ?? []).map((s) => s.id), [auth?.company?.stores]);
  const anio = new Date().getFullYear();
  const { meses, isLoading: loadingPnl } = useAdminYearPnl(companyId, anio, storeIds, token);

  const [capital, setCapital] = useCapitalEntries(companyId);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const prestamo = capital.find((c) => c.tipo === "Préstamo");
  const [cuotasPagadas, setCuotasPagadas] = useCuotasPagadas(companyId, prestamo?.id ?? "none");
  const cuotas = useMemo(() => (prestamo ? generarAmortizacion(prestamo, cuotasPagadas) : []), [prestamo, cuotasPagadas]);

  const mesesConDatos = meses.filter((m) => m.tieneDatos);
  const utilidadAcumulada = mesesConDatos.reduce((a, m) => a + m.profit, 0);
  const promedioMensual = mesesConDatos.length > 0 ? utilidadAcumulada / mesesConDatos.length : 0;

  const totalCapital = capital.reduce((a, c) => a + c.monto, 0);
  const roi = totalCapital > 0 ? (utilidadAcumulada / totalCapital) * 100 : 0;
  const mesesRecupero = promedioMensual > 0 && totalCapital > 0 ? totalCapital / promedioMensual : null;
  const hero = [
    ["Capital total invertido", fmtMoney(totalCapital)],
    ["Utilidad acumulada", fmtMoney(utilidadAcumulada)],
    ["ROI", totalCapital > 0 ? fmtPct(roi) : "—"],
    ["Tiempo de recupero", mesesRecupero != null ? `${mesesRecupero.toFixed(1)} meses` : "—"],
  ];

  const pagadas = cuotas.filter((c) => c.estado === "pagada").length;
  const proxima = cuotas.find((c) => c.estado === "proxima");
  const pagado = cuotas.filter((c) => c.estado === "pagada").reduce((s, c) => s + c.cuota, 0);
  const saldoPendiente = cuotas.filter((c) => c.estado !== "pagada").reduce((s, c) => s + c.capital, 0);

  function pagarCuota() {
    if (!proxima) return;
    setCuotasPagadas((n) => n + 1);
    toast.success(`Cuota ${proxima.n} pagada · ${fmtMoney(proxima.cuota)} · guardado en este dispositivo`);
  }

  function handleAdd() {
    if (!form.descripcion.trim() || form.monto <= 0) {
      toast.error("Completa descripción y monto");
      return;
    }
    if (form.tipo === "Préstamo" && (form.plazoCuotas <= 0 || form.cuotaMensual <= 0)) {
      toast.error("Para un préstamo, completa plazo y cuota mensual");
      return;
    }
    if (form.tipo === "Préstamo" && form.tasaAnualPct > 0) {
      const interesPrimeraCuota = form.monto * (form.tasaAnualPct / 100 / 12);
      if (form.cuotaMensual <= interesPrimeraCuota) {
        toast.error(`La cuota mensual (${fmtMoney(form.cuotaMensual)}) no alcanza a cubrir el interés del primer mes (${fmtMoney(interesPrimeraCuota)}) — la deuda nunca bajaría. Revisa el monto, la tasa o la cuota.`);
        return;
      }
    }
    const entry = {
      id: `cap-${Date.now()}`,
      tipo: form.tipo,
      descripcion: form.descripcion,
      monto: form.monto,
      tienda: form.tienda,
      ...(form.tipo === "Préstamo"
        ? { tasaAnualPct: form.tasaAnualPct, plazoCuotas: form.plazoCuotas, cuotaMensual: form.cuotaMensual, fechaInicio: form.fechaInicio }
        : {}),
    };
    setCapital((prev) => [...prev, entry]);
    setDialogOpen(false);
    setForm(emptyForm);
    toast.success("Capital registrado · guardado en este dispositivo");
  }

  function eliminarCapital(id: string) {
    setCapital((prev) => prev.filter((x) => x.id !== id));
    toast.success("Eliminado");
  }

  if (loadingPnl) {
    return <div className="p-8 space-y-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}</div>;
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold">Capital &amp; ROI</h2>
          <p className="text-xs text-muted-foreground mt-0.5">¿Ya recuperé mi inversión? · Guardado en este dispositivo</p>
        </div>
        <Button size="sm" onClick={() => { setForm(emptyForm); setDialogOpen(true); }}><Plus className="h-4 w-4 mr-1.5" /> Registrar capital</Button>
      </div>

      <div className="rounded-2xl p-6 text-white bg-gradient-to-br from-slate-900 to-indigo-950">
        <p className="text-[11px] font-bold tracking-wide opacity-75 uppercase">Retorno sobre capital invertido</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
          {hero.map(([l, v]) => (
            <div key={l} className="bg-white/10 rounded-lg p-3">
              <p className="text-[11px] opacity-85">{l}</p>
              <p className="text-lg font-bold mt-0.5">{v}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-sm">Capital registrado</CardTitle></CardHeader>
          <CardContent className="space-y-2.5">
            {capital.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Sin capital registrado todavía. Usa &quot;Registrar capital&quot; para agregar tu aporte inicial, un préstamo, etc.</p>
            ) : capital.map((c) => (
              <div key={c.id} className="flex items-center gap-3 rounded-lg border p-3">
                <span className="text-xl w-8 text-center shrink-0">{ICONOS[c.tipo]}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">{c.tipo}</p>
                  <p className="text-xs text-muted-foreground truncate">{c.descripcion} · {c.tienda}</p>
                </div>
                <div className="text-right shrink-0 flex items-center gap-2">
                  <p className="font-bold font-mono text-sm">{fmtMoney(c.monto)}</p>
                  <Button size="icon" variant="ghost" onClick={() => eliminarCapital(c.id)}>
                    <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Seguimiento de préstamo</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {!prestamo ? (
              <p className="text-sm text-muted-foreground text-center py-8">Sin préstamo registrado. Agrega uno con &quot;Registrar capital&quot; → tipo Préstamo (con tasa, plazo y cuota).</p>
            ) : (
              <>
                {[
                  ["Monto original", fmtMoney(prestamo.monto)],
                  [`Pagado (${pagadas} cuotas)`, fmtMoney(pagado)],
                  ["Saldo pendiente", fmtMoney(saldoPendiente)],
                  ["Próxima cuota", proxima ? `${fmtMoney(proxima.cuota)} · ${proxima.fecha}` : "—"],
                ].map(([l, v]) => (
                  <div key={l} className="flex justify-between border-b pb-2 text-sm">
                    <span className="text-muted-foreground">{l}</span>
                    <b className="font-mono">{v}</b>
                  </div>
                ))}
                <div>
                  <div className="flex justify-between text-xs font-medium mb-1.5">
                    <span>Progreso ({pagadas}/{prestamo.plazoCuotas} cuotas)</span>
                  </div>
                  <Progress value={prestamo.plazoCuotas ? (pagadas / prestamo.plazoCuotas) * 100 : 0} />
                </div>
                {proxima ? (
                  <Button className="w-full" onClick={pagarCuota}>
                    <Check className="h-4 w-4 mr-1.5" /> Pagar cuota {proxima.n} · {fmtMoney(proxima.cuota)}
                  </Button>
                ) : (
                  <div className="rounded-lg border bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30 p-3 text-sm text-emerald-700 dark:text-emerald-300">
                    ✅ Préstamo pagado completamente
                  </div>
                )}

                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1.5">Tabla de amortización</p>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>#</TableHead>
                          <TableHead>Fecha</TableHead>
                          <TableHead className="text-right">Cuota</TableHead>
                          <TableHead className="text-right">Capital</TableHead>
                          <TableHead className="text-right">Interés</TableHead>
                          <TableHead className="text-right">Saldo</TableHead>
                          <TableHead>Estado</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {cuotas.map((c) => (
                          <TableRow key={c.n} className={c.estado === "proxima" ? "bg-primary/5" : ""}>
                            <TableCell>{c.n}</TableCell>
                            <TableCell className="text-muted-foreground">{c.fecha}</TableCell>
                            <TableCell className="text-right font-mono">{fmtMoney(c.cuota)}</TableCell>
                            <TableCell className="text-right font-mono">{fmtMoney(c.capital)}</TableCell>
                            <TableCell className="text-right font-mono text-destructive">{fmtMoney(c.interes)}</TableCell>
                            <TableCell className="text-right font-mono">{fmtMoney(c.saldo)}</TableCell>
                            <TableCell>
                              <NivelPill nivel={c.estado === "pagada" ? "verde" : c.estado === "proxima" ? "ambar" : "azul"}>
                                {c.estado === "pagada" ? "Pagada" : c.estado === "proxima" ? "Próxima" : "Pendiente"}
                              </NivelPill>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Registrar capital</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Tipo</Label>
              <Select value={form.tipo} onValueChange={(v) => setForm((f) => ({ ...f, tipo: v as CapitalTipo }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TIPOS.map((t) => <SelectItem key={t} value={t} disabled={t === "Préstamo" && !!prestamo}>{t}{t === "Préstamo" && prestamo ? " (ya hay uno registrado)" : ""}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Descripción</Label>
              <Input value={form.descripcion} onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))} placeholder="Ej: Aporte inicial" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Tienda</Label>
                <Input value={form.tienda} onChange={(e) => setForm((f) => ({ ...f, tienda: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Monto S/</Label>
                <Input type="number" value={form.monto || ""} onChange={(e) => setForm((f) => ({ ...f, monto: Number(e.target.value) || 0 }))} />
              </div>
            </div>
            {form.tipo === "Préstamo" && (
              <div className="rounded-lg border p-3 space-y-3 bg-muted/30">
                <p className="text-xs font-semibold text-muted-foreground">Datos del préstamo (para generar la amortización)</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Tasa anual %</Label>
                    <Input type="number" value={form.tasaAnualPct || ""} onChange={(e) => setForm((f) => ({ ...f, tasaAnualPct: Number(e.target.value) || 0 }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Plazo (cuotas)</Label>
                    <Input type="number" value={form.plazoCuotas || ""} onChange={(e) => setForm((f) => ({ ...f, plazoCuotas: Number(e.target.value) || 0 }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Cuota mensual S/</Label>
                    <Input type="number" value={form.cuotaMensual || ""} onChange={(e) => setForm((f) => ({ ...f, cuotaMensual: Number(e.target.value) || 0 }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Fecha de inicio</Label>
                    <Input type="date" value={form.fechaInicio} onChange={(e) => setForm((f) => ({ ...f, fechaInicio: e.target.value }))} />
                  </div>
                </div>
              </div>
            )}
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
