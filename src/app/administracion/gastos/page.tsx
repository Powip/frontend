"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useAdminPeriod } from "@/contexts/AdminPeriodContext";
import { createGasto, deleteGasto, getGastos, updateGasto } from "@/api/Admin";
import { CategoriaGasto, ICreateGastoDto, IGastoOperativo } from "@/interfaces/IAdmin";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

const CATEGORIAS: { value: CategoriaGasto; label: string }[] = [
  { value: "PLANILLA", label: "Personal / Planilla" },
  { value: "HERRAMIENTAS", label: "Herramientas + Oficina" },
  { value: "PUBLICIDAD", label: "Publicidad" },
  { value: "COURIER_PROPIO", label: "Courier Propio" },
  { value: "OTRO", label: "Otro" },
];

const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

function fmt(n: number) {
  return `S/ ${Number(n).toLocaleString("es-PE", { minimumFractionDigits: 2 })}`;
}

const emptyForm: ICreateGastoDto = { categoria: "OTRO", descripcion: "", monto: 0, mes: new Date().getMonth() + 1, anio: new Date().getFullYear() };

export default function GastosPage() {
  const { auth } = useAuth();
  const { fromDate, toDate } = useAdminPeriod();
  const [gastos, setGastos] = useState<IGastoOperativo[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<ICreateGastoDto>(emptyForm);

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
    setForm({ categoria: g.categoria, descripcion: g.descripcion || "", monto: Number(g.monto), mes: g.mes, anio: g.anio });
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

  return (
    <div className="p-8 space-y-6">
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
          <CardContent className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground font-medium">Categoría</label>
              <Select value={form.categoria} onValueChange={(v) => setForm((f) => ({ ...f, categoria: v as CategoriaGasto }))}>
                <SelectTrigger><SelectValue placeholder="Seleccioná una" /></SelectTrigger>
                <SelectContent>{CATEGORIAS.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
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
                  <TableHead className="text-right">Monto</TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {gastos.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">No hay gastos registrados para este período</TableCell></TableRow>
                ) : gastos.map((g) => (
                  <TableRow key={g.id}>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <Badge variant="outline">{CATEGORIAS.find((c) => c.value === g.categoria)?.label ?? g.categoria}</Badge>
                        {g.source && g.source !== "manual" && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Auto</Badge>
                        )}
                        {g.recurrence && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground">{g.recurrence}</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">{g.descripcion || "—"}</TableCell>
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
