"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Sparkles } from "lucide-react";
import { useCierreDiaClosingDataDay, useCierreDiaDay, useSaveCierreDia } from "@/hooks/useCierreDia";
import { CierreDiaFormInput } from "@/interfaces/ICierreDia";
import { EMPTY_FUNNEL, formatCurrency, formatDate, FUNNEL_STATES, toEffectiveRecord } from "./cierreDiaUtils";

interface Props {
  storeId: string;
  date: string | null;
  onClose: () => void;
  onSaved?: () => void;
}

function toNumber(value: string): number {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

export function CcCierreDiaModal({ storeId, date, onClose, onSaved }: Props) {
  const open = !!date;
  const { data: manualRecord, isLoading: isLoadingManual } = useCierreDiaDay(storeId, date ?? "");
  const { data: closingData, isLoading: isLoadingClosing } = useCierreDiaClosingDataDay(storeId, date ?? "");
  const saveMutation = useSaveCierreDia(storeId);

  // Mientras esto carga (pedidos + upsells + costo por variante puede tardar
  // unos segundos) el formulario todavía no tiene nada para precargar — sin
  // este aviso parece que el auto-completado no funciona, cuando en realidad
  // solo está en camino.
  const isLoadingAuto = (isLoadingManual || isLoadingClosing) && !manualRecord;

  const autoDay = closingData?.byDay.find((d) => d.date === date);
  const effective = date ? toEffectiveRecord(storeId, date, manualRecord, autoDay) : undefined;

  const [form, setForm] = useState<CierreDiaFormInput>({
    ...EMPTY_FUNNEL,
    ingreso: 0,
    costo: 0,
    publiMeta: 0,
    publiTiktok: 0,
    publiGoogle: 0,
    upsells: 0,
  });

  // Precarga con lo guardado a mano si existe; si no, con lo autocompletado
  // desde los pedidos reales del día (embudo/ingreso/costo/upsells) — el
  // gasto publicitario siempre arranca en 0 porque nunca se autocompleta.
  useEffect(() => {
    if (!open) return;
    if (effective) {
      setForm({
        porConfirmar: effective.porConfirmar,
        contactado: effective.contactado,
        noContesta: effective.noContesta,
        confirmado: effective.confirmado,
        despachado: effective.despachado,
        entregado: effective.entregado,
        anulado: effective.anulado,
        ingreso: effective.ingreso,
        costo: effective.costo,
        publiMeta: effective.publiMeta,
        publiTiktok: effective.publiTiktok,
        publiGoogle: effective.publiGoogle,
        upsells: effective.upsells,
      });
    } else {
      setForm({
        ...EMPTY_FUNNEL,
        ingreso: 0,
        costo: 0,
        publiMeta: 0,
        publiTiktok: 0,
        publiGoogle: 0,
        upsells: 0,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, date, manualRecord, autoDay]);

  const publiTotal = form.publiMeta + form.publiTiktok + form.publiGoogle;
  const margenNeto = form.ingreso - form.costo - publiTotal;

  async function handleSave() {
    if (!date) return;
    try {
      await saveMutation.mutateAsync({ date, input: form });
      toast.success(`Cierre del ${formatDate(date)} guardado`);
      onSaved?.();
      onClose();
    } catch {
      toast.error("No se pudo guardar el cierre del día");
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>✏️ Ingresar / Editar datos del día</DialogTitle>
          <DialogDescription>
            Fecha: <b className="text-foreground">{date ? formatDate(date, { weekday: "long", day: "2-digit", month: "long", year: "numeric" }) : "—"}</b>
          </DialogDescription>
        </DialogHeader>

        {isLoadingAuto ? (
          <div className="flex items-center gap-2 rounded-lg bg-muted/60 border px-3 py-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
            Buscando pedidos reales del día para precargar el formulario...
          </div>
        ) : effective?.isAuto ? (
          <div className="flex items-start gap-2 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 px-3 py-2 text-xs text-blue-700 dark:text-blue-300">
            <Sparkles className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span>
              Precargado automáticamente desde los pedidos reales del día. Revisá los números y
              cargá el gasto publicitario antes de guardar.
            </span>
          </div>
        ) : !effective && open ? (
          <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
            No hay pedidos COD registrados para esta fecha — cargá los datos manualmente.
          </div>
        ) : null}

        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-teal-600 dark:text-teal-400 mb-2">
            📦 Embudo de pedidos
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {FUNNEL_STATES.map((s) => (
              <div key={s.key} className="flex flex-col gap-1">
                <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  {s.label}
                </Label>
                <Input
                  type="number"
                  min={0}
                  value={form[s.key] || ""}
                  placeholder="0"
                  onChange={(e) =>
                    setForm((f) => ({ ...f, [s.key]: toNumber(e.target.value) }))
                  }
                />
              </div>
            ))}
          </div>
        </div>

        <div className="pt-3 border-t">
          <p className="text-xs font-bold uppercase tracking-wide text-teal-600 dark:text-teal-400 mb-2">
            💰 Financiero
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="flex flex-col gap-1">
              <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Ingreso S/ (neto)
              </Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={form.ingreso || ""}
                placeholder="0.00"
                onChange={(e) => setForm((f) => ({ ...f, ingreso: toNumber(e.target.value) }))}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Costo de producto S/
              </Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={form.costo || ""}
                placeholder="0.00"
                onChange={(e) => setForm((f) => ({ ...f, costo: toNumber(e.target.value) }))}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Upsells (# pedidos)
              </Label>
              <Input
                type="number"
                min={0}
                value={form.upsells || ""}
                placeholder="0"
                onChange={(e) => setForm((f) => ({ ...f, upsells: toNumber(e.target.value) }))}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-[10px] uppercase tracking-wide text-blue-600 dark:text-blue-400">
                📘 Meta Ads S/
              </Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={form.publiMeta || ""}
                placeholder="0.00"
                onChange={(e) => setForm((f) => ({ ...f, publiMeta: toNumber(e.target.value) }))}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-[10px] uppercase tracking-wide text-green-600 dark:text-green-400">
                🎵 TikTok Ads S/
              </Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={form.publiTiktok || ""}
                placeholder="0.00"
                onChange={(e) => setForm((f) => ({ ...f, publiTiktok: toNumber(e.target.value) }))}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-[10px] uppercase tracking-wide text-amber-600 dark:text-amber-400">
                🔍 Google Ads S/
              </Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={form.publiGoogle || ""}
                placeholder="0.00"
                onChange={(e) => setForm((f) => ({ ...f, publiGoogle: toNumber(e.target.value) }))}
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 bg-muted/50 rounded-lg px-3 py-2 text-xs">
          <span className="text-muted-foreground">
            💡 Margen neto = Ingreso − Costo − (Meta + TikTok + Google)
          </span>
          <span className="font-bold text-teal-600 dark:text-teal-400 whitespace-nowrap">
            Total publi: {formatCurrency(publiTotal)} · Margen neto: {formatCurrency(margenNeto)}
          </span>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? "Guardando..." : "💾 Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
