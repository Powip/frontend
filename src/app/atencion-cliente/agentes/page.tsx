"use client";

import { useState } from "react";
import { DateRange } from "react-day-picker";
import { useAuth } from "@/contexts/AuthContext";
import { useAgentePerformance } from "@/hooks/useAgentePerformance";
import { AgentPerformanceCard } from "@/components/atencion-cliente/AgentPerformanceCard";
import { CcLeaderboard } from "@/components/atencion-cliente/cc-v2/CcLeaderboard";
import { HeaderConfig } from "@/components/header/HeaderConfig";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, Users } from "lucide-react";
import { isSuperadmin, hasAdminAccess } from "@/config/permissions.config";

/* ── helpers de fecha (sin date-fns) ──────────────────── */
function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function startOfPrevMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() - 1, 1);
}

function endOfPrevMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 0);
}

function subDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() - days);
  return d;
}

function formatDateRange(range: DateRange): string {
  if (!range.from) return "Seleccionar período";
  const opts: Intl.DateTimeFormatOptions = { day: "2-digit", month: "short", year: "numeric" };
  const from = range.from.toLocaleDateString("es-PE", opts);
  if (!range.to) return from;
  const to = range.to.toLocaleDateString("es-PE", opts);
  return `${from} – ${to}`;
}

/* ── presets ─────────────────────────────────────────── */
const PRESETS = [
  {
    label: "7D",
    getRange: () => ({ from: subDays(new Date(), 7), to: new Date() }),
  },
  {
    label: "15D",
    getRange: () => ({ from: subDays(new Date(), 15), to: new Date() }),
  },
  {
    label: "Este mes",
    getRange: () => ({ from: startOfMonth(new Date()), to: new Date() }),
  },
  {
    label: "Mes anterior",
    getRange: () => ({
      from: startOfPrevMonth(new Date()),
      to: endOfPrevMonth(new Date()),
    }),
  },
] as const;

export default function AgentesPage() {
  const { auth, selectedStoreId } = useAuth();
  const companyId = auth?.company?.id;

  const [range, setRange] = useState<DateRange>({
    from: startOfMonth(new Date()),
    to: new Date(),
  });
  const [calendarOpen, setCalendarOpen] = useState(false);

  const { data: agentes, isLoading } = useAgentePerformance(
    selectedStoreId,
    companyId,
    range,
  );

  if (!auth) return null;

  const currentUserId = auth.user.id;
  const mySelf = agentes?.find((a) => a.id === currentUserId);
  const isSupervisor = mySelf?.ccRol === "supervisor";
  const activosCount = agentes?.filter((a) => a.ccActivo).length ?? 0;
  const isAdmin =
    isSuperadmin(auth.user?.email) || hasAdminAccess(auth.user?.role);

  return (
    <div className="flex flex-col h-full">
      <HeaderConfig title="Gestión de Agentes CC" />

      <div className="flex-1 p-6 space-y-6 overflow-auto">
        {/* ── Selector de período ────────────────────── */}
        <div className="flex flex-wrap items-center gap-2">
          {PRESETS.map((preset) => (
            <Button
              key={preset.label}
              variant="outline"
              size="sm"
              onClick={() => setRange(preset.getRange())}
            >
              {preset.label}
            </Button>
          ))}

          <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="gap-2 min-w-[200px] justify-start"
              >
                <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{formatDateRange(range)}</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="range"
                selected={range}
                onSelect={(r) => {
                  if (r) {
                    setRange(r);
                    if (r.from && r.to) setCalendarOpen(false);
                  }
                }}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* ── Contador de agentes ────────────────────── */}
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Users className="size-4" />
          <span>
            {agentes?.length ?? 0} agente{agentes?.length !== 1 ? "s" : ""} registrados
            {" · "}
            {activosCount} activo{activosCount !== 1 ? "s" : ""} ahora
          </span>
        </div>

        {/* ── Grid de tarjetas ───────────────────────── */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-72 rounded-xl" />
            ))}
          </div>
        ) : !agentes?.length ? (
          <div className="flex flex-col items-center justify-center py-24 text-muted-foreground gap-2">
            <Users className="size-10 opacity-30" />
            <p className="text-sm">
              No hay agentes CC con rol Agente, Caller o Ventas en esta empresa.
            </p>
            <p className="text-xs">
              Asigná el rol correcto desde la gestión de usuarios.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {agentes.map((agente) => (
              <AgentPerformanceCard
                key={agente.id}
                agente={agente}
                currentUserId={currentUserId}
                isSupervisor={isSupervisor}
                storeId={selectedStoreId!}
              />
            ))}
          </div>
        )}

        {/* ── Leaderboard (solo admin/supervisor) ────── */}
        {(isAdmin || isSupervisor) && selectedStoreId && companyId && (
          <CcLeaderboard
            storeId={selectedStoreId}
            companyId={companyId}
            range={range}
          />
        )}
      </div>
    </div>
  );
}
