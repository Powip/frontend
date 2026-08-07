"use client";

import { useEffect, useMemo, useState } from "react";
import { es } from "date-fns/locale";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { toast } from "sonner";
import { CalendarDays, Loader2, Sparkles } from "lucide-react";
import {
  useCierreDiaClosingDataDay,
  useCierreDiaClosingDataRange,
  useCierreDiaDay,
  useCierreDiaMonth,
  useSaveCierreDia,
} from "@/hooks/useCierreDia";
import { CierreDiaFormInput } from "@/interfaces/ICierreDia";
import { EMPTY_FUNNEL, formatCurrency, formatDate, FUNNEL_STATES, todayISO, toEffectiveRecord } from "./cierreDiaUtils";

interface Props {
  storeId: string;
  date: string | null;
  onClose: () => void;
  onSaved?: () => void;
  /** Si se pasa, el calendario de "días sin cargar" puede saltar a otra fecha sin cerrar el modal. */
  onDateChange?: (date: string) => void;
}

function toNumber(value: string): number {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

/** Fecha local YYYY-MM-DD, evitando el corrimiento de un día que da `toISOString()` crudo. */
function toLocalISO(d: Date): string {
  const tz = d.getTimezoneOffset();
  return new Date(d.getTime() - tz * 60000).toISOString().slice(0, 10);
}

function lastDayOfMonth(monthStr: string): string {
  const [y, m] = monthStr.split("-").map(Number);
  const day = new Date(y, m, 0).getDate();
  return `${monthStr}-${String(day).padStart(2, "0")}`;
}

function daysInMonth(monthStr: string): string[] {
  const [y, m] = monthStr.split("-").map(Number);
  const total = new Date(y, m, 0).getDate();
  return Array.from({ length: total }, (_, i) => `${monthStr}-${String(i + 1).padStart(2, "0")}`);
}

export function CcCierreDiaModal({ storeId, date, onClose, onSaved, onDateChange }: Props) {
  const open = !!date;
  const { data: manualRecord, isLoading: isLoadingManual } = useCierreDiaDay(storeId, date ?? "");
  const { data: closingData, isLoading: isLoadingClosing } = useCierreDiaClosingDataDay(storeId, date ?? "");
  const saveMutation = useSaveCierreDia(storeId);

  // Mes que se está viendo en el calendario del popover — arranca en el mes
  // de `date` y solo cambia si el usuario navega el calendario (no depende
  // de la fecha que se está editando en el formulario).
  const [viewMonth, setViewMonth] = useState(() => (date ?? todayISO()).slice(0, 7));
  useEffect(() => {
    if (date) setViewMonth(date.slice(0, 7));
  }, [date]);

  const { data: monthManualRecords = [] } = useCierreDiaMonth(storeId, viewMonth);
  const { data: monthClosingData } = useCierreDiaClosingDataRange(
    storeId,
    `${viewMonth}-01`,
    lastDayOfMonth(viewMonth),
  );

  // Días del mes visible sin ningún dato (ni guardado a mano, ni pedidos
  // reales de Gestión COD) — el calendario los marca para que se puedan
  // regularizar sin tener que ir a buscarlos en Rango/Mes.
  const noCargadoDates = useMemo(() => {
    const manualByDate = new Map(monthManualRecords.map((r) => [r.date, r]));
    const autoByDate = new Map((monthClosingData?.byDay ?? []).map((d) => [d.date, d]));
    const today = todayISO();
    return daysInMonth(viewMonth)
      .filter((ds) => ds <= today)
      .filter((ds) => !toEffectiveRecord(storeId, ds, manualByDate.get(ds), autoByDate.get(ds)))
      .map((ds) => new Date(`${ds}T00:00:00`));
  }, [viewMonth, monthManualRecords, monthClosingData, storeId]);

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
          <div className="flex items-center justify-between gap-2">
            <DialogDescription>
              Fecha: <b className="text-foreground">{date ? formatDate(date, { weekday: "long", day: "2-digit", month: "long", year: "numeric" }) : "—"}</b>
            </DialogDescription>
            {onDateChange && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="relative h-7 shrink-0 gap-1.5 text-xs">
                    <CalendarDays className="h-3.5 w-3.5" />
                    Elegir otro día
                    {noCargadoDates.length > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white">
                        {noCargadoDates.length}
                      </span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar
                    mode="single"
                    locale={es}
                    month={new Date(`${viewMonth}-01T00:00:00`)}
                    onMonthChange={(d) => setViewMonth(toLocalISO(d).slice(0, 7))}
                    selected={date ? new Date(`${date}T00:00:00`) : undefined}
                    onSelect={(d) => d && onDateChange(toLocalISO(d))}
                    disabled={{ after: new Date() }}
                    modifiers={{ noCargado: noCargadoDates }}
                    modifiersClassNames={{
                      noCargado:
                        "relative after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:h-1 after:w-1 after:rounded-full after:bg-red-500",
                    }}
                  />
                  <div className="flex items-center gap-1.5 border-t px-3 py-2 text-[11px] text-muted-foreground">
                    <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                    Día sin datos cargados en Gestión COD
                  </div>
                </PopoverContent>
              </Popover>
            )}
          </div>
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
