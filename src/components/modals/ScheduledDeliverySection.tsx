"use client";
import { useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import axiosAuth from "@/lib/axiosAuth";
import { GATEWAY } from "@/lib/gateway";
import { toast } from "sonner";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Calendar } from "../ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { cn } from "@/lib/utils";
import { Check, Clock, Package, Loader2 } from "lucide-react";

interface Props {
  orderId: string;
  callbackAt: string | null | undefined;
  callStatus: string | null | undefined;
  onUpdated: () => void;
}

export default function ScheduledDeliverySection({
  orderId,
  callbackAt,
  callStatus,
  onUpdated,
}: Props) {
  const [scheduledDate, setScheduledDate] = useState<Date | undefined>(
    undefined,
  );
  const [isRescheduling, setIsRescheduling] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);

  const isConfirmed = callStatus === "CONFIRMED";

  const formattedDate = callbackAt
    ? (() => {
        const raw = format(
          new Date(callbackAt),
          "EEEE d 'de' MMMM · HH:mm",
          { locale: es },
        );
        return raw.charAt(0).toUpperCase() + raw.slice(1);
      })()
    : null;

  const handleConfirmDelivery = async () => {
    if (isConfirming) return;
    setIsConfirming(true);
    try {
      await axiosAuth.patch(
        `${GATEWAY.ventas}/order-header/${orderId}`,
        { callStatus: "CONFIRMED", status: "LLAMADO" },
      );
      toast.success("Entrega confirmada");
      onUpdated();
    } catch {
      toast.error("Error al confirmar la entrega");
    } finally {
      setIsConfirming(false);
    }
  };

  const handleReschedule = async () => {
    if (!scheduledDate || isRescheduling) return;
    setIsRescheduling(true);
    try {
      await axiosAuth.patch(
        `${GATEWAY.ventas}/order-header/${orderId}`,
        {
          callStatus: "SCHEDULED",
          callbackAt: scheduledDate.toISOString(),
        },
      );
      toast.success(
        `Entrega reagendada para ${format(scheduledDate, "dd/MM HH:mm")}`,
      );
      setScheduledDate(undefined);
      onUpdated();
    } catch {
      toast.error("Error al reagendar la entrega");
    } finally {
      setIsRescheduling(false);
    }
  };

  // ── Estado: entrega confirmada ──────────────────────────────────────────────
  if (isConfirmed) {
    return (
      <div className="border border-border rounded-lg p-4">
        <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg p-4 text-center">
          <div className="flex items-center justify-center gap-2 text-green-700 dark:text-green-400">
            <Check className="h-5 w-5" />
            <span className="font-semibold">ENTREGA CONFIRMADA</span>
          </div>
          <p className="text-sm text-green-600 dark:text-green-400 mt-1">
            El pedido fue entregado correctamente
          </p>
        </div>
      </div>
    );
  }

  // ── Estado: pendiente / sin fecha ───────────────────────────────────────────
  return (
    <div className="border border-border rounded-lg p-4 space-y-3">
      <h3 className="font-semibold">Gestión de Entrega</h3>

      {/* Card indigo con fecha prominente */}
      <div className="rounded-lg bg-indigo-50 dark:bg-indigo-950 border border-indigo-200 dark:border-indigo-800 px-4 py-3 flex items-center gap-3">
        <Package className="h-5 w-5 text-indigo-600 dark:text-indigo-400 shrink-0" />
        <div>
          <p className="text-[10px] uppercase font-bold tracking-wider text-indigo-500 dark:text-indigo-400">
            Entrega programada
          </p>
          {formattedDate ? (
            <p className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">
              {formattedDate}
            </p>
          ) : (
            <p className="text-sm text-amber-600 dark:text-amber-400 font-medium">
              Sin fecha asignada
            </p>
          )}
        </div>
      </div>

      {/* Botón confirmar — solo si hay fecha */}
      {formattedDate && (
        <Button
          className="w-full bg-green-600 hover:bg-green-700"
          onClick={handleConfirmDelivery}
          disabled={isConfirming}
        >
          {isConfirming ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <Check className="h-4 w-4 mr-2" />
              CONFIRMAR ENTREGA
            </>
          )}
        </Button>
      )}

      {/* Re-agendar / asignar fecha */}
      <div className="pt-2 border-t border-dashed border-muted-foreground/20">
        <label className="text-xs font-medium text-muted-foreground mb-2 block">
          {formattedDate ? "Re-agendar fecha de entrega" : "Asignar fecha de entrega"}
        </label>
        <div className="flex gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "flex-1 justify-start text-left font-normal h-9",
                  !scheduledDate && "text-muted-foreground",
                )}
              >
                <Clock className="mr-2 h-4 w-4" />
                {scheduledDate
                  ? format(scheduledDate, "dd/MM/yyyy HH:mm", { locale: es })
                  : "Seleccionar fecha y hora"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <div className="p-1">
                <Calendar
                  mode="single"
                  selected={scheduledDate}
                  onSelect={(date) => {
                    if (date) {
                      const current = scheduledDate || new Date();
                      date.setHours(current.getHours());
                      date.setMinutes(current.getMinutes());
                      setScheduledDate(date);
                    }
                  }}
                  initialFocus
                  locale={es}
                />
              </div>
              <div className="p-3 border-t border-border">
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold uppercase text-muted-foreground">
                    Hora de entrega
                  </label>
                  <Input
                    type="time"
                    className="h-9 text-sm"
                    value={
                      scheduledDate ? format(scheduledDate, "HH:mm") : ""
                    }
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val) {
                        const [hours, minutes] = val.split(":").map(Number);
                        const next = new Date(scheduledDate || new Date());
                        next.setHours(hours);
                        next.setMinutes(minutes);
                        setScheduledDate(next);
                      }
                    }}
                  />
                </div>
              </div>
            </PopoverContent>
          </Popover>
          <Button
            onClick={handleReschedule}
            disabled={!scheduledDate || isRescheduling}
            className="bg-amber-600 hover:bg-amber-700 h-9"
          >
            {isRescheduling ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Guardar"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
