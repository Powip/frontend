"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { AgenteConKpis } from "@/interfaces/IOrder";
import { toggleAgenteCcStatus, toggleMiCcStatus } from "@/services/agentesService";

interface Props {
  agente: AgenteConKpis;
  currentUserId: string;
  isSupervisor: boolean;
  accessToken: string;
  storeId: string;
}

export function AgenteCard({ agente, currentUserId, isSupervisor, accessToken, storeId }: Props) {
  const [loading, setLoading] = useState(false);
  const queryClient = useQueryClient();

  const isOwnCard = agente.id === currentUserId;
  const canToggle = isOwnCard || isSupervisor;

  async function handleToggle(checked: boolean) {
    if (!canToggle) return;
    setLoading(true);
    try {
      if (isOwnCard) {
        await toggleMiCcStatus(accessToken, { ccActivo: checked });
      } else {
        await toggleAgenteCcStatus(accessToken, agente.id, { ccActivo: checked });
      }
      await queryClient.invalidateQueries({ queryKey: ["cc-agentes", storeId] });
      toast.success(`Agente ${checked ? "activado" : "desactivado"}`);
    } catch {
      toast.error("No se pudo cambiar el estado del agente");
    } finally {
      setLoading(false);
    }
  }

  const tasaColor =
    agente.tasaCierre >= 70
      ? "text-green-600"
      : agente.tasaCierre >= 40
        ? "text-yellow-600"
        : "text-red-600";

  return (
    <Card className="relative">
      <CardHeader className="pb-2 flex flex-row items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold truncate">{agente.nombre ?? "—"}</p>
          <p className="text-xs text-muted-foreground truncate">{agente.email ?? "—"}</p>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          {agente.ccRol && (
            <Badge variant={agente.ccRol === "supervisor" ? "default" : "secondary"}>
              {agente.ccRol}
            </Badge>
          )}
          {canToggle && (
            <Switch
              checked={agente.ccActivo}
              disabled={loading}
              onCheckedChange={handleToggle}
              aria-label={agente.ccActivo ? "Desactivar agente" : "Activar agente"}
            />
          )}
          {!canToggle && (
            <Badge variant={agente.ccActivo ? "default" : "outline"}>
              {agente.ccActivo ? "Activo" : "Inactivo"}
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-2xl font-bold">{agente.pedidosPendientes}</p>
          <p className="text-xs text-muted-foreground">Pendientes</p>
        </div>
        <div>
          <p className="text-2xl font-bold">{agente.gestionadosHoy}</p>
          <p className="text-xs text-muted-foreground">Gestión hoy</p>
        </div>
        <div>
          <p className="text-2xl font-bold">{agente.cierresHoy}</p>
          <p className="text-xs text-muted-foreground">Cierres hoy</p>
        </div>
        <div>
          <p className="text-2xl font-bold">{agente.totalAsignados}</p>
          <p className="text-xs text-muted-foreground">Total asig.</p>
        </div>
        <div>
          <p className="text-2xl font-bold">{agente.productosVendidos}</p>
          <p className="text-xs text-muted-foreground">Productos</p>
        </div>
        <div>
          <p className={`text-2xl font-bold ${tasaColor}`}>{agente.tasaCierre}%</p>
          <p className="text-xs text-muted-foreground">Tasa cierre</p>
        </div>
      </CardContent>
    </Card>
  );
}
