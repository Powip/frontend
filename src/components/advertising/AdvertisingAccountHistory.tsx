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
  showName = true,
  hasStoredData,
}: {
  account: AdvertisingAccount;
  from?: string;
  to?: string;
  showName?: boolean;
  /** Presence of a stored amount in the requested period, independent of provider availability. */
  hasStoredData?: boolean;
}) {
  const job = account.historyImport;
  if (!job) return null;
  const active = job.status === "queued" || job.status === "running";
  const progress =
    job.totalWindows !== null && job.totalWindows > 0
      ? (job.completedWindows / job.totalWindows) * 100
      : null;
  const beforeAvailable = Boolean(
    hasStoredData === false && to && job.availableFrom && to < job.availableFrom,
  );
  return (
    <div className="space-y-2" aria-live="polite">
      {showName ? <p className="text-sm font-medium">{account.name}</p> : null}
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
      {job.availableFrom && (!from || (from < job.availableFrom && hasStoredData !== true)) ? (
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
