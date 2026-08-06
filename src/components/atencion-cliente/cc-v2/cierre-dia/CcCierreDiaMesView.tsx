"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { AlertTriangle, Pencil, Trash2, Eye } from "lucide-react";
import { useCierreDiaClosingDataRange, useCierreDiaMonth, useDeleteCierreDia } from "@/hooks/useCierreDia";
import { toast } from "sonner";
import { CcCierreDiaProductTable } from "./CcCierreDiaProductTable";
import { CcCierreDiaInnerTabs } from "./CcCierreDiaInnerTabs";
import {
  computeMetrics, EMPTY_PRODUCT_TOTALS, formatCurrency, formatDate, formatPct,
} from "./cierreDiaUtils";

interface Props {
  storeId: string;
  monthStr: string; // YYYY-MM
  onRegularizar: (date: string) => void;
  onVerDia: (date: string) => void;
}

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const TABS = [
  { key: "resumen", label: "📊 Resumen" },
  { key: "cpv", label: "💰 CPV Día a Día" },
  { key: "productos", label: "📦 Por Producto" },
  { key: "categorias", label: "🏷️ Por Categoría" },
] as const;

function lastDayOfMonth(monthStr: string): string {
  const [y, m] = monthStr.split("-").map(Number);
  const day = new Date(y, m, 0).getDate();
  return `${monthStr}-${String(day).padStart(2, "0")}`;
}

export function CcCierreDiaMesView({ storeId, monthStr, onRegularizar, onVerDia }: Props) {
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("resumen");
  const { data: records = [], isLoading } = useCierreDiaMonth(storeId, monthStr);
  const deleteMutation = useDeleteCierreDia(storeId);

  const [y, m] = monthStr.split("-").map(Number);
  const mesLabel = `${MESES[(m ?? 1) - 1]} ${y}`;

  const totals = useMemo(() => {
    let total = 0, confirmados = 0, entregados = 0, anulados = 0, ingreso = 0, publi = 0, margenNeto = 0, upsells = 0;
    records.forEach((r) => {
      const met = computeMetrics(r);
      total += met.total;
      confirmados += r.confirmado + r.despachado + r.entregado;
      entregados += r.entregado;
      anulados += r.anulado;
      ingreso += r.ingreso;
      publi += met.publi;
      margenNeto += met.margenNeto;
      upsells += r.upsells;
    });
    return { total, confirmados, entregados, anulados, ingreso, publi, margenNeto, upsells };
  }, [records]);

  async function handleDelete(date: string) {
    await deleteMutation.mutateAsync(date);
    toast.success("Registro eliminado");
  }

  return (
    <div className="space-y-4">
      <h3 className="text-base font-extrabold">
        Resumen Mensual · <span className="text-teal-600 dark:text-teal-400">{mesLabel}</span>
      </h3>

      <CcCierreDiaInnerTabs tabs={TABS} active={tab} onChange={setTab} />

      {tab === "resumen" && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <StatCard label="📦 Ingresados" value={totals.total.toLocaleString("es-PE")} sub={`${records.length} días registrados`} />
            <StatCard
              label="✅ Tasa confirm."
              value={formatPct(totals.total ? (totals.confirmados / totals.total) * 100 : 0)}
              sub={`${totals.confirmados} conf+desp+entreg`}
              valueClass="text-emerald-600 dark:text-emerald-400"
            />
            <StatCard
              label="💵 Ingreso total"
              value={formatCurrency(totals.ingreso)}
              sub={`Publi: ${formatCurrency(totals.publi)}`}
              valueClass="text-teal-600 dark:text-teal-400"
            />
            <StatCard
              label="📈 Margen neto"
              value={formatCurrency(totals.margenNeto)}
              sub={`${formatPct(totals.ingreso ? (totals.margenNeto / totals.ingreso) * 100 : 0)} promedio`}
              valueClass="text-emerald-600 dark:text-emerald-400"
            />
            <StatCard
              label="🛍 Upsells"
              value={String(totals.upsells)}
              sub="pedidos con producto adicional"
              valueClass="text-violet-600 dark:text-violet-400"
              className="border-violet-200 dark:border-violet-800 bg-violet-50/50 dark:bg-violet-950/20"
            />
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle className="text-sm">Historial de días guardados</CardTitle>
                <p className="text-xs text-muted-foreground">{records.length} días registrados · {mesLabel}</p>
              </div>
              <Button size="sm" onClick={() => onRegularizar(`${monthStr}-01`)}>
                + Agregar / regularizar día
              </Button>
            </CardHeader>
            <CardContent className="px-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead className="text-center">Ingresados</TableHead>
                      <TableHead className="text-center">Confirm.</TableHead>
                      <TableHead className="text-center">Entregados</TableHead>
                      <TableHead className="text-center">Anulados</TableHead>
                      <TableHead className="text-center">% Confirm.</TableHead>
                      <TableHead className="text-right">Ingreso S/</TableHead>
                      <TableHead className="text-right">Margen Neto S/</TableHead>
                      <TableHead className="text-right">% Neto</TableHead>
                      <TableHead className="text-center">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow>
                        <TableCell colSpan={10} className="text-center py-6 text-muted-foreground">Cargando...</TableCell>
                      </TableRow>
                    ) : records.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={10} className="text-center py-6 text-muted-foreground">No hay días guardados.</TableCell>
                      </TableRow>
                    ) : (
                      records.map((r) => {
                        const met = computeMetrics(r);
                        return (
                          <TableRow key={r.date}>
                            <TableCell className="font-medium">{formatDate(r.date, { weekday: "short", day: "2-digit", month: "short" })}</TableCell>
                            <TableCell className="text-center font-bold">{met.total}</TableCell>
                            <TableCell className="text-center">{r.confirmado + r.despachado + r.entregado}</TableCell>
                            <TableCell className="text-center text-green-700 dark:text-green-400">{r.entregado}</TableCell>
                            <TableCell className="text-center text-red-600 dark:text-red-400">{r.anulado}</TableCell>
                            <TableCell className="text-center text-emerald-600 dark:text-emerald-400 font-semibold">{formatPct(met.tasaConfirmacion)}</TableCell>
                            <TableCell className="text-right font-semibold">{formatCurrency(r.ingreso)}</TableCell>
                            <TableCell className="text-right font-semibold text-emerald-600 dark:text-emerald-400">{formatCurrency(met.margenNeto)}</TableCell>
                            <TableCell className="text-right font-semibold">{formatPct(met.pctMargenNeto)}</TableCell>
                            <TableCell>
                              <div className="flex items-center justify-center gap-1">
                                <Button variant="ghost" size="icon" className="h-7 w-7" title="Ver" onClick={() => onVerDia(r.date)}>
                                  <Eye className="h-3.5 w-3.5" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7" title="Editar" onClick={() => onRegularizar(r.date)}>
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-600" title="Eliminar">
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle className="flex items-center gap-2">
                                        <AlertTriangle className="h-5 w-5 text-red-500" />
                                        ¿Eliminar cierre del día?
                                      </AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Vas a eliminar el registro guardado del{" "}
                                        <strong>{formatDate(r.date, { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}</strong>.
                                        Esta acción no se puede deshacer.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                      <AlertDialogAction
                                        className="bg-red-600 hover:bg-red-700"
                                        onClick={() => handleDelete(r.date)}
                                      >
                                        Sí, eliminar
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {tab === "cpv" && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">💰 Inversión publicitaria · Día a día</CardTitle>
            <p className="text-xs text-muted-foreground">{mesLabel}</p>
          </CardHeader>
          <CardContent className="px-0">
            {records.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">No hay días guardados este mes.</div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead className="text-right text-blue-600 dark:text-blue-400">📘 Meta S/</TableHead>
                      <TableHead className="text-right text-green-600 dark:text-green-400">🎵 TikTok S/</TableHead>
                      <TableHead className="text-right text-amber-600 dark:text-amber-400">🔍 Google S/</TableHead>
                      <TableHead className="text-right">Total Publi S/</TableHead>
                      <TableHead className="text-right">Mg. Neto S/</TableHead>
                      <TableHead className="text-center">Datos</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {records.map((r) => {
                      const met = computeMetrics(r);
                      const hasPlatform = r.publiMeta > 0 || r.publiTiktok > 0 || r.publiGoogle > 0;
                      return (
                        <TableRow key={r.date}>
                          <TableCell className="font-medium">{formatDate(r.date, { weekday: "short", day: "2-digit", month: "short" })}</TableCell>
                          <TableCell className="text-right text-blue-600 dark:text-blue-400 font-semibold">{r.publiMeta > 0 ? formatCurrency(r.publiMeta) : "—"}</TableCell>
                          <TableCell className="text-right text-green-600 dark:text-green-400 font-semibold">{r.publiTiktok > 0 ? formatCurrency(r.publiTiktok) : "—"}</TableCell>
                          <TableCell className="text-right text-amber-600 dark:text-amber-400 font-semibold">{r.publiGoogle > 0 ? formatCurrency(r.publiGoogle) : "—"}</TableCell>
                          <TableCell className="text-right font-semibold">{formatCurrency(met.publi)}</TableCell>
                          <TableCell className="text-right font-semibold text-emerald-600 dark:text-emerald-400">{formatCurrency(met.margenNeto)}</TableCell>
                          <TableCell className="text-center">
                            {hasPlatform ? (
                              <Badge variant="outline" className="text-emerald-600 border-emerald-300">✓ Completo</Badge>
                            ) : (
                              <Badge variant="outline" className="text-amber-600 border-amber-300">Sin detalle</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {tab === "productos" && (
        <CcCierreDiaMesProductos storeId={storeId} monthStr={monthStr} mesLabel={mesLabel} />
      )}

      {tab === "categorias" && (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            <Badge variant="outline" className="mb-2">Próximamente</Badge>
            <p>
              El rendimiento por categoría no está disponible: el backend de productos no expone la
              categoría por variante todavía. Mirá la pestaña &quot;Por Producto&quot; mientras tanto.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function CcCierreDiaMesProductos({
  storeId, monthStr, mesLabel,
}: { storeId: string; monthStr: string; mesLabel: string }) {
  const startDate = `${monthStr}-01`;
  const endDate = lastDayOfMonth(monthStr);
  const { data, isLoading, isError } = useCierreDiaClosingDataRange(storeId, startDate, endDate);
  return (
    <CcCierreDiaProductTable
      rows={data?.rows ?? []}
      totals={data?.totals ?? EMPTY_PRODUCT_TOTALS}
      isLoading={isLoading}
      isError={isError}
      subtitle={`${mesLabel} · ${data?.rows.length ?? 0} producto(s)`}
    />
  );
}

function StatCard({
  label, value, sub, valueClass, className,
}: { label: string; value: string; sub: string; valueClass?: string; className?: string }) {
  return (
    <Card className={className}>
      <CardContent className="py-3 px-3.5">
        <p className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground mb-1">{label}</p>
        <p className={`text-xl font-extrabold ${valueClass ?? ""}`}>{value}</p>
        <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>
      </CardContent>
    </Card>
  );
}
