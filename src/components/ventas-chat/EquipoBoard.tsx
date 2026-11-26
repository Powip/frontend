"use client";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, Loader2, Phone, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useReassignConversation } from "@/hooks/useCrmTeam";
import type { CrmStore } from "@/types/crm";
import type { ReviewKind, TeamBoard, TeamBoardMember, TeamBoardWaiting } from "@/types/crmBlockD";
import { bandejaUrl, formatMoney } from "./format";

/** «—», «12 min», «2 h 5 min». (Copia local para no crear un ciclo con EquipoView.) */
function minutes(min: number | null | undefined): string {
  if (min == null || !Number.isFinite(min)) return "—";
  const m = Math.round(min);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h} h ${r} min` : `${h} h`;
}

/**
 * A quién pasar un chat que espera: vendedora en línea, que atiende esa tienda
 * (sin tiendas asignadas = todas) y con menos chats abiertos. Nunca la actual.
 */
export function leastLoaded(
  members: TeamBoardMember[],
  chat: Pick<TeamBoardWaiting, "storeId" | "assignedUserId">,
): TeamBoardMember | null {
  const candidates = members.filter(
    (m) =>
      m.online &&
      m.userId !== chat.assignedUserId &&
      (!chat.storeId || m.storeIds.length === 0 || m.storeIds.includes(chat.storeId)),
  );
  candidates.sort((a, b) => a.openChats - b.openChats || a.userName.localeCompare(b.userName, "es"));
  return candidates[0] ?? null;
}

function BoardKpi({ label, value, hint, tone }: { label: string; value: string | number; hint: string; tone?: "bad" }) {
  return (
    <div className="rounded-lg border bg-card p-4" data-testid="board-kpi">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-2xl font-semibold tabular-nums", tone === "bad" && "text-destructive")}>{value}</p>
      <p className="text-[11px] text-muted-foreground">{hint}</p>
    </div>
  );
}

export function BoardKpis({ board }: { board: TeamBoard }) {
  const k = board.kpis;
  const slow = k.avgFirstResponseMinutes != null && k.avgFirstResponseMinutes > board.slaMinutes;
  return (
    <section aria-label="Hoy" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <BoardKpi
        label="Chats atendidos hoy"
        value={k.chatsToday}
        hint={`${k.sellers} vendedora${k.sellers === 1 ? "" : "s"} · ${k.storesToday} tienda${k.storesToday === 1 ? "" : "s"}`}
      />
      <BoardKpi
        label="Primera respuesta"
        value={minutes(k.avgFirstResponseMinutes)}
        hint={`Meta del negocio: ${board.slaMinutes} min`}
        tone={slow ? "bad" : undefined}
      />
      <BoardKpi label="Fuga hoy" value={k.lostToday} hint="Chats marcados como perdidos" />
      <BoardKpi label="Entregado del mes" value={formatMoney(k.deliveredMonth)} hint="Ventas que salieron de chats" />
    </section>
  );
}

/** Alerta de chats que esperan más que el tiempo de respuesta, con reasignación de un clic. */
export function BoardWaiting({ board, onDone }: { board: TeamBoard; onDone: () => void }) {
  const reassign = useReassignConversation();
  if (board.waiting.length === 0) {
    return (
      <p className="flex items-center gap-2 rounded-lg border bg-emerald-50 p-3 text-sm text-emerald-700 dark:bg-emerald-950/30">
        <CheckCircle2 className="h-4 w-4" /> Ningún chat espera más de {board.slaMinutes} min.
      </p>
    );
  }
  const plan = board.waiting.map((w) => ({ chat: w, to: leastLoaded(board.members, w) }));
  const doable = plan.filter((p) => p.to);
  const reassignAll = async () => {
    for (const p of doable) {
      // Secuencial: cada reasignación cambia la carga de la siguiente.
      await reassign.mutateAsync({ id: p.chat.conversationId, person: { userId: p.to!.userId, userName: p.to!.userName } });
    }
    onDone();
  };
  return (
    <section
      aria-label="Chats en espera"
      className="space-y-2 rounded-lg border border-amber-300 bg-amber-50 p-3 dark:bg-amber-950/20"
      data-testid="board-waiting"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-semibold text-amber-900 dark:text-amber-200">
          <AlertTriangle className="h-4 w-4" />
          {board.waiting.length} chat{board.waiting.length === 1 ? "" : "s"} esperan más de {board.slaMinutes} min
        </p>
        <Button size="sm" disabled={!doable.length || reassign.isPending} onClick={reassignAll}>
          {reassign.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          Reasignar a quien tenga menos carga
        </Button>
      </div>
      <ul className="grid gap-1 text-xs sm:grid-cols-2 xl:grid-cols-3">
        {plan.slice(0, 9).map(({ chat, to }) => (
          <li key={chat.conversationId} className="flex items-center justify-between gap-2 rounded-md bg-background/70 px-2 py-1">
            <Link href={bandejaUrl(chat.conversationId)} className="min-w-0 truncate font-medium hover:underline">
              {chat.contactName ?? "Cliente"}
            </Link>
            <span className="shrink-0 text-muted-foreground">
              {minutes(chat.waitingMinutes)} · {chat.assignedUserName ?? "sin asignar"} → {to?.userName ?? "nadie en línea"}
            </span>
          </li>
        ))}
      </ul>
      {board.waiting.length > 9 && (
        <p className="text-[11px] text-muted-foreground">Y {board.waiting.length - 9} más. Se reasignan todos con el botón.</p>
      )}
    </section>
  );
}

export function SellersTable({ board, stores }: { board: TeamBoard; stores: CrmStore[] }) {
  const storeName = (id: string) => stores.find((s) => s.id === id)?.name ?? id;
  return (
    <section aria-label="Vendedoras" className="space-y-2">
      <div>
        <h2 className="text-sm font-semibold">Vendedoras</h2>
        <p className="text-xs text-muted-foreground">Carga de hoy y resultados del mes. Ordenado por ventas entregadas.</p>
      </div>
      {board.members.length === 0 ? (
        <p className="rounded-md border p-3 text-sm text-muted-foreground">Todavía no hay vendedoras en la rotación ni chats asignados.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm" data-testid="sellers">
            <thead className="bg-muted/40 text-xs">
              <tr>
                {[
                  "Vendedora",
                  "Estado",
                  "Tiendas",
                  "Chats abiertos",
                  "Sin responder",
                  "1ra respuesta",
                  "Venta más rápida",
                  "Ventas por llamada",
                  "Entregado mes",
                  "Conversión",
                ].map((h, i) => (
                  <th key={h} scope="col" className={cn("px-3 py-2 font-medium", i < 3 ? "text-left" : "text-right")}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {board.members.map((m) => (
                <tr key={m.userId} className="border-t" data-testid="seller-row">
                  <th scope="row" className="px-3 py-2 text-left font-medium">
                    {m.userName}
                  </th>
                  <td className="px-3 py-2">
                    <span className="inline-flex items-center gap-1.5 text-xs">
                      <span className={cn("h-2 w-2 rounded-full", m.online ? "bg-emerald-500" : "bg-muted-foreground/40")} />
                      {m.online ? "En línea" : "Ausente"}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {m.storeIds.length ? m.storeIds.map(storeName).join(", ") : m.inRotation ? "Todas" : "—"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{m.openChats}</td>
                  <td className={cn("px-3 py-2 text-right tabular-nums", m.unanswered > 0 && "font-medium text-destructive")}>
                    {m.unanswered}
                  </td>
                  <td
                    className={cn(
                      "px-3 py-2 text-right tabular-nums",
                      m.avgFirstResponseMinutes != null && m.avgFirstResponseMinutes > board.slaMinutes && "text-destructive",
                    )}
                  >
                    {minutes(m.avgFirstResponseMinutes)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{minutes(m.fastestSaleMinutes)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    <span className="inline-flex items-center gap-1">
                      <Phone className="h-3 w-3 text-muted-foreground" /> {m.callSales}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right font-medium tabular-nums">{formatMoney(m.deliveredMonth)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{m.conversionPercent == null ? "—" : `${m.conversionPercent}%`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-[11px] text-muted-foreground">
        Entregado = pedidos del chat con estado de entrega del courier (ENTREGADO). Conversión = pedidos del mes / chats del mes.
      </p>
    </section>
  );
}

const REVIEW_INFO: Record<ReviewKind, { label: string; className: string }> = {
  good: { label: "Buen ejemplo", className: "bg-emerald-100 text-emerald-800" },
  slow: { label: "Respuesta lenta", className: "bg-amber-100 text-amber-800" },
  unanswered: { label: "Quedó sin responder", className: "bg-red-100 text-red-800" },
  lost: { label: "Venta perdida", className: "bg-muted text-muted-foreground" },
};

export function NightReview({ board }: { board: TeamBoard }) {
  return (
    <section aria-label="Revisión de calidad de anoche" className="space-y-2">
      <div>
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Sparkles className="h-4 w-4 text-primary" /> Revisión de calidad de anoche
        </h2>
        <p className="text-xs text-muted-foreground">
          Chats de ayer revisados con reglas fijas (tiempo de respuesta, chats sin contestar, ventas ganadas y perdidas), sin IA.
          Úsalo para capacitar, no para castigar.
        </p>
      </div>
      {board.reviews.length === 0 ? (
        <p className="rounded-md border p-3 text-sm text-muted-foreground">Ayer no hubo chats para revisar.</p>
      ) : (
        <ul className="grid gap-2 md:grid-cols-2 xl:grid-cols-3" data-testid="night-review">
          {board.reviews.map((r) => (
            <li key={`${r.conversationId}:${r.kind}`} className="space-y-1 rounded-lg border p-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <Badge variant="secondary" className={REVIEW_INFO[r.kind].className}>
                  {REVIEW_INFO[r.kind].label}
                </Badge>
                <span className="text-xs text-muted-foreground">{r.userName ?? "Sin asignar"}</span>
              </div>
              <p className="text-xs">
                <b>{r.contactName ?? "Cliente"}</b>
                {r.step != null && <span className="text-muted-foreground"> · llegó al paso {r.step + 1} del guion</span>}
              </p>
              <p className="text-xs text-muted-foreground">{r.detail}</p>
              <Link href={bandejaUrl(r.conversationId)} className="text-xs font-medium text-primary hover:underline">
                Ver chat
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
