"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowDown, ArrowUp, CheckCircle2, Info, Loader2, Target } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { crmError } from "@/services/crmService";
import { useCrmMe } from "@/hooks/useCrmMe";
import { useTeamBoard } from "@/hooks/useCrmBlockD";
import {
  useReassignConversation,
  useSetDailyGoal,
  useTeamMembers,
  useTeamStats,
} from "@/hooks/useCrmTeam";
import type { ConversationChannel } from "@/types/crm";
import type { TeamChannelResult, TeamDays, TeamMember, TeamStats, TeamToday } from "@/types/crmTeam";
import { CRM_UNREACHABLE } from "./ConversationList";
import CommissionsSection from "./CommissionsSection";
import EquipoAdminGate from "./EquipoAdminGate";
import AdResultsCard from "./AjustesAdResultsCard";
import { MetaAudienceCard } from "./AjustesMetaAdsCards";
import { BoardKpis, BoardWaiting, NightReview, SellersTable } from "./EquipoBoard";
import { CHANNEL_LABEL, NATIVE_SELECT_CLASS, bandejaUrl, contactLabel, formatMoney } from "./format";

/** «—», «12 min», «2 h 5 min». */
export function formatMinutes(min: number | null | undefined): string {
  if (min == null || !Number.isFinite(min)) return "—";
  const m = Math.round(min);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h} h ${r} min` : `${h} h`;
}

function Kpi({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-md border bg-card p-3" data-testid="kpi">
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
      <p className="text-xs font-medium">{label}</p>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Help() {
  return (
    <details className="rounded-md border bg-muted/30 p-3 text-sm">
      <summary className="flex cursor-pointer items-center gap-2 font-medium">
        <Info className="h-4 w-4" /> Qué significa cada número
      </summary>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
        <li>Todo sale de la actividad del CRM en el periodo elegido.</li>
        <li>
          <b>Sin responder</b>: chats abiertos cuyo último mensaje es del cliente. <b>Esperando</b>:
          sin responder hace más de los minutos del tiempo de respuesta (se cambia en Ajustes).
        </li>
        <li>
          <b>Primera respuesta</b>: promedio de minutos entre un mensaje del cliente y la siguiente
          respuesta del equipo.
        </li>
        <li>
          <b>Ganados / perdidos</b>: chats que pasaron a una etapa ganada o perdida en el periodo.{" "}
          <b>Pedidos</b>: pedidos creados desde el chat.
        </li>
        <li>
          <b>Meta del día</b>: lo cobrado hoy (hora de Lima) con pagos aprobados en el chat, por
          vendedora asignada. <b>Resultados por canal</b>: chats del periodo y cuántos se ganaron.
        </li>
        <li>Todavía no se miden llamadas ni resultados de anuncios.</li>
      </ul>
    </details>
  );
}

function WaitingSection({ stats }: { stats: TeamStats }) {
  const members = useTeamMembers();
  const reassign = useReassignConversation();
  return (
    <section aria-label="Chats esperando" className="space-y-2">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <AlertTriangle className="h-4 w-4 text-amber-600" />
        Chats esperando más de {stats.slaMinutes} min
      </h2>
      {stats.waiting.length === 0 ? (
        <p
          className="flex items-center gap-2 rounded-md border bg-emerald-50 p-3 text-sm text-emerald-700 dark:bg-emerald-950/30"
          data-testid="all-clear"
        >
          <CheckCircle2 className="h-4 w-4" /> Todo al día
        </p>
      ) : (
        <ul className="divide-y rounded-md border" data-testid="waiting-list">
          {stats.waiting.map(({ conversation: c, waitingMinutes }) => {
            const label = contactLabel(c);
            const options = (members.data ?? []).filter((p) => p.userId !== c.assignedUserId);
            return (
              <li key={c.id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="break-words sm:truncate font-medium">{label}</p>
                  <p className="text-xs text-muted-foreground">
                    Esperando {formatMinutes(waitingMinutes)} · Asignada a{" "}
                    {c.assignedUserName ?? "nadie"}
                  </p>
                </div>
                <select
                  aria-label={`Reasignar a… (${label})`}
                  className={cn(NATIVE_SELECT_CLASS, "w-44")}
                  value=""
                  disabled={members.isLoading || members.isError || reassign.isPending}
                  onChange={(e) => {
                    const person = options.find((p) => p.userId === e.target.value);
                    if (person) reassign.mutate({ id: c.id, person });
                  }}
                >
                  <option value="">Reasignar a…</option>
                  {options.map((p) => (
                    <option key={p.userId} value={p.userId}>
                      {p.userName}
                    </option>
                  ))}
                </select>
                <Button asChild size="sm" variant="outline">
                  <Link href={bandejaUrl(c.id)}>Abrir chat</Link>
                </Button>
              </li>
            );
          })}
        </ul>
      )}
      {members.isError && stats.waiting.length > 0 && (
        <p role="alert" className="text-xs text-destructive">
          No se pudo cargar la lista de personas: {crmError(members.error).message}
        </p>
      )}
    </section>
  );
}

type SortKey =
  | "userName"
  | "openAssigned"
  | "unanswered"
  | "messagesSent"
  | "avgFirstResponseMinutes"
  | "won"
  | "lost"
  | "ordersLinked"
  | "pendingTasks"
  | "overdueTasks";

const COLUMNS: Array<{ key: SortKey; label: string }> = [
  { key: "userName", label: "Persona" },
  { key: "openAssigned", label: "Abiertos" },
  { key: "unanswered", label: "Sin responder" },
  { key: "messagesSent", label: "Mensajes" },
  { key: "avgFirstResponseMinutes", label: "1ª respuesta" },
  { key: "won", label: "Ganados" },
  { key: "lost", label: "Perdidos" },
  { key: "ordersLinked", label: "Pedidos" },
  { key: "pendingTasks", label: "Tareas" },
  { key: "overdueTasks", label: "Vencidas" },
];

export function sortMembers(
  members: TeamMember[],
  key: SortKey,
  dir: "asc" | "desc",
): TeamMember[] {
  const sign = dir === "asc" ? 1 : -1;
  return [...members].sort((a, b) => {
    if (key === "userName") return sign * a.userName.localeCompare(b.userName, "es");
    const av = a[key];
    const bv = b[key];
    // Sin dato (null) siempre al final.
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    return sign * (av - bv);
  });
}

function Ranking({ members }: { members: TeamMember[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("openAssigned");
  const [dir, setDir] = useState<"asc" | "desc">("desc");
  const sorted = useMemo(() => sortMembers(members, sortKey, dir), [members, sortKey, dir]);
  const toggle = (key: SortKey) => {
    if (key === sortKey) setDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setDir(key === "userName" ? "asc" : "desc");
    }
  };
  return (
    <section aria-label="Equipo" className="space-y-2">
      <h2 className="text-sm font-semibold">Equipo</h2>
      {members.length === 0 ? (
        <p className="rounded-md border p-3 text-sm text-muted-foreground">
          Todavía no hay actividad del equipo en este periodo.
        </p>
      ) : (
        <div className="relative overflow-x-auto rounded-md border">
          <table className="w-full text-sm" data-testid="ranking">
            <thead className="bg-muted/40 text-xs">
              <tr>
                {COLUMNS.map((col) => (
                  <th
                    key={col.key}
                    scope="col"
                    aria-sort={
                      sortKey === col.key ? (dir === "asc" ? "ascending" : "descending") : "none"
                    }
                    className={cn("px-3 py-2 font-medium", col.key === "userName" ? "text-left" : "text-right")}
                  >
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 hover:underline"
                      onClick={() => toggle(col.key)}
                    >
                      {col.label}
                      {sortKey === col.key &&
                        (dir === "asc" ? (
                          <ArrowUp className="h-3 w-3" />
                        ) : (
                          <ArrowDown className="h-3 w-3" />
                        ))}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((m) => (
                <tr key={`${m.kind}:${m.userId}`} className="border-t" data-testid="member-row">
                  <th scope="row" className="px-3 py-2 text-left font-medium">
                    {m.userName}
                    {m.kind === "pau" && (
                      <Badge variant="secondary" className="ml-2">
                        Agente IA
                      </Badge>
                    )}
                  </th>
                  <td className="px-3 py-2 text-right tabular-nums">{m.openAssigned}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{m.unanswered}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{m.messagesSent}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatMinutes(m.avgFirstResponseMinutes)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{m.won}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{m.lost}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{m.ordersLinked}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{m.pendingTasks}</td>
                  <td
                    className={cn(
                      "px-3 py-2 text-right tabular-nums",
                      m.overdueTasks > 0 && "font-medium text-destructive",
                    )}
                  >
                    {m.overdueTasks}
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

function LostReasons({ reasons }: { reasons: TeamStats["lostReasons"] }) {
  const max = Math.max(1, ...reasons.map((r) => r.count));
  return (
    <section aria-label="Motivos de pérdida" className="space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold">Motivos de pérdida · por qué se pierden los clientes</h2>
        <Link href="/comercial/ventas-chat/objeciones" className="text-xs font-medium text-primary hover:underline">
          Ver cómo responderlas en Objeciones
        </Link>
      </div>
      {reasons.length === 0 ? (
        <p className="rounded-md border p-3 text-sm text-muted-foreground">
          No hubo chats perdidos en este periodo.
        </p>
      ) : (
        <ul className="space-y-2 rounded-md border p-3" data-testid="lost-reasons">
          {reasons.map((r) => (
            <li key={r.reason} className="space-y-1">
              <div className="flex justify-between gap-2 text-xs">
                <span>{r.reason}</span>
                <span className="tabular-nums text-muted-foreground">{r.count}</span>
              </div>
              <div className="h-2 rounded-full bg-muted">
                <div
                  className="h-2 rounded-full bg-primary"
                  style={{ width: `${Math.round((r.count / max) * 100)}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Porcentaje de avance (0-100, entero); null si no hay meta. */
export function goalPercent(collected: number, goal: number): number | null {
  if (!goal || goal <= 0) return null;
  return Math.min(100, Math.round((collected / goal) * 100));
}

function Meter({ percent }: { percent: number }) {
  return (
    <div className="h-2 rounded-full bg-muted" role="presentation">
      <div className="h-2 rounded-full bg-primary" style={{ width: `${percent}%` }} />
    </div>
  );
}

function DailyGoal({ today }: { today: TeamToday }) {
  const setGoal = useSetDailyGoal();
  const [draft, setDraft] = useState<string | null>(null);
  const value = draft ?? String(today.goal || "");
  const parsed = value.trim() === "" ? 0 : Number(value);
  const valid = Number.isInteger(parsed) && parsed >= 0 && parsed <= 1_000_000;
  const dirty = valid && parsed !== today.goal;
  const pct = goalPercent(today.total, today.goal);
  const perSeller = today.members.length ? today.goal / today.members.length : 0;
  return (
    <section aria-label="Meta del día" className="space-y-2 rounded-md border p-3" data-testid="daily-goal">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Target className="h-4 w-4" /> Meta del día
        </h2>
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (dirty) setGoal.mutate(parsed, { onSuccess: () => setDraft(null) });
          }}
        >
          <label htmlFor="daily-goal" className="text-xs text-muted-foreground">
            Meta (S/)
          </label>
          <Input
            id="daily-goal"
            inputMode="numeric"
            className="h-8 w-28"
            value={value}
            placeholder="Sin meta"
            onChange={(e) => setDraft(e.target.value.replace(/[^0-9]/g, ""))}
          />
          <Button type="submit" size="sm" disabled={!dirty || setGoal.isPending}>
            {setGoal.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Guardar
          </Button>
        </form>
      </div>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
        <span className="text-xl font-semibold tabular-nums">{formatMoney(today.total)}</span>
        <span className="text-muted-foreground">
          {pct == null ? "cobrado hoy · sin meta fijada" : `de ${formatMoney(today.goal)} · ${pct}%`}
        </span>
      </div>
      {pct != null && <Meter percent={pct} />}
      {today.members.length > 0 && (
        <ul className="grid gap-2 pt-1 sm:grid-cols-2" data-testid="goal-members">
          {today.members.map((m) => {
            const p = goalPercent(m.collected, perSeller);
            return (
              <li key={m.userId} className="space-y-1">
                <div className="flex justify-between gap-2 text-xs">
                  <span className="break-words sm:truncate">{m.userName}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {formatMoney(m.collected)}
                    {p != null && ` · ${p}%`}
                  </span>
                </div>
                {p != null && <Meter percent={p} />}
              </li>
            );
          })}
        </ul>
      )}
      {today.unassigned > 0 && (
        <p className="text-xs text-muted-foreground">
          {formatMoney(today.unassigned)} cobrados en chats sin vendedora asignada.
        </p>
      )}
      {today.goal > 0 && today.members.length > 0 && (
        <p className="text-[11px] text-muted-foreground">
          La meta se reparte por igual entre las {today.members.length} personas del equipo.
        </p>
      )}
    </section>
  );
}

function ChannelResults({ rows }: { rows: TeamChannelResult[] }) {
  return (
    <section aria-label="Resultados por canal" className="space-y-2">
      <h2 className="text-sm font-semibold">Resultados por canal</h2>
      {rows.length === 0 ? (
        <p className="rounded-md border p-3 text-sm text-muted-foreground">
          No hubo chats en este periodo.
        </p>
      ) : (
        <div className="relative overflow-x-auto rounded-md border">
          <table className="w-full text-sm" data-testid="channel-results">
            <thead className="bg-muted/40 text-xs">
              <tr>
                <th scope="col" className="px-3 py-2 text-left font-medium">Canal</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Chats</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Ganados</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Conversión</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Cobrado</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.channel} className="border-t">
                  <th scope="row" className="px-3 py-2 text-left font-medium">
                    {CHANNEL_LABEL[r.channel as ConversationChannel] ?? r.channel}
                  </th>
                  <td className="px-3 py-2 text-right tabular-nums">{r.chats}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.won}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {r.conversion == null ? "—" : `${r.conversion}%`}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatMoney(r.collected)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function EquipoContent() {
  const [days, setDays] = useState<TeamDays>(7);
  const [storeId, setStoreId] = useState("");
  const { stores } = useCrmMe();
  const board = useTeamBoard(storeId);
  const { data, isLoading, isError, error, refetch } = useTeamStats(days);
  const err = isError ? crmError(error) : null;
  return (
    <div className="w-full space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold">Equipo</h1>
          <p className="text-xs text-muted-foreground">Para el equipo · vista de supervisor</p>
        </div>
        {stores.length > 1 && (
          <select
            aria-label="Tienda del tablero"
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
      {board.data && (
        <>
          <BoardKpis board={board.data} />
          <BoardWaiting board={board.data} onDone={() => board.refetch()} />
        </>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-4">
        <h2 className="text-sm font-semibold">Actividad del periodo</h2>
        <div role="group" aria-label="Periodo" className="inline-flex rounded-md border p-0.5">
          {([7, 30] as const).map((d) => (
            <Button
              key={d}
              type="button"
              size="sm"
              variant={days === d ? "default" : "ghost"}
              aria-pressed={days === d}
              onClick={() => setDays(d)}
            >
              Últimos {d} días
            </Button>
          ))}
        </div>
      </div>
      <Help />
      {isLoading && (
        <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando equipo…
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
          <section aria-label="Resumen" className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <Kpi label="Chats abiertos" value={data.kpis.openConversations} />
            <Kpi label="Sin responder" value={data.kpis.unanswered} />
            <Kpi
              label="Esperando"
              value={data.kpis.waitingOverSla}
              hint={`Más de ${data.slaMinutes} min`}
            />
            <Kpi
              label="Primera respuesta"
              value={formatMinutes(data.kpis.avgFirstResponseMinutes)}
              hint="Promedio"
            />
            <Kpi label="Ganados" value={data.kpis.wonConversations} />
            <Kpi label="Perdidos" value={data.kpis.lostConversations} />
            <Kpi label="Pedidos desde el chat" value={data.kpis.ordersLinked} />
            <Kpi label="Mensajes enviados" value={data.kpis.messagesSent} />
          </section>
          {data.today && <DailyGoal today={data.today} />}
          {board.data && <SellersTable board={board.data} stores={stores} />}
          <WaitingSection stats={data} />
          <Ranking members={data.members} />
          <CommissionsSection />
          {board.data && <NightReview board={board.data} />}
          {board.data && (
            <div className="grid gap-4 xl:grid-cols-2">
              <AdResultsCard />
              <MetaAudienceCard />
            </div>
          )}
          <LostReasons reasons={data.lostReasons} />
          {data.byChannel && <ChannelResults rows={data.byChannel} />}
        </>
      )}
    </div>
  );
}

/** Pestaña Equipo: supervisión de tiempos de respuesta y rendimiento (solo administrador). */
export default function EquipoView() {
  return (
    <EquipoAdminGate>
      <EquipoContent />
    </EquipoAdminGate>
  );
}
