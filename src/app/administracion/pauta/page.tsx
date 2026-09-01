"use client";

/**
 * Pauta por canal → atribución a producto — §8 doc técnica.
 *
 * CONECTADO A DATOS REALES: las ventas por producto dentro de cada canal
 * (`ventasPorProductoEnCanal`) salen de `OrderItem` real (sku, productName,
 * quantity, subtotal) de pedidos ENTREGADO del periodo del topbar.
 *
 * SIGUE MOCK / SIN DATO REAL:
 * - La inversión en sí (`pauta_registro`/`pauta_linea`, §20 doc) no existe
 *   en ningún servicio — se registra en estado local (`pautaState`) y se
 *   pierde al recargar, igual que "Por Liquidar" en Operaciones.
 * - Atribución por categoría: no implementada — `OrderItem` no trae
 *   categoría (vive en ms-products, sin endpoint expuesto acá). Solo hay
 *   nivel producto + "General del canal".
 * - Canales: usa el `SalesChannel` real (7 valores), no los 8 canales
 *   finos del doc (sin TikTok/Falabella/Ripley/Web-COD por separado).
 */

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useAdminPeriod } from "@/contexts/AdminPeriodContext";
import { getOrdersByCompany } from "@/api/Ventas";
import { CANALES_REALES, ventasPorProductoEnCanal, type CanalReal } from "../_lib/realData";
import { computeCanal, confianzaLabel } from "../_lib/pauta";
import type { PautaLinea, PautaLineaTipo } from "../_mock/data";
import { fmtMoney, fmtPct } from "../_lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type GrupoFiltro = "todos" | CanalReal["grupo"];
const STALE = 5 * 60 * 1000;

interface LineaForm {
  tipo: PautaLineaTipo;
  ref: string;
  monto: number;
}

export default function PautaPorCanalPage() {
  const { auth } = useAuth();
  const { fromDate, toDate } = useAdminPeriod();

  const companyId = auth?.company?.id ?? "";
  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["admin-pauta-orders", companyId, fromDate, toDate],
    queryFn: () => getOrdersByCompany(companyId, fromDate, toDate),
    enabled: !!companyId,
    staleTime: STALE,
  });

  const [pautaState, setPautaState] = useState<Record<string, PautaLinea[]>>({});
  const [grupo, setGrupo] = useState<GrupoFiltro>("todos");
  const [canalSeleccionado, setCanalSeleccionado] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogCanalId, setDialogCanalId] = useState(CANALES_REALES[0].id);
  const [dialogTotal, setDialogTotal] = useState(0);
  const [dialogLineas, setDialogLineas] = useState<LineaForm[]>([]);

  const ventasPorCanal = useMemo(() => {
    const map: Record<string, ReturnType<typeof ventasPorProductoEnCanal>> = {};
    for (const c of CANALES_REALES) map[c.id] = ventasPorProductoEnCanal(orders as any[], c.id);
    return map;
  }, [orders]);

  const canalesFiltrados = CANALES_REALES.filter((c) => grupo === "todos" || c.grupo === grupo);

  const computos = useMemo(
    () =>
      canalesFiltrados
        .map((c) => ({ canal: c, calc: computeCanal(c.id, pautaState[c.id] ?? [], ventasPorCanal[c.id] ?? []) }))
        .filter((o) => o.calc.total > 0 || o.calc.ventasTotales > 0),
    [canalesFiltrados, pautaState, ventasPorCanal],
  );

  const totales = computos.reduce(
    (a, o) => ({ inv: a.inv + o.calc.total, ven: a.ven + o.calc.ventasTotales, unds: a.unds + o.calc.unidadesTotales, dir: a.dir + o.calc.directoTotal }),
    { inv: 0, ven: 0, unds: 0, dir: 0 },
  );
  const roasProm = totales.inv > 0 ? totales.ven / totales.inv : 0;
  const cpvProm = totales.unds > 0 ? totales.inv / totales.unds : 0;
  const pctDirecto = totales.inv > 0 ? (totales.dir / totales.inv) * 100 : 0;

  const activo = canalSeleccionado ?? (computos[0]?.canal.id ?? null);
  const drill = activo
    ? computos.find((o) => o.canal.id === activo) ?? { canal: CANALES_REALES.find((c) => c.id === activo)!, calc: computeCanal(activo, pautaState[activo] ?? [], ventasPorCanal[activo] ?? []) }
    : null;

  function openDialog(canalId?: string) {
    const id = canalId ?? dialogCanalId;
    const lineas = (pautaState[id] ?? []).filter((l) => l.tipo !== "gen");
    const total = (pautaState[id] ?? []).reduce((a, l) => a + l.monto, 0);
    setDialogCanalId(id);
    setDialogTotal(total);
    setDialogLineas(lineas.map((l) => ({ tipo: l.tipo, ref: l.ref, monto: l.monto })));
    setDialogOpen(true);
  }

  const productosDelCanalDialog = ventasPorCanal[dialogCanalId] ?? [];
  const dialogDirecto = dialogLineas.reduce((a, l) => a + (l.monto || 0), 0);
  const dialogGeneral = dialogTotal - dialogDirecto;
  const dialogCuadra = dialogGeneral >= 0;

  function updateLinea(i: number, patch: Partial<LineaForm>) {
    setDialogLineas((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  function handleSave() {
    if (!dialogCuadra) {
      toast.error("Las líneas superan el total invertido");
      return;
    }
    const lineas: PautaLinea[] = dialogLineas.filter((l) => l.monto > 0).map((l) => ({ tipo: l.tipo, ref: l.ref, monto: l.monto }));
    if (dialogGeneral > 0) lineas.push({ tipo: "gen", ref: "General del canal", monto: Math.round(dialogGeneral) });
    setPautaState((prev) => ({ ...prev, [dialogCanalId]: lineas }));
    setCanalSeleccionado(dialogCanalId);
    setDialogOpen(false);
    toast.success(`Inversión registrada · ${fmtMoney(dialogTotal)} (no persiste — se pierde al recargar)`);
  }

  if (isLoading) {
    return <div className="p-8 space-y-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}</div>;
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold">Pauta por canal</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Ventas por producto: reales · Inversión: registro manual, no persiste</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="inline-flex bg-muted rounded-lg p-1 gap-1">
            {([["todos", "Consolidado"], ["ecommerce", "Ecommerce"], ["marketplace", "Marketplace"]] as [GrupoFiltro, string][]).map(([v, lbl]) => (
              <button key={v} onClick={() => { setGrupo(v); setCanalSeleccionado(null); }} className={cn("px-3 py-1.5 rounded-md text-xs font-semibold", grupo === v ? "bg-background shadow-sm" : "text-muted-foreground")}>{lbl}</button>
            ))}
          </div>
          <Button size="sm" onClick={() => openDialog()}><Plus className="h-4 w-4 mr-1.5" /> Registrar inversión</Button>
        </div>
      </div>

      <div className="rounded-lg border bg-amber-50/60 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30 p-3.5 text-xs text-amber-800 dark:text-amber-300 flex gap-2.5">
        <span>🎯</span>
        <p>La inversión que registres acá vive solo en esta sesión (sin backend todavía). Las ventas por producto sí son reales, del periodo elegido en el topbar.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Inversión total" valor={fmtMoney(totales.inv)} sub="registrada en esta sesión" />
        <KpiCard label="ROAS promedio" valor={totales.inv > 0 ? `${roasProm.toFixed(1)}×` : "—"} sub="ventas recon. ÷ inversión" tone={roasProm >= 4 ? "verde" : roasProm >= 3 ? "ambar" : totales.inv > 0 ? "rojo" : undefined} />
        <KpiCard label="CPV neto" valor={totales.inv > 0 ? fmtMoney(cpvProm, 2) : "—"} sub="inversión ÷ unidades" tone={totales.inv === 0 ? undefined : cpvProm <= 18 ? "verde" : cpvProm <= 22 ? "ambar" : "rojo"} />
        <KpiCard label="% inversión directa" valor={totales.inv > 0 ? fmtPct(pctDirecto, 0) : "—"} sub={totales.inv > 0 ? `${fmtPct(100 - pctDirecto, 0)} prorrateado` : "sin inversión registrada"} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Ventas reales e inversión registrada por canal <span className="text-xs font-normal text-muted-foreground">clic en un canal para ver el detalle por producto</span></CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Canal</TableHead>
                <TableHead>Grupo</TableHead>
                <TableHead className="text-right">Inversión</TableHead>
                <TableHead className="text-right">Ventas recon.</TableHead>
                <TableHead className="text-right">CPV</TableHead>
                <TableHead className="text-right">ROAS</TableHead>
                <TableHead className="text-right">% directo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {computos.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Sin ventas ni inversión en este grupo para el periodo elegido.</TableCell></TableRow>
              ) : computos.map(({ canal, calc }) => {
                const pctDir = calc.total > 0 ? (calc.directoTotal / calc.total) * 100 : 0;
                return (
                  <TableRow key={canal.id} className={cn("cursor-pointer", activo === canal.id && "bg-primary/5")} onClick={() => setCanalSeleccionado(canal.id)}>
                    <TableCell className="font-semibold">{canal.nombre}</TableCell>
                    <TableCell><Badge variant="outline" className="text-[10px]">{canal.grupo === "ecommerce" ? "Ecommerce" : "Marketplace"}</Badge></TableCell>
                    <TableCell className="text-right font-mono">{fmtMoney(calc.total)}</TableCell>
                    <TableCell className="text-right font-mono">{fmtMoney(calc.ventasTotales)}</TableCell>
                    <TableCell className="text-right font-mono">{calc.total > 0 ? fmtMoney(calc.cpv, 2) : "—"}</TableCell>
                    <TableCell className={cn("text-right font-mono font-semibold", calc.total === 0 ? "" : calc.roas >= 4 ? "text-emerald-600" : calc.roas >= 3 ? "text-amber-600" : "text-destructive")}>
                      {calc.total > 0 ? `${calc.roas.toFixed(1)}×` : "—"}
                    </TableCell>
                    <TableCell className="text-right font-mono">{calc.total > 0 ? fmtPct(pctDir, 0) : "—"}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {drill && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm">Detalle de {drill.canal.nombre} — ventas por producto (real) + inversión atribuida</CardTitle>
            <Button size="sm" variant="outline" onClick={() => openDialog(drill.canal.id)}>Editar inversión</Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {drill.calc.total > 0 && (
              <div className="rounded-lg border bg-blue-50/60 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/30 p-3 text-xs text-blue-800 dark:text-blue-300">
                Inversión del canal {fmtMoney(drill.calc.total)} = <b>{fmtMoney(drill.calc.directoTotal)} directo</b> + <b>{fmtMoney(drill.calc.general)} General prorrateado</b>.
              </div>
            )}
            {drill.calc.productos.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Sin ventas de producto en este canal para el periodo.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Producto</TableHead>
                    <TableHead className="text-right">Ventas</TableHead>
                    <TableHead className="text-right">Unidades</TableHead>
                    <TableHead className="text-right">Directo</TableHead>
                    <TableHead className="text-right">Prorrateo</TableHead>
                    <TableHead className="text-right">Inv. atribuida</TableHead>
                    <TableHead className="text-right">CPV</TableHead>
                    <TableHead className="text-right">ROAS</TableHead>
                    <TableHead>Confianza</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...drill.calc.productos].sort((a, b) => b.ventas - a.ventas).map((p) => {
                    const label = confianzaLabel(p.confianza);
                    return (
                      <TableRow key={p.sku}>
                        <TableCell className="font-semibold">{p.nombre}<br /><span className="text-[10px] text-muted-foreground font-normal">{p.sku}</span></TableCell>
                        <TableCell className="text-right font-mono">{fmtMoney(p.ventas)}</TableCell>
                        <TableCell className="text-right font-mono">{p.unidades}</TableCell>
                        <TableCell className="text-right font-mono">{p.directo ? fmtMoney(p.directo) : "—"}</TableCell>
                        <TableCell className="text-right font-mono text-muted-foreground">{p.prorrateoGeneral ? fmtMoney(p.prorrateoGeneral) : "—"}</TableCell>
                        <TableCell className="text-right font-mono font-semibold">{p.atribuido ? fmtMoney(p.atribuido) : "—"}</TableCell>
                        <TableCell className="text-right font-mono">{p.atribuido ? fmtMoney(p.cpv, 2) : "—"}</TableCell>
                        <TableCell className={cn("text-right font-mono font-semibold", p.atribuido && p.roas >= 3 ? "text-emerald-600" : "text-amber-600")}>{p.atribuido ? `${p.roas.toFixed(1)}×` : "—"}</TableCell>
                        <TableCell>{p.atribuido > 0 ? <Badge variant={label === "Directo" ? "default" : "outline"} className="text-[10px]">{label}</Badge> : <span className="text-xs text-muted-foreground">Sin inversión</span>}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Registrar inversión de pauta</DialogTitle>
            <DialogDescription>No persiste todavía — se guarda solo en esta sesión. Se reparte en líneas por producto · el resto va a &quot;General&quot;.</DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Canal de venta</Label>
              <Select value={dialogCanalId} onValueChange={(v) => openDialog(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CANALES_REALES.map((c) => <SelectItem key={c.id} value={c.id}>{c.nombre} · {c.grupo === "ecommerce" ? "Ecommerce" : "Marketplace"}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Inversión total S/</Label>
              <Input type="number" value={dialogTotal || ""} onChange={(e) => setDialogTotal(Number(e.target.value) || 0)} placeholder="0" />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <Label className="text-xs">¿A qué producto se destinó? <span className="text-[10px] text-muted-foreground">(solo productos con ventas reales en este canal)</span></Label>
            <Button
              size="sm"
              variant="outline"
              disabled={productosDelCanalDialog.length === 0}
              onClick={() => setDialogLineas((p) => [...p, { tipo: "prod", ref: productosDelCanalDialog[0]?.sku ?? "", monto: 0 }])}
            >
              <Plus className="h-3.5 w-3.5 mr-1" /> Agregar línea
            </Button>
          </div>

          <div className="space-y-2">
            {dialogLineas.map((l, i) => (
              <div key={i} className="flex gap-1.5 items-center">
                <Select value={l.ref} onValueChange={(v) => updateLinea(i, { ref: v })}>
                  <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {productosDelCanalDialog.map((p) => <SelectItem key={p.sku} value={p.sku}>{p.nombre}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Input type="number" className="w-24 font-mono" value={l.monto || ""} onChange={(e) => updateLinea(i, { monto: Number(e.target.value) || 0 })} placeholder="S/" />
                <Button size="icon" variant="ghost" onClick={() => setDialogLineas((p) => p.filter((_, idx) => idx !== i))}><Trash2 className="h-4 w-4 text-muted-foreground" /></Button>
              </div>
            ))}
            {productosDelCanalDialog.length === 0 && (
              <p className="text-xs text-muted-foreground">Este canal no tiene ventas de producto reales en el periodo elegido — solo puedes registrar el monto general.</p>
            )}
          </div>

          <div className="rounded-lg border bg-muted/40 p-3 space-y-1.5 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Líneas directas (producto)</span><b className="font-mono">{fmtMoney(dialogDirecto)}</b></div>
            <div className={cn("flex justify-between", !dialogCuadra && "text-destructive")}>
              <span className={dialogCuadra ? "text-muted-foreground" : ""}>General del canal (resto, se prorratea)</span>
              <b className="font-mono">{dialogCuadra ? fmtMoney(dialogGeneral) : "sobrepasa el total"}</b>
            </div>
            <div className={cn("flex justify-between border-t pt-1.5 font-bold", dialogCuadra ? "text-emerald-600" : "text-destructive")}>
              <span>{dialogCuadra ? "✓ Cuadra con el total del canal" : "⚠ Las líneas superan el total"}</span>
              <span className="font-mono">{fmtMoney(dialogTotal)}</span>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave}>Guardar inversión</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function KpiCard({ label, valor, sub, tone }: { label: string; valor: string; sub: string; tone?: "verde" | "ambar" | "rojo" }) {
  const color = tone === "verde" ? "text-emerald-600" : tone === "ambar" ? "text-amber-600" : tone === "rojo" ? "text-destructive" : "text-foreground";
  return (
    <Card>
      <CardContent className="pt-4">
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">{label}</p>
        <p className={cn("text-2xl font-bold font-mono mt-1", color)}>{valor}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
      </CardContent>
    </Card>
  );
}
