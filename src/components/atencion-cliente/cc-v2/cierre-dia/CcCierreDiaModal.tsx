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
import { useCierreDiaDay, useSaveCierreDia } from "@/hooks/useCierreDia";
import { CierreDiaFormInput } from "@/interfaces/ICierreDia";
import { EMPTY_FUNNEL, formatCurrency, formatDate, FUNNEL_STATES } from "./cierreDiaUtils";

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
  const { data: existing } = useCierreDiaDay(storeId, date ?? "");
  const saveMutation = useSaveCierreDia(storeId);

  const [form, setForm] = useState<CierreDiaFormInput>({
    ...EMPTY_FUNNEL,
    ingreso: 0,
    costo: 0,
    publiMeta: 0,
    publiTiktok: 0,
    publiGoogle: 0,
    upsells: 0,
  });

  useEffect(() => {
    if (!open) return;
    if (existing) {
      setForm({
        porConfirmar: existing.porConfirmar,
        contactado: existing.contactado,
        noContesta: existing.noContesta,
        confirmado: existing.confirmado,
        despachado: existing.despachado,
        entregado: existing.entregado,
        anulado: existing.anulado,
        ingreso: existing.ingreso,
        costo: existing.costo,
        publiMeta: existing.publiMeta,
        publiTiktok: existing.publiTiktok,
        publiGoogle: existing.publiGoogle,
        upsells: existing.upsells,
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
  }, [open, existing]);

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
