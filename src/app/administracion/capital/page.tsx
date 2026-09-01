"use client";

/**
 * Capital & ROI — §14 doc técnica.
 *
 * CONECTADO A DATOS REALES: "Utilidad acumulada" y "Tiempo de recupero" del
 * hero salen de `useAdminYearPnl` (profit real acumulado del año en curso,
 * mismo agregado simplificado que usa Flujo de Caja — sin IGV/comisión
 * POWIP/merma).
 *
 * SIGUE MOCK / SIN DATO REAL: no existe `capital_entry` ni `prestamo_cuota`
 * en ningún microservicio (búsqueda en todo el repo sin resultados). La
 * lista de capital registrado y la tabla de amortización del préstamo
 * siguen siendo estado local desde `_mock/data.ts` — se pierden al recargar.
 */

import { useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useAdminYearPnl } from "../_lib/useMonthlyPnl";
import { AMORTIZACION_MOCK, CAPITAL_MOCK, type CapitalEntryMock, type CapitalTipo } from "../_mock/data";
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

export default function CapitalRoiPage() {
  const { auth } = useAuth();
  const companyId = auth?.company?.id ?? "";
  const token = auth?.accessToken ?? "";
  const storeIds = useMemo(() => (auth?.company?.stores ?? []).map((s) => s.id), [auth?.company?.stores]);
  const anio = new Date().getFullYear();
  const { meses, isLoading: loadingPnl } = useAdminYearPnl(companyId, anio, storeIds, token);

  const [capital, setCapital] = useState<CapitalEntryMock[]>(CAPITAL_MOCK);
  const [cuotas, setCuotas] = useState(AMORTIZACION_MOCK);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ tipo: TIPOS[0], descripcion: "", tienda: "Consolidado", monto: 0 });

  const mesesConDatos = meses.filter((m) => m.tieneDatos);
  const utilidadAcumulada = mesesConDatos.reduce((a, m) => a + m.profit, 0);
  const promedioMensual = mesesConDatos.length > 0 ? utilidadAcumulada / mesesConDatos.length : 0;

  const totalCapital = capital.reduce((a, c) => a + c.monto, 0);
  const roi = totalCapital > 0 ? (utilidadAcumulada / totalCapital) * 100 : 0;
  const mesesRecupero = promedioMensual > 0 && totalCapital > 0 ? totalCapital / promedioMensual : null;
  const hero = [
    ["Capital total invertido", fmtMoney(totalCapital)],
    ["Utilidad acumulada", fmtMoney(utilidadAcumulada)],
    ["ROI", fmtPct(roi)],
    ["Tiempo de recupero", mesesRecupero != null ? `${mesesRecupero.toFixed(1)} meses` : "—"],
  ];

  const pagadas = cuotas.filter((c) => c.estado === "pagada").length;
  const proxima = cuotas.find((c) => c.estado === "proxima");
  const pagado = cuotas.filter((c) => c.estado === "pagada").reduce((s, c) => s + c.cuota, 0);
  const saldoPendiente = cuotas.filter((c) => c.estado !== "pagada").reduce((s, c) => s + c.capital, 0);

  function pagarCuota() {
    const idx = cuotas.findIndex((c) => c.estado === "proxima");
    if (idx < 0) return;
    setCuotas((prev) => prev.map((c, i) => (i === idx ? { ...c, estado: "pagada" } : i === idx + 1 ? { ...c, estado: "proxima" } : c)));
    toast.success(`Cuota ${cuotas[idx].n} pagada · ${fmtMoney(cuotas[idx].cuota)}`);
  }

  function handleAdd() {
    if (!form.descripcion.trim() || form.monto <= 0) {
      toast.error("Completa descripción y monto");
      return;
    }
    setCapital((prev) => [...prev, { id: `cap-${Date.now()}`, tipo: form.tipo, descripcion: form.descripcion, monto: form.monto, tienda: form.tienda }]);
    setDialogOpen(false);
    setForm({ tipo: TIPOS[0], descripcion: "", tienda: "Consolidado", monto: 0 });
    toast.success("Capital registrado");
  }

  if (loadingPnl) {
    return <div className="p-8 space-y-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}</div>;
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold">Capital &amp; ROI</h2>
          <p className="text-xs text-muted-foreground mt-0.5">¿Ya recuperé mi inversión? · Capital propio · Préstamos · Retorno</p>
        </div>
        <Button size="sm" onClick={() => setDialogOpen(true)}><Plus className="h-4 w-4 mr-1.5" /> Registrar capital</Button>
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
            {capital.map((c) => (
              <div key={c.id} className="flex items-center gap-3 rounded-lg border p-3">
                <span className="text-xl w-8 text-center shrink-0">{ICONOS[c.tipo]}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">{c.tipo}</p>
                  <p className="text-xs text-muted-foreground truncate">{c.descripcion} · {c.tienda}</p>
                </div>
                <div className="text-right shrink-0 flex items-center gap-2">
                  <p className="font-bold font-mono text-sm">{fmtMoney(c.monto)}</p>
                  <Button size="icon" variant="ghost" onClick={() => setCapital((prev) => prev.filter((x) => x.id !== c.id))}>
                    <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Seguimiento préstamo BCP</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {[
              ["Monto original", fmtMoney(10000)],
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
                <span>Progreso ({pagadas}/12 cuotas)</span>
              </div>
              <Progress value={(pagadas / 12) * 100} />
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
          </CardContent>
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Registrar capital</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Tipo</Label>
              <Select value={form.tipo} onValueChange={(v) => setForm((f) => ({ ...f, tipo: v as CapitalTipo }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TIPOS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
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
