"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { AgentePerformanceKpis } from "@/interfaces/IOrder";
import { toggleAgenteCcStatus, toggleMiCcStatus } from "@/services/agentesService";

interface Props {
  agente: AgentePerformanceKpis;
  currentUserId: string;
  isSupervisor: boolean;
  storeId: string;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: "PEN",
    minimumFractionDigits: 2,
  }).format(value);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function AgentPerformanceCard({
  agente,
  currentUserId,
  isSupervisor,
  storeId,
}: Props) {
  const [loading, setLoading] = useState(false);
  const queryClient = useQueryClient();

  const isOwnCard = agente.id === currentUserId;
  const canToggle = isOwnCard || isSupervisor;

  async function handleToggle(checked: boolean) {
    if (!canToggle) return;
    setLoading(true);
    try {
      if (isOwnCard) {
        await toggleMiCcStatus({ ccActivo: checked });
      } else {
        await toggleAgenteCcStatus(agente.id, { ccActivo: checked });
      }
      await queryClient.invalidateQueries({ queryKey: ["cc-agentes-kpis", storeId] });
      toast.success(`Agente ${checked ? "activado" : "desactivado"}`);
    } catch {
      toast.error("No se pudo cambiar el estado del agente");
    } finally {
      setLoading(false);
    }
  }

  /* ── barras del embudo: anchos relativos a asignados ─── */
  const base = agente.asignados > 0 ? agente.asignados : 1;
  const barWidths = {
    asignados: 100,
    contactados: clamp((agente.contactados / base) * 100, 0, 100),
    confirmados: clamp((agente.confirmados / base) * 100, 0, 100),
    entregados: clamp((agente.entregados / base) * 100, 0, 100),
  };

  return (
    <Card className="relative flex flex-col gap-0">
      {/* ── Header ──────────────────────────────────────── */}
      <CardHeader className="pb-3 flex flex-row items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold truncate">{agente.nombre ?? "—"}</p>
          <p className="text-xs text-muted-foreground truncate">{agente.email ?? "—"}</p>
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          {agente.ccRol && (
            <Badge variant={agente.ccRol === "supervisor" ? "default" : "secondary"}>
              {agente.ccRol}
            </Badge>
          )}
          {canToggle ? (
            <Switch
              checked={agente.ccActivo}
              disabled={loading}
              onCheckedChange={handleToggle}
              aria-label={agente.ccActivo ? "Desactivar agente" : "Activar agente"}
            />
          ) : (
            <Badge variant={agente.ccActivo ? "default" : "outline"}>
              {agente.ccActivo ? "Activo" : "Inactivo"}
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-4 pt-0">
        {/* ── Fila 1: embudo absoluto + % ─────────────── */}
        <div className="grid grid-cols-4 gap-2 text-center">
          {/* Asignados */}
          <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 p-2">
            <p className="text-2xl font-bold text-slate-700 dark:text-slate-200">
              {agente.asignados}
            </p>
            <p className="text-xs text-muted-foreground leading-tight">Asignados</p>
          </div>

          {/* Contactados */}
          <div className="rounded-lg bg-blue-50 dark:bg-blue-950/30 p-2">
            <div className="flex items-start justify-center gap-1">
              <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">
                {agente.contactados}
              </p>
              <span className="text-[10px] text-blue-500 dark:text-blue-300 mt-1 font-medium">
                {agente.pctContactados.toFixed(1)}%
              </span>
            </div>
            <p className="text-xs text-muted-foreground leading-tight">Contactados</p>
          </div>

          {/* Confirmados */}
          <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/30 p-2">
            <div className="flex items-start justify-center gap-1">
              <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">
                {agente.confirmados}
              </p>
              <span className="text-[10px] text-emerald-500 dark:text-emerald-300 mt-1 font-medium">
                {agente.pctConfirmados.toFixed(1)}%
              </span>
            </div>
            <p className="text-xs text-muted-foreground leading-tight">Confirmados</p>
          </div>

          {/* Entregados */}
          <div className="rounded-lg bg-violet-50 dark:bg-violet-950/30 p-2">
            <div className="flex items-start justify-center gap-1">
              <p className="text-2xl font-bold text-violet-700 dark:text-violet-400">
                {agente.entregados}
              </p>
              <span className="text-[10px] text-violet-500 dark:text-violet-300 mt-1 font-medium">
                {agente.pctEntregados.toFixed(1)}%
              </span>
            </div>
            <p className="text-xs text-muted-foreground leading-tight">Entregados</p>
          </div>
        </div>

        {/* ── Fila 2: financiero ──────────────────────── */}
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/30 p-3">
            <p className="text-xs text-muted-foreground mb-1">Mis ventas confirmadas</p>
            <p className="text-lg font-bold text-emerald-700 dark:text-emerald-400 truncate">
              {formatCurrency(agente.ventasConfirmadas)}
            </p>
          </div>
          <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 p-3">
            <p className="text-xs text-muted-foreground mb-1">Ticket promedio</p>
            <p className="text-lg font-bold text-amber-700 dark:text-amber-400 truncate">
              {formatCurrency(agente.ticketPromedio)}
            </p>
          </div>
        </div>

        {/* ── Fila 3: barras de embudo ─────────────────── */}
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
            Mi Embudo
          </p>

          {/* Asignados */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 dark:text-slate-400 w-20 shrink-0">
              Asignados
            </span>
            <div className="flex-1 h-4 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-slate-400 dark:bg-slate-500 rounded-full transition-all duration-500"
                style={{ width: `${agente.asignados > 0 ? barWidths.asignados : 0}%` }}
              />
            </div>
            <span className="text-xs font-medium text-slate-600 dark:text-slate-300 w-6 text-right">
              {agente.asignados}
            </span>
          </div>

          {/* Contactados */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-blue-500 dark:text-blue-400 w-20 shrink-0">
              Contactados
            </span>
            <div className="flex-1 h-4 bg-blue-100 dark:bg-blue-900/30 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-400 dark:bg-blue-500 rounded-full transition-all duration-500"
                style={{ width: `${agente.asignados > 0 ? barWidths.contactados : 0}%` }}
              />
            </div>
            <span className="text-xs font-medium text-blue-600 dark:text-blue-300 w-6 text-right">
              {agente.contactados}
            </span>
          </div>

          {/* Confirmados */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-emerald-500 dark:text-emerald-400 w-20 shrink-0">
              Confirmados
            </span>
            <div className="flex-1 h-4 bg-emerald-100 dark:bg-emerald-900/30 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-400 dark:bg-emerald-500 rounded-full transition-all duration-500"
                style={{ width: `${agente.asignados > 0 ? barWidths.confirmados : 0}%` }}
              />
            </div>
            <span className="text-xs font-medium text-emerald-600 dark:text-emerald-300 w-6 text-right">
              {agente.confirmados}
            </span>
          </div>

          {/* Entregados */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-violet-500 dark:text-violet-400 w-20 shrink-0">
              Entregados
            </span>
            <div className="flex-1 h-4 bg-violet-100 dark:bg-violet-900/30 rounded-full overflow-hidden">
              <div
                className="h-full bg-violet-400 dark:bg-violet-500 rounded-full transition-all duration-500"
                style={{ width: `${agente.asignados > 0 ? barWidths.entregados : 0}%` }}
              />
            </div>
            <span className="text-xs font-medium text-violet-600 dark:text-violet-300 w-6 text-right">
              {agente.entregados}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
