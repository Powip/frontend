"use client";

import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import type { AdvertisingAccount } from "./advertising-model";
import { formatAdvertisingDate } from "./advertising-model";

const LABELS = {
  queued: "Importando historial…",
  running: "Importando historial…",
  succeeded: "Historial disponible importado",
  failed: "Importación incompleta",
  paused: "Importación pausada",
};

export function AdvertisingAccountHistory({
  account,
  from,
  to,
}: {
  account: AdvertisingAccount;
  from?: string;
  to?: string;
}) {
  const job = account.historyImport;
  if (!job) return null;
  const active = job.status === "queued" || job.status === "running";
  const progress =
    job.totalWindows !== null && job.totalWindows > 0
      ? (job.completedWindows / job.totalWindows) * 100
      : null;
  const beforeAvailable = Boolean(to && job.availableFrom && to < job.availableFrom);
  return (
    <div className="space-y-2" aria-live="polite">
      <p className="text-sm font-medium">{account.name}</p>
      <div className="flex flex-wrap gap-2">
        <Badge variant="outline">{LABELS[job.status]}</Badge>
        {beforeAvailable ? <Badge variant="outline">Historial no disponible</Badge> : null}
      </div>
      {active && progress !== null ? (
        <Progress
          aria-label={`Avance de importación de ${account.name}`}
          value={progress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress}
        />
      ) : null}
      {job.availableFrom && (!from || from < job.availableFrom) ? (
        <p className="text-xs text-muted-foreground">
          Disponible desde {formatAdvertisingDate(job.availableFrom)}{" "}
          {job.availableFrom.slice(0, 4)}.
        </p>
      ) : null}
      {job.status === "failed" ? (
        <p className="text-xs text-muted-foreground">
          {job.errorCode === "PROVIDER_AUTH"
            ? "Reconecta esta cuenta para continuar."
            : "Pulsa Actualizar gasto para reintentar."}
        </p>
      ) : null}
    </div>
  );
}
