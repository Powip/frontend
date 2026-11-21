"use client";

import { AdvertisingCompanySpend } from "@/components/advertising/AdvertisingCompanySpend";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useAdminPeriod } from "@/contexts/AdminPeriodContext";
import { createGasto, deleteGasto, getGastos, updateGasto } from "@/api/Admin";
import { getOrdersByCompany } from "@/api/Ventas";
import { getProducts } from "@/api/Productos";
import { soloEntregados } from "../_lib/realData";
import { CategoriaGasto, ICreateGastoDto, IGastoOperativo } from "@/interfaces/IAdmin";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Pencil, Trash2, X } from "lucide-react";
import { toast } from "sonner";

const CATEGORIAS: { value: CategoriaGasto; label: string }[] = [
  { value: "PLANILLA", label: "Personal / Planilla" },
  { value: "HERRAMIENTAS", label: "Herramientas + Oficina" },
  { value: "PUBLICIDAD", label: "Publicidad" },
  { value: "COURIER_PROPIO", label: "Courier Propio" },
  { value: "OTRO", label: "Otro" },
];

// INVERSION es la compra de mercadería por prenda. No es gasto operativo:
// el costo de la prenda ya entra al COGS cuando se vende, así que no se
// suma a fijos/variables ni al P&L. Se muestra aparte, agrupado por prenda.
const INVERSION: { value: CategoriaGasto; label: string } = { value: "INVERSION", label: "Inversión (por prenda)" };
const CATEGORIAS_FORM = [...CATEGORIAS, INVERSION];

const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

function fmt(n: number) {
  return `S/ ${Number(n).toLocaleString("es-PE", { minimumFractionDigits: 2 })}`;
}

const emptyForm: ICreateGastoDto = { categoria: "OTRO", descripcion: "", monto: 0, mes: new Date().getMonth() + 1, anio: new Date().getFullYear() };

type Prenda = { id: string; name: string; sku?: string };

function BuscadorPrenda({ value, onChange }: { value: Prenda | null; onChange: (p: Prenda | null) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Prenda[]>([]);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) { setResults([]); return; }
    let cancel = false;
    setSearching(true);
    const t = setTimeout(() => {
      getProducts({ name: q })
        .then((items) => { if (!cancel) setResults(items.slice(0, 8).map((p) => ({ id: p.id, name: p.name, sku: p.sku }))); })
        .catch(() => { if (!cancel) setResults([]); })
        .finally(() => { if (!cancel) setSearching(false); });
    }, 300);
    return () => { cancel = true; clearTimeout(t); };
  }, [query]);

  if (value) {
    return (
      <div className="flex h-9 items-center justify-between gap-2 rounded-md border px-3 text-sm">
        <span className="truncate" title={value.name}>{value.name}</span>
        <button type="button" aria-label="Quitar prenda" className="text-muted-foreground hover:text-foreground" onClick={() => onChange(null)}>
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <Input
        placeholder="Buscar prenda…"
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && query.trim().length >= 2 && (
        <div className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-md border bg-popover shadow-md">
          {searching ? (
            <p className="px-3 py-2 text-xs text-muted-foreground">Buscando…</p>
          ) : results.length === 0 ? (
            <p className="px-3 py-2 text-xs text-muted-foreground">Sin resultados</p>
          ) : results.map((p) => (
            <button
              key={p.id}
              type="button"
              className="flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-muted"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { onChange(p); setQuery(""); setOpen(false); }}
            >
              <span>{p.name}</span>
              {p.sku && <span className="text-[11px] text-muted-foreground">{p.sku}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function GastosPage() {
  const { auth } = useAuth();
  const { fromDate, toDate } = useAdminPeriod();
  const [gastos, setGastos] = useState<IGastoOperativo[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<ICreateGastoDto>(emptyForm);
  const [costos, setCostos] = useState({ ventas: 0, cogs: 0 });
  const [loadingCostos, setLoadingCostos] = useState(true);

  const fetchGastos = useCallback(async () => {
    if (!auth?.company?.id || !auth?.accessToken) return;
    setLoading(true);
    try {
      setGastos(await getGastos(auth.company.id, fromDate, toDate, auth.accessToken));
    } catch {
      toast.error("Error al cargar gastos");
    } finally {
      setLoading(false);
    }
  }, [auth, fromDate, toDate]);

  useEffect(() => { fetchGastos(); }, [fetchGastos]);

  useEffect(() => {
    if (!auth?.company?.id) return;
    setLoadingCostos(true);
    getOrdersByCompany(auth.company.id, fromDate, toDate)
      .then((orders: any[]) => {
        const entregadas = soloEntregados(orders);
        const ventas = entregadas.reduce((s, o) => s + Number(o.grandTotal || 0), 0);
        const cogs = entregadas.reduce((s, o) => s + Number(o.costAmount || 0), 0);
        setCostos({ ventas, cogs });
      })
      .catch(() => toast.error("Error al cargar costos"))
      .finally(() => setLoadingCostos(false));
  }, [auth?.company?.id, fromDate, toDate]);

  const handleSubmit = async () => {
    if (!auth?.company?.id || !auth?.accessToken) return;
    try {
      if (editId) {
        await updateGasto(auth.company.id, editId, form, auth.accessToken);
        toast.success("Gasto actualizado");
      } else {
        await createGasto(auth.company.id, form, auth.accessToken);
        toast.success("Gasto registrado");
      }
      setShowForm(false); setEditId(null); setForm(emptyForm); fetchGastos();
    } catch { toast.error("Error al guardar gasto"); }
  };

  const handleEdit = (g: IGastoOperativo) => {
    setEditId(g.id);
    setForm({ categoria: g.categoria, descripcion: g.descripcion || "", monto: Number(g.monto), mes: g.mes, anio: g.anio, productId: g.productId ?? null, productName: g.productName ?? null });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!auth?.company?.id || !auth?.accessToken) return;
    try {
      await deleteGasto(auth.company.id, id, auth.accessToken);
      toast.success("Gasto eliminado"); fetchGastos();
    } catch { toast.error("Error al eliminar gasto"); }
  };

  const totalesPorCategoria = CATEGORIAS.map((cat) => ({
    ...cat,
    total: gastos.filter((g) => g.categoria === cat.value).reduce((s, g) => s + Number(g.monto), 0),
  }));

  const totalFijos = totalesPorCategoria
    .filter((c) => c.value === "PLANILLA" || c.value === "HERRAMIENTAS")
    .reduce((s, c) => s + c.total, 0);
  const totalVariables = totalesPorCategoria
    .filter((c) => c.value === "PUBLICIDAD" || c.value === "COURIER_PROPIO" || c.value === "OTRO")
    .reduce((s, c) => s + c.total, 0);
  const totalGeneral = totalFijos + totalVariables;
  const pctFijos = totalGeneral > 0 ? (totalFijos / totalGeneral) * 100 : 0;
  const pctVariables = totalGeneral > 0 ? (totalVariables / totalGeneral) * 100 : 0;
  const pctCogsSobreVentas = costos.ventas > 0 ? (costos.cogs / costos.ventas) * 100 : 0;
  const totalCostosYGastos = costos.cogs + totalGeneral;

  const gastosInversion = gastos.filter((g) => g.categoria === "INVERSION");
  const totalInversion = gastosInversion.reduce((s, g) => s + Number(g.monto), 0);
  const inversionPorPrenda = Object.values(
    gastosInversion.reduce<Record<string, { key: string; prenda: string; registros: number; total: number }>>((acc, g) => {
      const key = g.productId ?? "sin-prenda";
      const row = acc[key] ?? { key, prenda: g.productName || "Sin prenda", registros: 0, total: 0 };
      row.registros += 1;
      row.total += Number(g.monto);
      acc[key] = row;
      return acc;
    }, {}),
  ).sort((a, b) => b.total - a.total);
  const esInversion = form.categoria === "INVERSION";

  return (
    <div className="p-8 space-y-6">
      <AdvertisingCompanySpend from={fromDate} to={toDate} />
      <p className="text-sm text-muted-foreground">
        Estos indicadores usan registros manuales por conciliar.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card className="text-center">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground mb-1">Costo de mercadería vendida (COGS)</p>
            <p className="text-lg font-bold font-mono">{loadingCostos ? "…" : fmt(costos.cogs)}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">{loadingCostos ? "" : `${pctCogsSobreVentas.toFixed(1)}% sobre ventas entregadas`}</p>
          </CardContent>
        </Card>
        <Card className="text-center">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground mb-1">Gastos operativos</p>
            <p className="text-lg font-bold font-mono">{fmt(totalGeneral)}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Fijos + variables, ver detalle abajo</p>
          </CardContent>
        </Card>
        <Card className="text-center border-primary/40">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground mb-1">Total costos + gastos</p>
            <p className="text-lg font-bold font-mono">{loadingCostos ? "…" : fmt(totalCostosYGastos)}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">COGS + gastos operativos del periodo</p>
          </CardContent>
        </Card>
      </div>

      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Gastos operativos por categoría</p>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {totalesPorCategoria.map((cat) => (
          <Card key={cat.value} className="text-center">
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground mb-1">{cat.label}</p>
              <p className="text-lg font-bold font-mono">{fmt(cat.total)}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {showForm && (
        <Card>
          <CardHeader><CardTitle className="text-sm">{editId ? "Editar gasto" : "Registrar gasto"}</CardTitle></CardHeader>
          <CardContent className={`grid grid-cols-2 gap-3 ${esInversion ? "md:grid-cols-6" : "md:grid-cols-5"}`}>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground font-medium">Categoría</label>
              <Select
                value={form.categoria}
                onValueChange={(v) => setForm((f) => ({
                  ...f,
                  categoria: v as CategoriaGasto,
                  // La prenda solo aplica a INVERSION: al cambiar a otra categoría se desliga.
                  ...(v !== "INVERSION" && f.productId ? { productId: null, productName: null } : {}),
                }))}
              >
                <SelectTrigger><SelectValue placeholder="Seleccioná una" /></SelectTrigger>
                <SelectContent>{CATEGORIAS_FORM.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {esInversion && (
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground font-medium">Prenda (opcional)</label>
                <BuscadorPrenda
                  value={form.productId ? { id: form.productId, name: form.productName || "Prenda" } : null}
                  onChange={(p) => setForm((f) => ({ ...f, productId: p?.id ?? null, productName: p?.name ?? null }))}
                />
              </div>
            )}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground font-medium">Descripción</label>
              <Input placeholder="Ej: Planilla enero" value={form.descripcion} onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground font-medium">Monto (S/)</label>
              <Input type="number" placeholder="0.00" min={0} step="0.01" value={form.monto} onChange={(e) => setForm((f) => ({ ...f, monto: Number(e.target.value) }))} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground font-medium">Mes</label>
              <Select value={String(form.mes)} onValueChange={(v) => setForm((f) => ({ ...f, mes: Number(v) }))}>
                <SelectTrigger><SelectValue placeholder="Mes" /></SelectTrigger>
                <SelectContent>{MESES.map((m, i) => <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground font-medium opacity-0 select-none">Acción</label>
              <div className="flex gap-2">
                <Button onClick={handleSubmit} className="flex-1">{editId ? "Guardar" : "Registrar"}</Button>
                <Button variant="outline" onClick={() => { setShowForm(false); setEditId(null); setForm(emptyForm); }}>Cancelar</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm">Gastos — {fromDate} al {toDate}</CardTitle>
          {!showForm && <Button size="sm" onClick={() => setShowForm(true)}><Plus className="h-4 w-4 mr-1" /> Registrar gasto</Button>}
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Categoría</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead>Prenda</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {gastos.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No hay gastos registrados para este período</TableCell></TableRow>
                ) : gastos.map((g) => (
                  <TableRow key={g.id}>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <Badge variant="outline">{CATEGORIAS_FORM.find((c) => c.value === g.categoria)?.label ?? g.categoria}</Badge>
                        {g.source && g.source !== "manual" && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Auto</Badge>
                        )}
                        {g.recurrence && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground">{g.recurrence}</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">{g.descripcion || "—"}</TableCell>
                    <TableCell className="text-sm">{g.productName || <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell className="text-right font-mono font-semibold">{fmt(Number(g.monto))}</TableCell>
                    <TableCell>
                      <div className="flex gap-1 justify-end">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(g)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => handleDelete(g.id)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-semibold">Inversión por prenda</CardTitle>
          <span className="text-sm font-mono font-semibold">{fmt(totalInversion)}</span>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Compra de mercadería del período. No suma a gastos operativos ni a la utilidad: el costo de la prenda ya entra al COGS cuando se vende.
          </p>
          {inversionPorPrenda.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No hay inversión registrada para este período</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Prenda</TableHead>
                  <TableHead className="text-right">Registros</TableHead>
                  <TableHead className="text-right">Total invertido</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inversionPorPrenda.map((r) => (
                  <TableRow key={r.key}>
                    <TableCell className={r.key === "sin-prenda" ? "text-muted-foreground" : ""}>{r.prenda}</TableCell>
                    <TableCell className="text-right font-mono">{r.registros}</TableCell>
                    <TableCell className="text-right font-mono font-semibold">{fmt(r.total)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Fijos vs Variables</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex h-4 w-full overflow-hidden rounded-full bg-muted">
            <div className="bg-primary transition-all" style={{ width: `${pctFijos}%` }} />
            <div className="bg-amber-500 transition-all" style={{ width: `${pctVariables}%` }} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-primary shrink-0" />
                <span className="text-sm font-medium">Fijos</span>
                <span className="ml-auto text-xs text-muted-foreground font-mono">{pctFijos.toFixed(1)}%</span>
              </div>
              <p className="text-xl font-bold font-mono pl-5">{fmt(totalFijos)}</p>
              <div className="pl-5 space-y-1">
                {totalesPorCategoria
                  .filter((c) => c.value === "PLANILLA" || c.value === "HERRAMIENTAS")
                  .map((c) => (
                    <div key={c.value} className="flex justify-between text-xs text-muted-foreground">
                      <span>{c.label}</span>
                      <span className="font-mono">{fmt(c.total)}</span>
                    </div>
                  ))}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-amber-500 shrink-0" />
                <span className="text-sm font-medium">Variables</span>
                <span className="ml-auto text-xs text-muted-foreground font-mono">{pctVariables.toFixed(1)}%</span>
              </div>
              <p className="text-xl font-bold font-mono pl-5">{fmt(totalVariables)}</p>
              <div className="pl-5 space-y-1">
                {totalesPorCategoria
                  .filter((c) => c.value === "PUBLICIDAD" || c.value === "COURIER_PROPIO" || c.value === "OTRO")
                  .map((c) => (
                    <div key={c.value} className="flex justify-between text-xs text-muted-foreground">
                      <span>{c.label}</span>
                      <span className="font-mono">{fmt(c.total)}</span>
                    </div>
                  ))}
              </div>
            </div>
          </div>

          <div className="flex justify-between border-t pt-3 text-sm font-semibold">
            <span>Total gastos</span>
            <span className="font-mono">{fmt(totalGeneral)}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
