"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ExternalLink, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useOperationsRole, OPS_PERMISSIONS } from "@/contexts/OperationsRoleContext";
import { FULFILLMENT_INTEGRATIONS } from "@/constants/operationsDomain";
import { getEvaCredentials } from "@/services/evaService";
import { getAliclikCredentials } from "@/services/aliclikService";

/* -----------------------------------------------------------------------
   Integraciones de fulfillment — EVA y Aliclik, deliberadamente separadas
   de la tabla de couriers de transporte: son credenciales + webhook, sin
   tarifa por zona ni SLA (ver nota en operationsDomain.ts).
------------------------------------------------------------------------ */

type IntegrationStatus = "loading" | "active" | "inactive" | "not_configured" | "error";

export default function FulfillmentIntegrationsSection() {
  const { auth } = useAuth();
  const companyId = auth?.company?.id;
  const token = auth?.accessToken;
  const { can } = useOperationsRole();
  const canEdit = can(OPS_PERMISSIONS.MANAGE_TARIFARIO);

  const [evaStatus, setEvaStatus] = useState<IntegrationStatus>("loading");
  const [aliclikStatus, setAliclikStatus] = useState<IntegrationStatus>("loading");

  useEffect(() => {
    if (!companyId || !token) return;
    getEvaCredentials(token, companyId)
      .then((cred) => setEvaStatus(cred ? (cred.isActive ? "active" : "inactive") : "not_configured"))
      .catch(() => setEvaStatus("error"));
    getAliclikCredentials(token, companyId)
      .then((cred) => setAliclikStatus(cred ? (cred.isActive ? "active" : "inactive") : "not_configured"))
      .catch(() => setAliclikStatus("error"));
  }, [companyId, token]);

  const statusByKey: Record<string, IntegrationStatus> = {
    eva: evaStatus,
    aliclik: aliclikStatus,
  };

  return (
    <div className="space-y-3">
      <div>
        <h3 className="font-bold">Integraciones de fulfillment</h3>
        <p className="text-xs text-muted-foreground">
          Canales de despacho propio con su webhook — no llevan tarifa por zona ni SLA, se configuran aparte.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {FULFILLMENT_INTEGRATIONS.map((integration) => (
          <div key={integration.key} className="rounded-xl border bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="font-semibold">{integration.label}</p>
              <StatusBadge status={statusByKey[integration.key]} />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {integration.key === "eva"
                ? "Recojo o almacén (Fly Express), notificaciones por webhook."
                : "Despacho vía Aliclik, catálogo e inbound sincronizados."}
            </p>
            <div className="mt-3">
              {canEdit ? (
                <Link href={integration.configRoute}>
                  <Button size="sm" variant="outline" className="gap-1.5">
                    <ExternalLink className="h-3.5 w-3.5" />
                    Configurar {integration.label} →
                  </Button>
                </Link>
              ) : (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Lock className="h-3.5 w-3.5" /> Sin permiso para editar credenciales
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: IntegrationStatus }) {
  const map: Record<IntegrationStatus, { label: string; className: string }> = {
    loading: { label: "Cargando…", className: "bg-muted text-muted-foreground" },
    active: {
      label: "Activa",
      className: "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300",
    },
    inactive: {
      label: "Inactiva",
      className: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
    },
    not_configured: {
      label: "No configurada",
      className: "bg-gray-100 text-gray-600 dark:bg-gray-500/15 dark:text-gray-300",
    },
    error: {
      label: "Ver configuración →",
      className: "bg-gray-100 text-gray-600 dark:bg-gray-500/15 dark:text-gray-300",
    },
  };
  const cfg = map[status];
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${cfg.className}`}>{cfg.label}</span>;
}
