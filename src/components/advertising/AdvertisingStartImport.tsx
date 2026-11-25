"use client";

import { Play } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import type { AdvertisingAccountWire } from "@/services/advertisingService";

type Phase = "not_requested" | "queued" | "running" | "retrying" | "succeeded" | "failed" | "paused";

/** Plain-language status of one Meta account: spend history plus per-ad import. */
export function advertisingImportStatus(account: AdvertisingAccountWire): {
  phase: Phase;
  label: string;
  detail: string | null;
  progress: number | null;
} {
  if (!account.importRequestedAt)
    return {
      phase: "not_requested",
      label: "Sin importar",
      detail:
        account.adImport?.status === "paused"
          ? "Pausada: nadie la pidió. Los datos ya traídos se conservan."
          : null,
      progress: null,
    };
  const history = account.historyImport;
  const ads = account.adImport;
  const errorCode = ads?.errorCode ?? history?.errorCode ?? null;
  const progressOf = (done: number, total: number | null) =>
    total && total > 0 ? Math.min(100, Math.round((done / total) * 100)) : null;
  if (history && (history.status === "queued" || history.status === "running"))
    return {
      phase: "running",
      label: "Importando gasto…",
      detail: history.totalWindows
        ? `Tramo ${history.completedWindows} de ${history.totalWindows}.`
        : null,
      progress: progressOf(history.completedWindows, history.totalWindows),
    };
  if (ads && (ads.status === "pending" || ads.status === "running"))
    return {
      phase: ads.status === "pending" ? "queued" : "running",
      label: ads.status === "pending" ? "En cola" : "Importando anuncios…",
      detail: ads.totalWindows ? `Tramo ${ads.completedWindows} de ${ads.totalWindows}.` : null,
      progress: progressOf(ads.completedWindows, ads.totalWindows),
    };
  if (ads?.status === "retrying")
    return {
      phase: "retrying",
      label: "Reintentando",
      detail: importErrorMessage(errorCode, ads.nextAttemptAt),
      progress: progressOf(ads.completedWindows, ads.totalWindows),
    };
  if (history?.status === "failed" || ads?.status === "failed")
    return {
      phase: "failed",
      label: "Con error",
      detail: importErrorMessage(errorCode, null),
      progress: null,
    };
  if (history?.status === "paused" || ads?.status === "paused")
    return {
      phase: "paused",
      label: "Pausada",
      detail: "Pulsa «Comenzar importación» para seguir. Los datos ya traídos se conservan.",
      progress: null,
    };
  return { phase: "succeeded", label: "Importada", detail: null, progress: null };
}

export function importErrorMessage(code: string | null, nextAttemptAt: string | null): string {
  const when = nextAttemptAt
    ? ` Se reintenta a las ${new Intl.DateTimeFormat("es-PE", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "America/Lima",
      }).format(new Date(nextAttemptAt))}.`
    : "";
  switch (code) {
    case "PROVIDER_RATE":
      return `Meta limitó las consultas de esta cuenta (límite de uso de la API).${when || " Espera unos minutos y vuelve a intentar."}`;
    case "PROVIDER_AUTH":
      return "Meta rechazó el permiso. Reconecta la cuenta para continuar.";
    case "PROVIDER_PERMISSION":
      return "Tu usuario de Meta no tiene permiso sobre esta cuenta.";
    case null:
      return `La importación no terminó.${when}`;
    default:
      return `Meta no respondió bien (${code}).${when || " Vuelve a intentar."}`;
  }
}

const ACTIVE: Phase[] = ["queued", "running", "retrying"];

export function AdvertisingStartImport({
  accounts,
  canManage,
  busy,
  onStart,
}: {
  accounts: AdvertisingAccountWire[];
  canManage: boolean;
  busy: boolean;
  onStart: (accountIds: string[]) => void;
}) {
  const metaAccounts = useMemo(
    () =>
      accounts.filter(
        (account) => account.provider === "meta" && account.enabled && !account.disconnectedAt,
      ),
    [accounts],
  );
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  if (!metaAccounts.length) return null;
  const visibleChosen = metaAccounts.filter((account) => chosen.has(account.id));
  const toggle = (id: string, on: boolean) =>
    setChosen((current) => {
      const next = new Set(current);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  const allChosen = visibleChosen.length === metaAccounts.length;
  return (
    <section
      aria-labelledby="advertising-start-import-title"
      className="space-y-3 rounded-lg border border-border p-4"
    >
      <div className="space-y-1">
        <h3 id="advertising-start-import-title" className="text-sm font-medium">
          Importar datos de Meta
        </h3>
        <p className="text-xs text-muted-foreground">
          Elegir cuentas no trae datos por sí solo. Marca las cuentas que quieres importar y pulsa
          «Comenzar importación». Solo esas cuentas se importan y se actualizan solas después.
        </p>
      </div>
      {canManage ? (
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <Checkbox
            checked={allChosen}
            onCheckedChange={(value) =>
              setChosen(value === true ? new Set(metaAccounts.map((a) => a.id)) : new Set())
            }
            aria-label="Marcar todas las cuentas"
          />
          Marcar todas ({metaAccounts.length})
        </label>
      ) : null}
      <ul className="max-h-80 space-y-2 overflow-y-auto pr-1">
        {metaAccounts.map((account) => {
          const status = advertisingImportStatus(account);
          return (
            <li key={account.id} className="space-y-1 rounded-md border border-border p-2">
              <div className="flex flex-wrap items-center gap-2">
                {canManage ? (
                  <Checkbox
                    checked={chosen.has(account.id)}
                    onCheckedChange={(value) => toggle(account.id, value === true)}
                    aria-label={`Importar ${account.name}`}
                  />
                ) : null}
                <span className="min-w-0 flex-1 truncate text-sm">{account.name}</span>
                <Badge
                  variant={status.phase === "failed" || status.phase === "retrying" ? "destructive" : "outline"}
                >
                  {status.label}
                </Badge>
              </div>
              {status.progress !== null && ACTIVE.includes(status.phase) ? (
                <Progress
                  value={status.progress}
                  aria-label={`Avance de importación de ${account.name}`}
                />
              ) : null}
              {status.detail ? (
                <p
                  className={
                    status.phase === "failed" || status.phase === "retrying"
                      ? "text-xs text-destructive"
                      : "text-xs text-muted-foreground"
                  }
                >
                  {status.detail}
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>
      {canManage ? (
        <Button
          size="sm"
          disabled={busy || visibleChosen.length === 0}
          onClick={() => {
            onStart(visibleChosen.map((account) => account.id));
            setChosen(new Set());
          }}
        >
          <Play aria-hidden="true" />
          {busy
            ? "Comenzando…"
            : `Comenzar importación${visibleChosen.length ? ` (${visibleChosen.length})` : ""}`}
        </Button>
      ) : null}
    </section>
  );
}
