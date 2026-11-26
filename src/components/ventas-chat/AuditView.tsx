"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Info, Loader2, OctagonAlert, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { crmError } from "@/services/crmService";
import { useRemindScript } from "@/hooks/useCrmTeam";
import { useAuditD, useAuditFallback } from "@/hooks/useCrmBlockD";
import { useCrmMe } from "@/hooks/useCrmMe";
import type { Audit, AuditProblem, AuditSeverity } from "@/types/crmTeam";
import type { AuditD } from "@/types/crmBlockD";
import { CRM_UNREACHABLE } from "./ConversationList";
import EquipoAdminGate from "./EquipoAdminGate";
import { ProductsAudit, ReadinessKpis, ReadsByStore } from "./AuditProducts";
import { NATIVE_SELECT_CLASS } from "./format";

const SEVERITY_ORDER: Record<AuditSeverity, number> = { bad: 0, warn: 1, info: 2 };

const SEVERITY_INFO: Record<AuditSeverity, { label: string; className: string }> = {
  bad: { label: "Grave", className: "border-destructive/40 bg-destructive/5 text-destructive" },
  warn: { label: "Atención", className: "border-amber-300 bg-amber-50 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300" },
  info: { label: "Aviso", className: "border-border bg-muted/30 text-muted-foreground" },
};

const SHEET_STATUS: Record<"ok" | "warn" | "bad", { label: string; className: string }> = {
  ok: { label: "Completa", className: "bg-emerald-100 text-emerald-800" },
  warn: { label: "Incompleta", className: "bg-amber-100 text-amber-800" },
  bad: { label: "Muy incompleta", className: "bg-red-100 text-red-800" },
};

export function sortProblems(problems: AuditProblem[]): AuditProblem[] {
  return [...problems].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
}

function scoreVerdict(score: number) {
  if (score >= 80) return "Listo para vender: lo esencial está en orden.";
  if (score >= 50) return "Casi listo: corrige los problemas de abajo antes de depender del equipo o de Pau.";
  return "Todavía no está listo: faltan datos clave y las respuestas pueden salir incompletas.";
}

function ScoreCard({ audit }: { audit: Audit }) {
  const score = Math.max(0, Math.min(100, Math.round(audit.score)));
  const tone = score >= 80 ? "bg-emerald-500" : score >= 50 ? "bg-amber-500" : "bg-red-500";
  return (
    <section aria-label="Listo para vender" className="space-y-2 rounded-md border bg-card p-4">
      <h2 className="text-sm font-semibold">Listo para vender</h2>
      <p className="text-4xl font-semibold tabular-nums" data-testid="score">
        {score}
        <span className="text-base font-normal text-muted-foreground"> / 100</span>
      </p>
      <div
        role="progressbar"
        aria-valuenow={score}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Puntaje listo para vender"
        className="h-2 rounded-full bg-muted"
      >
        <div className={cn("h-2 rounded-full", tone)} style={{ width: `${score}%` }} />
      </div>
      <p className="text-sm">{scoreVerdict(score)}</p>
      <p className="text-xs text-muted-foreground">
        El puntaje revisa si las fichas de producto tienen sus datos, si el guion está al día y si el
        CRM está configurado. Sube a medida que resuelves los problemas.
      </p>
    </section>
  );
}

function Problems({ problems }: { problems: AuditProblem[] }) {
  const sorted = useMemo(() => sortProblems(problems), [problems]);
  return (
    <section aria-label="Problemas" className="space-y-2">
      <h2 className="text-sm font-semibold">Problemas por resolver</h2>
      {sorted.length === 0 ? (
        <p className="flex items-center gap-2 rounded-md border bg-emerald-50 p-3 text-sm text-emerald-700 dark:bg-emerald-950/30">
          <CheckCircle2 className="h-4 w-4" /> No se encontraron problemas
        </p>
      ) : (
        <ul className="space-y-2" data-testid="problems">
          {sorted.map((p) => {
            const info = SEVERITY_INFO[p.severity];
            const Icon = p.severity === "bad" ? OctagonAlert : p.severity === "warn" ? TriangleAlert : Info;
            return (
              <li
                key={p.code}
                data-severity={p.severity}
                className={cn("flex items-start gap-3 rounded-md border p-3 text-sm", info.className)}
              >
                <Icon className="mt-0.5 h-4 w-4 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    <span className="mr-2 text-[11px] uppercase tracking-wide">{info.label}</span>
                    {p.title}
                  </p>
                  <p className="text-xs opacity-90">{p.detail}</p>
                </div>
                {p.href && (
                  <Button asChild size="sm" variant="outline">
                    <Link href={p.href}>Resolver</Link>
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function Sheets({ sheets }: { sheets: Audit["sheets"] }) {
  return (
    <section aria-label="Productos" className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">Fichas de producto</h2>
        <Button asChild size="sm" variant="outline">
          <Link href="/comercial/ventas-chat/guion">Abrir Guion y material</Link>
        </Button>
      </div>
      {sheets.length === 0 ? (
        <p className="rounded-md border p-3 text-sm text-muted-foreground">
          Todavía no hay fichas de producto.
        </p>
      ) : (
        <div className="relative overflow-x-auto rounded-md border">
          <table className="w-full text-sm" data-testid="sheets">
            <thead className="bg-muted/40 text-xs">
              <tr>
                <th scope="col" className="px-3 py-2 text-left font-medium">Producto</th>
                <th scope="col" className="px-3 py-2 text-left font-medium">Estado</th>
                <th scope="col" className="px-3 py-2 text-left font-medium">Qué le falta</th>
              </tr>
            </thead>
            <tbody>
              {sheets.map((s) => (
                <tr key={s.id} className="border-t">
                  <th scope="row" className="px-3 py-2 text-left font-medium">
                    <Link href="/comercial/ventas-chat/guion" className="hover:underline">
                      {s.name}
                    </Link>
                  </th>
                  <td className="px-3 py-2">
                    <Badge className={SHEET_STATUS[s.status].className} variant="secondary">
                      {SHEET_STATUS[s.status].label}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {s.missing.length ? s.missing.join(", ") : "Nada"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function ScriptReaders({ script }: { script: Audit["script"] }) {
  const remind = useRemindScript();
  const [notified, setNotified] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState<string | null>(null);

  const send = (userId: string, userName: string) => {
    setPending(userId);
    remind.mutate(
      { userId, userName },
      {
        onSuccess: () => setNotified((prev) => new Set(prev).add(userId)),
        onSettled: () => setPending(null),
      },
    );
  };

  return (
    <section aria-label="Lectura del guion" className="space-y-2">
      <h2 className="text-sm font-semibold">¿Leyeron el último guion?</h2>
      <p className="text-xs text-muted-foreground">
        Versión actual del guion: {script.version}. «Recordar» crea una tarea en la Agenda de esa
        persona para que lo lea.
      </p>
      {script.items.length === 0 ? (
        <p className="rounded-md border p-3 text-sm text-muted-foreground">
          Todavía no hay personas del equipo para revisar.
        </p>
      ) : (
        <div className="relative overflow-x-auto rounded-md border">
          <table className="w-full text-sm" data-testid="script-readers">
            <thead className="bg-muted/40 text-xs">
              <tr>
                <th scope="col" className="px-3 py-2 text-left font-medium">Persona</th>
                <th scope="col" className="px-3 py-2 text-left font-medium">Leyó</th>
                <th scope="col" className="px-3 py-2 text-left font-medium">Estado</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">
                  <span className="sr-only">Acción</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {script.items.map((i) => (
                <tr key={i.userId} className="border-t">
                  <th scope="row" className="px-3 py-2 text-left font-medium">{i.userName}</th>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {i.readVersion == null
                      ? "Nunca"
                      : `Versión ${i.readVersion}${
                          i.readAt
                            ? ` · ${new Date(i.readAt).toLocaleDateString("es-PE", { timeZone: "America/Lima" })}`
                            : ""
                        }`}
                  </td>
                  <td className="px-3 py-2">
                    {i.upToDate ? (
                      <Badge variant="secondary" className="bg-emerald-100 text-emerald-800">Al día</Badge>
                    ) : (
                      <Badge variant="secondary" className="bg-amber-100 text-amber-800">Desactualizado</Badge>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {i.upToDate ? null : notified.has(i.userId) ? (
                      <span className="text-xs font-medium text-emerald-700">Avisado</span>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={pending === i.userId}
                        aria-label={`Recordar a ${i.userName}`}
                        onClick={() => send(i.userId, i.userName)}
                      >
                        Recordar
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function AuditContent() {
  const { stores } = useCrmMe();
  const [storeId, setStoreId] = useState("");
  // Auditoría por producto y tienda (bloque D). Si el servidor todavía no la
  // tiene, se cae a la de antes.
  const auditD = useAuditD(storeId);
  const legacy = useAuditFallback(auditD.isError);
  const full: AuditD | undefined = auditD.data;
  const data: Audit | undefined = full ?? legacy.data;
  const isLoading = auditD.isLoading || legacy.isLoading;
  const isError = auditD.isError && legacy.isError;
  const error = legacy.error;
  const refetch = () => {
    auditD.refetch();
    legacy.refetch();
  };
  const err = isError ? crmError(error) : null;
  return (
    <div className="w-full space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-semibold">Auditoría</h1>
        {stores.length > 1 && (
          <select
            aria-label="Tienda"
            className={cn(NATIVE_SELECT_CLASS, "w-48")}
            value={storeId}
            onChange={(e) => setStoreId(e.target.value)}
          >
            <option value="">Todas las tiendas</option>
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        )}
      </div>
      {isLoading && (
        <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Revisando el CRM…
        </p>
      )}
      {err && (
        <div role="alert" className="space-y-2 rounded-md border border-destructive/30 p-3 text-sm">
          <p className="font-medium text-destructive">
            {err.unreachable ? CRM_UNREACHABLE : err.message}
          </p>
          <Button size="sm" variant="outline" onClick={() => refetch()}>
            Reintentar
          </Button>
        </div>
      )}
      {data && (
        <>
          {full && <ReadinessKpis audit={full} />}
          <div className="grid gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
            <ScoreCard audit={data} />
            <Problems problems={data.problems} />
          </div>
          {full ? <ProductsAudit audit={full} stores={stores} /> : <Sheets sheets={data.sheets} />}
          <ScriptReaders script={data.script} />
          {full && <ReadsByStore audit={full} stores={stores} />}
        </>
      )}
    </div>
  );
}

/** Pestaña Auditoría: qué falta para vender bien (solo administrador). */
export default function AuditView() {
  return (
    <EquipoAdminGate>
      <AuditContent />
    </EquipoAdminGate>
  );
}
