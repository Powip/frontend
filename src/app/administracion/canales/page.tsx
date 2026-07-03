"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useAdminPeriod } from "@/contexts/AdminPeriodContext";
import { getOrdersByCompany } from "@/api/Ventas";
import {
  getMarketplaceConfigs,
  createMarketplaceConfig,
  updateMarketplaceConfig,
  deleteMarketplaceConfig,
} from "@/api/Admin";
import { ICanalVenta, IMarketplaceConfig } from "@/interfaces/IAdmin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Pencil, Trash2, Check, X } from "lucide-react";
import { toast } from "sonner";

function fmt(n: number) { return `S/ ${Number(n).toLocaleString("es-PE", { minimumFractionDigits: 0 })}`; }

const emptyConfig = { channel: "", commissionPct: 0, fixedCharge: 0, shippingFee: 0 };

export default function CanalesPage() {
  const { auth } = useAuth();
  const { fromDate, toDate } = useAdminPeriod();
  const [canales, setCanales] = useState<ICanalVenta[]>([]);
  const [configs, setConfigs] = useState<IMarketplaceConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState(emptyConfig);
  const [editForm, setEditForm] = useState<Partial<IMarketplaceConfig>>({});

  const fetchConfigs = useCallback(async () => {
    if (!auth?.company?.id || !auth?.accessToken) return;
    const data = await getMarketplaceConfigs(auth.company.id, auth.accessToken);
    setConfigs(data);
    return data;
  }, [auth]);

  useEffect(() => {
    if (!auth?.accessToken || !auth?.company?.id) return;
    setLoading(true);

    Promise.all([
      getOrdersByCompany(auth.company.id, fromDate, toDate),
      getMarketplaceConfigs(auth.company.id, auth.accessToken),
    ]).then(([orders, cfgs]) => {
      setConfigs(cfgs as IMarketplaceConfig[]);
      const feeMap: Record<string, number> = {};
      (cfgs as IMarketplaceConfig[]).filter((c) => c.isActive).forEach((c) => {
        feeMap[c.channel.toUpperCase()] = Number(c.commissionPct) / 100;
      });

      const entregadas = (orders as any[]).filter((o) => o.status === "ENTREGADO");
      const totalVentas = entregadas.reduce((s: number, o: any) => s + Number(o.grandTotal), 0);
      const grouped: Record<string, { ventas: number; unidades: number }> = {};
      for (const o of entregadas) {
        const canal = ((o.salesChannel || "OTRO") as string).toUpperCase();
        if (!grouped[canal]) grouped[canal] = { ventas: 0, unidades: 0 };
        grouped[canal].ventas += Number(o.grandTotal);
        grouped[canal].unidades += o.itemCount || 1;
      }
      const result: ICanalVenta[] = Object.entries(grouped).map(([nombre, vals]) => {
        const feePct = feeMap[nombre] ?? 0;
        const fee = vals.ventas * feePct;
        return { nombre, ventas: vals.ventas, unidades: vals.unidades, fee, neto: vals.ventas - fee, porcentaje: totalVentas > 0 ? (vals.ventas / totalVentas) * 100 : 0 };
      }).sort((a, b) => b.ventas - a.ventas);
      setCanales(result);
    }).finally(() => setLoading(false));
  }, [auth, fromDate, toDate]);

  const handleCreate = async () => {
    if (!auth?.company?.id || !auth?.accessToken || !form.channel.trim()) return;
    try {
      await createMarketplaceConfig(auth.company.id, { ...form, commissionPct: Number(form.commissionPct), fixedCharge: Number(form.fixedCharge), shippingFee: Number(form.shippingFee) }, auth.accessToken);
      toast.success("Canal configurado");
      setShowNew(false);
      setForm(emptyConfig);
      fetchConfigs();
    } catch { toast.error("Error al guardar"); }
  };

  const handleUpdate = async (id: string) => {
    if (!auth?.company?.id || !auth?.accessToken) return;
    try {
      await updateMarketplaceConfig(auth.company.id, id, { commissionPct: Number(editForm.commissionPct), fixedCharge: Number(editForm.fixedCharge), shippingFee: Number(editForm.shippingFee) }, auth.accessToken);
      toast.success("Actualizado");
      setEditingId(null);
      fetchConfigs();
    } catch { toast.error("Error al actualizar"); }
  };

  const handleDelete = async (id: string) => {
    if (!auth?.company?.id || !auth?.accessToken) return;
    try {
      await deleteMarketplaceConfig(auth.company.id, id, auth.accessToken);
      toast.success("Eliminado");
      fetchConfigs();
    } catch { toast.error("Error al eliminar"); }
  };

  return (
    <div className="p-8 space-y-6">
      {/* Analytics de canales */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Canales & Marketplaces — {fromDate} al {toDate}</CardTitle></CardHeader>
        <CardContent>
          {loading ? <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Canal</TableHead>
                  <TableHead className="text-right">Ventas</TableHead>
                  <TableHead className="text-right">Unidades</TableHead>
                  <TableHead className="text-right">Fee canal</TableHead>
                  <TableHead className="text-right">Neto</TableHead>
                  <TableHead className="text-right">% del total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {canales.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No hay datos para este período</TableCell></TableRow>
                ) : canales.map((c) => (
                  <TableRow key={c.nombre}>
                    <TableCell><Badge variant="outline">{c.nombre}</Badge></TableCell>
                    <TableCell className="text-right font-mono">{fmt(c.ventas)}</TableCell>
                    <TableCell className="text-right font-mono">{c.unidades}</TableCell>
                    <TableCell className="text-right font-mono text-destructive">{c.fee > 0 ? `−${fmt(c.fee)}` : "—"}</TableCell>
                    <TableCell className="text-right font-mono font-semibold">{fmt(c.neto)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-primary rounded-full" style={{ width: `${c.porcentaje}%` }} />
                        </div>
                        <span className="text-xs font-mono w-10">{c.porcentaje.toFixed(1)}%</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Configuración de fees */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm">Configuración de fees por canal</CardTitle>
          {!showNew && (
            <Button size="sm" onClick={() => setShowNew(true)}>
              <Plus className="h-4 w-4 mr-1" /> Agregar canal
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          {showNew && (
            <div className="grid grid-cols-5 gap-2 p-3 border rounded-lg bg-muted/20">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground font-medium">Canal</label>
                <Input placeholder="Ej: MERCADOLIBRE" value={form.channel} onChange={(e) => setForm((f) => ({ ...f, channel: e.target.value.toUpperCase() }))} />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground font-medium">Comisión %</label>
                <Input type="number" placeholder="0.0" value={form.commissionPct} onChange={(e) => setForm((f) => ({ ...f, commissionPct: Number(e.target.value) }))} />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground font-medium">Cargo fijo (S/)</label>
                <Input type="number" placeholder="0.00" value={form.fixedCharge} onChange={(e) => setForm((f) => ({ ...f, fixedCharge: Number(e.target.value) }))} />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground font-medium">Fee envío (S/)</label>
                <Input type="number" placeholder="0.00" value={form.shippingFee} onChange={(e) => setForm((f) => ({ ...f, shippingFee: Number(e.target.value) }))} />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground font-medium opacity-0 select-none">Acción</label>
                <div className="flex gap-1">
                  <Button size="sm" onClick={handleCreate} className="flex-1"><Check className="h-4 w-4" /></Button>
                  <Button size="sm" variant="outline" onClick={() => { setShowNew(false); setForm(emptyConfig); }}><X className="h-4 w-4" /></Button>
                </div>
              </div>
            </div>
          )}

          {configs.length === 0 && !showNew ? (
            <p className="text-sm text-muted-foreground text-center py-4">Sin configuración de fees. Los fees del P&L serán S/ 0.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Canal</TableHead>
                  <TableHead className="text-right">Comisión %</TableHead>
                  <TableHead className="text-right">Cargo fijo</TableHead>
                  <TableHead className="text-right">Fee envío</TableHead>
                  <TableHead className="text-right">Estado</TableHead>
                  <TableHead className="w-20" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {configs.map((c) => (
                  <TableRow key={c.id}>
                    {editingId === c.id ? (
                      <>
                        <TableCell><Badge variant="outline">{c.channel}</Badge></TableCell>
                        <TableCell className="text-right"><Input type="number" className="w-24 ml-auto text-right" value={editForm.commissionPct ?? c.commissionPct} onChange={(e) => setEditForm((f) => ({ ...f, commissionPct: Number(e.target.value) }))} /></TableCell>
                        <TableCell className="text-right"><Input type="number" className="w-24 ml-auto text-right" value={editForm.fixedCharge ?? c.fixedCharge} onChange={(e) => setEditForm((f) => ({ ...f, fixedCharge: Number(e.target.value) }))} /></TableCell>
                        <TableCell className="text-right"><Input type="number" className="w-24 ml-auto text-right" value={editForm.shippingFee ?? c.shippingFee} onChange={(e) => setEditForm((f) => ({ ...f, shippingFee: Number(e.target.value) }))} /></TableCell>
                        <TableCell />
                        <TableCell>
                          <div className="flex gap-1 justify-end">
                            <Button variant="ghost" size="icon" onClick={() => handleUpdate(c.id)}><Check className="h-4 w-4 text-green-600" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => setEditingId(null)}><X className="h-4 w-4" /></Button>
                          </div>
                        </TableCell>
                      </>
                    ) : (
                      <>
                        <TableCell><Badge variant="outline">{c.channel}</Badge></TableCell>
                        <TableCell className="text-right font-mono">{Number(c.commissionPct).toFixed(1)}%</TableCell>
                        <TableCell className="text-right font-mono">{fmt(c.fixedCharge)}</TableCell>
                        <TableCell className="text-right font-mono">{fmt(c.shippingFee)}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant={c.isActive ? "default" : "secondary"}>{c.isActive ? "Activo" : "Inactivo"}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1 justify-end">
                            <Button variant="ghost" size="icon" onClick={() => { setEditingId(c.id); setEditForm({ commissionPct: c.commissionPct, fixedCharge: c.fixedCharge, shippingFee: c.shippingFee }); }}><Pencil className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => handleDelete(c.id)}><Trash2 className="h-4 w-4" /></Button>
                          </div>
                        </TableCell>
                      </>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
