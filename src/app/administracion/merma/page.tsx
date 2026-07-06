"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useAdminPeriod } from "@/contexts/AdminPeriodContext";
import { useAdminShrinkageList, useAdminShrinkageSummary, useInvalidateAdminQueries } from "@/hooks/useAdminQueries";
import { createShrinkage } from "@/api/Admin";
import { IInventoryShrinkage } from "@/interfaces/IAdmin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";
import { Plus, Check, X, PackageX, DollarSign } from "lucide-react";
import { toast } from "sonner";

const SHRINKAGE_LABELS: Record<string, string> = {
  devolucion_irrecuperable: "Devolución irrecuperable",
  "daño_almacen": "Daño en almacén",
  envio_perdido_courier: "Envío perdido (courier)",
  descuento_forzado: "Descuento forzado",
  diferencia_inventario: "Diferencia de inventario",
  otro: "Otro",
};

const SHRINKAGE_TYPES = Object.entries(SHRINKAGE_LABELS);

function fmt(n: number) {
  return `S/ ${Number(n).toLocaleString("es-PE", { minimumFractionDigits: 2 })}`;
}

const emptyForm = {
  shrinkageType: "otro",
  quantity: 1,
  unitCost: 0,
  recoveredAmount: 0,
  notes: "",
};

export default function MermaPage() {
  const { auth } = useAuth();
  const { fromDate, toDate } = useAdminPeriod();
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const companyId = auth?.company?.id ?? "";
  const invalidate = useInvalidateAdminQueries();

  const { data: items = [], isLoading: loadingList } = useAdminShrinkageList(companyId, fromDate, toDate);
  const { data: summary, isLoading: loadingSummary } = useAdminShrinkageSummary(companyId, fromDate, toDate);

  const loading = loadingList || loadingSummary;

  const handleCreate = async () => {
    if (!companyId) return;
    if (form.quantity <= 0 || form.unitCost < 0) {
      toast.error("Cantidad debe ser > 0 y costo ≥ 0");
      return;
    }
    setSaving(true);
    try {
      await createShrinkage(
        companyId,
        {
          shrinkageType: form.shrinkageType,
          quantity: Number(form.quantity),
          unitCost: Number(form.unitCost),
          recoveredAmount: Number(form.recoveredAmount),
          notes: form.notes || undefined,
        },
      );
      toast.success("Merma registrada");
      setShowNew(false);
      setForm(emptyForm);
      invalidate(companyId, fromDate, toDate);
    } catch {
      toast.error("Error al registrar merma");
    } finally {
      setSaving(false);
    }
  };

  const netLoss = (item: IInventoryShrinkage) =>
    Number(item.quantity) * Number(item.unitCost) - Number(item.recoveredAmount);

  return (
    <div className="p-8 space-y-6">
      {/* KPI summary */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground flex items-center gap-2">
              <PackageX className="h-4 w-4" /> Unidades perdidas
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <p className="text-2xl font-bold font-mono">{summary?.totalUnidades ?? 0}</p>
            )}
            <p className="text-xs text-muted-foreground mt-1">{fromDate} al {toDate}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground flex items-center gap-2">
              <DollarSign className="h-4 w-4" /> Costo neto de merma
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <p className="text-2xl font-bold font-mono text-destructive">
                {fmt(summary?.costoEstimado ?? 0)}
              </p>
            )}
            <p className="text-xs text-muted-foreground mt-1">Costo bruto − recuperado</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabla de mermas */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm">Registros de merma — {fromDate} al {toDate}</CardTitle>
          {!showNew && (
            <Button size="sm" onClick={() => setShowNew(true)}>
              <Plus className="h-4 w-4 mr-1" /> Registrar merma
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          {showNew && (
            <div className="grid grid-cols-6 gap-2 p-3 border rounded-lg bg-muted/20">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground font-medium">Tipo</label>
                <Select
                  value={form.shrinkageType}
                  onValueChange={(v) => setForm((f) => ({ ...f, shrinkageType: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    {SHRINKAGE_TYPES.map(([val, label]) => (
                      <SelectItem key={val} value={val}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground font-medium">Unidades</label>
                <Input
                  type="number"
                  placeholder="Unidades"
                  min={1}
                  value={form.quantity}
                  onChange={(e) => setForm((f) => ({ ...f, quantity: Number(e.target.value) }))}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground font-medium">Costo unit. S/</label>
                <Input
                  type="number"
                  placeholder="0.00"
                  min={0}
                  step="0.01"
                  value={form.unitCost}
                  onChange={(e) => setForm((f) => ({ ...f, unitCost: Number(e.target.value) }))}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground font-medium">Recuperado S/</label>
                <Input
                  type="number"
                  placeholder="0.00"
                  min={0}
                  step="0.01"
                  value={form.recoveredAmount}
                  onChange={(e) => setForm((f) => ({ ...f, recoveredAmount: Number(e.target.value) }))}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground font-medium">Notas</label>
                <Input
                  placeholder="Opcional"
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground font-medium opacity-0 select-none">Acción</label>
                <div className="flex gap-1">
                  <Button size="sm" onClick={handleCreate} disabled={saving} className="flex-1">
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => { setShowNew(false); setForm(emptyForm); }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}

          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10" />)}
            </div>
          ) : (items as IInventoryShrinkage[]).length === 0 && !showNew ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Sin registros de merma para este período
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Unidades</TableHead>
                  <TableHead className="text-right">Costo unit.</TableHead>
                  <TableHead className="text-right">Costo bruto</TableHead>
                  <TableHead className="text-right">Recuperado</TableHead>
                  <TableHead className="text-right">Pérdida neta</TableHead>
                  <TableHead>Notas</TableHead>
                  <TableHead className="text-right">Fecha</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(items as IInventoryShrinkage[]).map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {SHRINKAGE_LABELS[item.shrinkageType] ?? item.shrinkageType}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono">{item.quantity}</TableCell>
                    <TableCell className="text-right font-mono">{fmt(item.unitCost)}</TableCell>
                    <TableCell className="text-right font-mono">
                      {fmt(Number(item.quantity) * Number(item.unitCost))}
                    </TableCell>
                    <TableCell className="text-right font-mono text-green-600">
                      {Number(item.recoveredAmount) > 0 ? fmt(item.recoveredAmount) : "—"}
                    </TableCell>
                    <TableCell className="text-right font-mono font-semibold text-destructive">
                      {fmt(netLoss(item))}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-40 truncate">
                      {item.notes ?? "—"}
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">
                      {new Date(item.createdAt).toLocaleDateString("es-PE")}
                    </TableCell>
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
