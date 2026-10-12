"use client";

import { useEffect, useRef, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { AdvertisingSnapshotOptions } from "@/hooks/useAdvertisingSnapshot";
import { useAdvertisingWorkspace } from "@/hooks/useAdvertisingWorkspace";
import { advertisingErrorMessage, advertisingErrorStatus } from "@/services/advertisingService";
import {
  evaluateAdvertisingAlerts,
  saveAdvertisingAssignment,
  saveAdvertisingPlan,
  saveAdvertisingRule,
} from "@/services/advertisingWorkspaceService";
import { AdvertisingAlerts } from "./AdvertisingAlerts";
import { AdvertisingAssignments } from "./AdvertisingAssignments";
import { AdvertisingPlanner } from "./AdvertisingPlanner";
import { validMetaPeriod } from "./advertising-meta-model";

export type AdvertisingWorkspaceView = "assignments" | "alerts" | "planner";
const TITLES = { assignments: "Asignaciones", alerts: "Alertas", planner: "Planificador" };
export function AdvertisingWorkspacePanel({
  view,
  ...identity
}: AdvertisingSnapshotOptions & { view: AdvertisingWorkspaceView }) {
  const validPeriod = validMetaPeriod(identity.from, identity.to);
  const query = useAdvertisingWorkspace({ ...identity, enabled: validPeriod });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const workspace = query.data;
  async function run(
    action: (token: string, companyId: string) => Promise<unknown>,
    success: string,
  ) {
    if (
      !identity.token ||
      !identity.companyId ||
      !workspace?.capabilities.canConfigure ||
      busy ||
      !validPeriod
    )
      return false;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await action(identity.token, identity.companyId);
      if (!mounted.current) return false;
      await query.refetch();
      if (mounted.current) setNotice(success);
      return mounted.current;
    } catch (failure: unknown) {
      if ([401, 403].includes(advertisingErrorStatus(failure) ?? 0) && mounted.current)
        await query.refetch();
      if (mounted.current)
        setError(
          advertisingErrorStatus(failure) === 409
            ? "Los datos cambiaron. Vuelve a consultar y revisa el cambio antes de guardar."
            : advertisingErrorStatus(failure) === 400
              ? "Revisa los datos del formulario antes de guardar."
              : advertisingErrorMessage(failure),
        );
      return false;
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  if (!validPeriod)
    return (
      <Alert className="m-4 max-w-xl">
        <AlertDescription>Elige un periodo de hasta 366 días.</AlertDescription>
      </Alert>
    );
  if (!identity.token || !identity.companyId || !identity.actorId)
    return (
      <p className="p-4 text-sm text-muted-foreground">
        Inicia sesión con una empresa para consultar publicidad.
      </p>
    );
  return (
    <section className="min-w-0 space-y-5 p-4 sm:p-6 lg:p-8" aria-label={TITLES[view]}>
      <h2 className="font-semibold">{TITLES[view]}</h2>
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {notice ? (
        <p role="status" className="text-sm text-muted-foreground">
          {notice}
        </p>
      ) : null}
      {busy ? (
        <p role="status" className="text-sm text-muted-foreground">
          Procesando…
        </p>
      ) : null}
      {query.isError ? (
        <div className="space-y-3">
          <p role="alert" className="text-sm">
            {advertisingErrorMessage(query.error)}
          </p>
          <Button size="sm" variant="outline" onClick={() => void query.refetch()}>
            Volver a intentar
          </Button>
        </div>
      ) : !workspace ? (
        <Skeleton className="h-64" aria-label="Cargando publicidad" />
      ) : view === "assignments" ? (
        <AdvertisingAssignments
          workspace={workspace}
          busy={busy}
          onSave={(accountId, payload) =>
            run(
              (token, companyId) => saveAdvertisingAssignment(token, companyId, accountId, payload),
              "Asignación guardada.",
            )
          }
        />
      ) : view === "alerts" ? (
        <AdvertisingAlerts
          workspace={workspace}
          busy={busy}
          onSave={(ruleId, payload) =>
            run(
              (token, companyId) => saveAdvertisingRule(token, companyId, ruleId, payload),
              "Regla guardada.",
            )
          }
          onEvaluate={() =>
            run(
              (token, companyId) =>
                evaluateAdvertisingAlerts(token, companyId, identity.from, identity.to),
              "Evaluación guardada.",
            )
          }
        />
      ) : (
        <AdvertisingPlanner
          workspace={workspace}
          busy={busy}
          onSave={(payload) =>
            run(
              (token, companyId) => saveAdvertisingPlan(token, companyId, payload),
              "Escenario guardado.",
            )
          }
        />
      )}
    </section>
  );
}
