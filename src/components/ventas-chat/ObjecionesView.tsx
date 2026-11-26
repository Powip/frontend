"use client";
import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, BookOpen, Check, CheckCircle2, Info, Pencil, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useCrmMe } from "@/hooks/useCrmMe";
import { useObjectionActions, useObjectionStats, useObjections } from "@/hooks/useCrmContent";
import { useObjectionBlockDActions, useObjectionStatsD } from "@/hooks/useCrmBlockD";
import { cn } from "@/lib/utils";
import type { Objection, ObjectionStat } from "@/types/crmContent";
import { OBJECTION_FAMILIES, type ObjectionFamily, type ObjectionStatD } from "@/types/crmBlockD";
import ObjectionDetail, { FamilyBadge, trendLabel, type ObjectionWithExtra } from "./ObjectionDetail";
import { NATIVE_SELECT_CLASS } from "./format";
import ConfirmDialog from "./ConfirmDialog";
import ContentAdminGate from "./ContentAdminGate";
import ObjectionTester from "./ObjectionTester";
import {
  MIN_CONVERSATIONS_FOR_RATE,
  OBJECTION_NAME_MAX,
  OBJECTION_RESPONSE_MAX,
  formatRate,
  wonRate,
} from "./ContentLib";
import { ContentError, ContentLoading } from "./ContentStatus";

const STATS_DAYS = 30;

type AnyStat = Omit<ObjectionStat, "byUser"> &
  Partial<Pick<ObjectionStatD, "previousUses" | "phrases" | "family">> & {
    byUser: { userId: string; userName: string; uses: number; won?: number }[];
  };

function topUser(s: AnyStat | undefined): string {
  if (!s || s.byUser.length === 0) return "—";
  return [...s.byUser].sort((a, b) => (b.won ?? 0) - (a.won ?? 0) || b.uses - a.uses)[0].userName;
}

interface FormProps {
  objection: Objection | null;
  busy: boolean;
  onSave: (v: { name: string; response: string }) => void;
  onClose: () => void;
}

function ObjectionForm({ objection, busy, onSave, onClose }: FormProps) {
  const [name, setName] = useState(objection?.name ?? "");
  const [response, setResponse] = useState(objection?.response ?? "");
  const valid = name.trim() && response.trim();
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!valid || busy) return;
        onSave({ name: name.trim(), response: response.trim() });
      }}
    >
      <DialogHeader>
        <DialogTitle>{objection ? "Editar objeción" : "Nueva objeción"}</DialogTitle>
        <DialogDescription>
          La respuesta se carga en la caja del chat sin enviarse. Pau también la lee mientras esté activa.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-1">
        <Label htmlFor="ob-name">Objeción</Label>
        <Input id="ob-name" maxLength={OBJECTION_NAME_MAX} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej.: Está caro" />
      </div>
      <div className="space-y-1">
        <Label htmlFor="ob-response">Respuesta</Label>
        <Textarea id="ob-response" rows={5} maxLength={OBJECTION_RESPONSE_MAX} value={response} onChange={(e) => setResponse(e.target.value)} />
        <p className="text-right text-[11px] text-muted-foreground">
          {response.length}/{OBJECTION_RESPONSE_MAX}
        </p>
      </div>
      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" disabled={!valid || busy}>
          Guardar objeción
        </Button>
      </DialogFooter>
    </form>
  );
}

function ObjecionesBody() {
  const { isAdmin, stores } = useCrmMe();
  const [storeId, setStoreId] = useState("");
  const [familyFilter, setFamilyFilter] = useState<ObjectionFamily | "">("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const list = useObjections(isAdmin);
  // Estadísticas del bloque D (tendencia, frases y filtro por tienda). Si el
  // servidor todavía no las tiene, se usan las de antes.
  const statsD = useObjectionStatsD(STATS_DAYS, storeId, isAdmin);
  const legacy = useObjectionStats(STATS_DAYS, isAdmin && statsD.isError);
  const stats = statsD.data ? statsD : legacy;
  const actions = useObjectionActions();
  const blockD = useObjectionBlockDActions();
  const [editing, setEditing] = useState<Objection | "new" | null>(null);
  const [deleting, setDeleting] = useState<Objection | null>(null);
  const [discarding, setDiscarding] = useState<Objection | null>(null);
  const busy = actions.create.isPending || actions.update.isPending || actions.remove.isPending;

  // Propuestas desde el chat («Enseñarle la respuesta»): esperan aprobación y no van en la tabla.
  const isPending = (o: Objection) => !!o.proposedByName && !o.active;
  const proposals = useMemo(() => (list.data ?? []).filter(isPending), [list.data]);
  const rows = useMemo(() => (list.data ?? []).filter((o) => !isPending(o)), [list.data]);

  const byId = useMemo(
    () => new Map<string, AnyStat>(((stats.data?.items ?? []) as AnyStat[]).map((s) => [s.objectionId, s])),
    [stats.data],
  );
  const visibleRows = useMemo(
    () => (familyFilter ? rows.filter((o) => (o as ObjectionWithExtra).family === familyFilter) : rows),
    [rows, familyFilter],
  );
  const selected = rows.find((o) => o.id === selectedId) as ObjectionWithExtra | undefined;
  const wonAll = (stats.data?.items ?? []).reduce((n, s) => n + s.won, 0);
  const chatsAll = (stats.data?.items ?? []).reduce((n, s) => n + s.conversations, 0);
  const previousTotal = statsD.data?.previousTotal;
  const mostUsed = useMemo(() => {
    const items = (stats.data?.items ?? []).filter((s) => s.uses > 0);
    return items.length ? [...items].sort((a, b) => b.uses - a.uses)[0] : undefined;
  }, [stats.data]);
  const bestCloser = useMemo(() => {
    const items = (stats.data?.items ?? []).filter((s) => s.conversations >= MIN_CONVERSATIONS_FOR_RATE);
    return items.length
      ? [...items].sort((a, b) => (wonRate(b.won, b.conversations) ?? 0) - (wonRate(a.won, a.conversations) ?? 0))[0]
      : undefined;
  }, [stats.data]);

  // Cada objeción toma como posición su índice: se actualizan solo las dos que cambian.
  const move = (index: number, to: number) => {
    const a = rows[index];
    const b = rows[to];
    if (!a || !b) return;
    // Se intercambian sus posiciones reales (las propuestas ocupan lugares que no se ven en la tabla).
    const pa = a.position === b.position ? to : b.position;
    const pb = a.position === b.position ? index : a.position;
    actions.update.mutate({ id: a.id, input: { position: pa } });
    actions.update.mutate({ id: b.id, input: { position: pb } });
  };

  return (
    <div className="space-y-4">
      <p className="flex items-start gap-2 rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
        <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <span>
          Los números salen de las veces que el equipo usa una respuesta desde el chat (botón «Respuestas»). La detección
          automática (abajo) sugiere la respuesta en el chat.
        </span>
      </p>

      <div className="flex flex-wrap items-center gap-2">
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
        <select
          aria-label="Familia"
          className={cn(NATIVE_SELECT_CLASS, "w-44")}
          value={familyFilter}
          onChange={(e) => setFamilyFilter(e.target.value as ObjectionFamily | "")}
        >
          <option value="">Todas las familias</option>
          {(Object.keys(OBJECTION_FAMILIES) as ObjectionFamily[]).map((f) => (
            <option key={f} value={f}>
              {OBJECTION_FAMILIES[f].label}
            </option>
          ))}
        </select>
        <Button
          size="sm"
          variant="outline"
          className="ml-auto"
          disabled={blockD.library.isPending}
          onClick={() => blockD.library.mutate()}
        >
          <BookOpen /> Cargar respuestas de la metodología (VRPC)
        </Button>
      </div>

      <section aria-label={`Resumen de los últimos ${STATS_DAYS} días`} className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-md border bg-card p-4" data-testid="card-total">
          <p className="text-xs text-muted-foreground">Objeciones en {STATS_DAYS} días</p>
          <p className="text-2xl font-semibold">{stats.data ? stats.data.total : "—"}</p>
          {previousTotal != null && <p className="text-xs text-muted-foreground">Periodo anterior: {previousTotal}</p>}
        </div>
        <div className="rounded-md border bg-card p-4" data-testid="card-top">
          <p className="text-xs text-muted-foreground">La más común</p>
          <p className="break-words sm:truncate text-lg font-semibold">{mostUsed?.name ?? "—"}</p>
          {mostUsed && <p className="text-xs text-muted-foreground">{mostUsed.uses} usos</p>}
        </div>
        <div className="rounded-md border bg-card p-4" data-testid="card-best">
          <p className="text-xs text-muted-foreground">La que más termina en venta</p>
          <p className="break-words sm:truncate text-lg font-semibold">{bestCloser?.name ?? "—"}</p>
          <p className="text-xs text-muted-foreground">
            {bestCloser
              ? `${formatRate(bestCloser.won, bestCloser.conversations)} de ${bestCloser.conversations} conversaciones`
              : `Hace falta al menos ${MIN_CONVERSATIONS_FOR_RATE} conversaciones por objeción.`}
          </p>
          {chatsAll > 0 && (
            <p className="text-[11px] text-muted-foreground">En total: {formatRate(wonAll, chatsAll)} termina en venta</p>
          )}
        </div>
        <div className="rounded-md border bg-card p-4" data-testid="card-proposals">
          <p className="text-xs text-muted-foreground">Nuevas sin respuesta aprobada</p>
          <p className="text-2xl font-semibold">{list.data ? proposals.length : "—"}</p>
          <p className="text-xs text-muted-foreground">Propuestas desde el chat</p>
        </div>
      </section>
      {stats.isError && <ContentError error={stats.error} onRetry={() => stats.refetch()} />}

      {proposals.length > 0 && (
        <section
          aria-labelledby="obj-propuestas"
          className="space-y-3 rounded-md border border-amber-300 bg-amber-50/50 p-4 dark:border-amber-700 dark:bg-amber-950/20"
        >
          <h2 id="obj-propuestas" className="text-base font-semibold">
            Propuestas por aprobar
          </h2>
          <p className="text-sm text-muted-foreground">
            El equipo las propuso desde un chat. Pau no las usa hasta que las apruebes.
          </p>
          <ul className="space-y-2">
            {proposals.map((o) => (
              <li key={o.id} data-testid="proposal-row" className="space-y-2 rounded-md border bg-card p-3">
                <div>
                  <p className="font-medium">{o.name}</p>
                  <p className="whitespace-pre-wrap text-sm text-muted-foreground">{o.response}</p>
                  <p className="text-[11px] text-muted-foreground">Propuesta de {o.proposedByName}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    disabled={busy}
                    aria-label={`Aprobar ${o.name}`}
                    onClick={() => actions.update.mutate({ id: o.id, input: { active: true } })}
                  >
                    <Check /> Aprobar
                  </Button>
                  <Button size="sm" variant="outline" aria-label={`Editar propuesta ${o.name}`} onClick={() => setEditing(o)}>
                    <Pencil /> Editar
                  </Button>
                  <Button size="sm" variant="outline" aria-label={`Descartar ${o.name}`} onClick={() => setDiscarding(o)}>
                    <Trash2 /> Descartar
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="obj-tabla" className="space-y-3 rounded-md border bg-card p-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 id="obj-tabla" className="min-w-0 flex-1 text-base font-semibold">
            Objeciones
          </h2>
          <Button size="sm" onClick={() => setEditing("new")}>
            <Plus /> Nueva objeción
          </Button>
        </div>
        {list.isLoading && <ContentLoading />}
        {list.isError && <ContentError error={list.error} onRetry={() => list.refetch()} />}
        {list.data && rows.length === 0 && (
          <p className="text-sm text-muted-foreground">Aún no hay objeciones. Crea la primera.</p>
        )}
        {list.data && rows.length > 0 && (
          <div className={cn("grid gap-4", selected && "xl:grid-cols-[minmax(0,1fr)_380px]")}>
          <div className="min-w-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Objeción</TableHead>
                <TableHead>Veces</TableHead>
                <TableHead>vs periodo anterior</TableHead>
                <TableHead>Chats</TableHead>
                <TableHead>Terminó en venta</TableHead>
                <TableHead>La levanta mejor</TableHead>
                <TableHead>Qué puede hacer el negocio</TableHead>
                <TableHead>Activa</TableHead>
                <TableHead>
                  <span className="sr-only">Acciones</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleRows.map((o) => {
                const i = rows.indexOf(o);
                const s = byId.get(o.id);
                const x = o as ObjectionWithExtra;
                const trend = s?.previousUses != null ? trendLabel(s.uses, s.previousUses) : null;
                return (
                  <TableRow
                    key={o.id}
                    data-testid="objection-row"
                    className={cn("cursor-pointer", selectedId === o.id && "bg-primary/5")}
                    onClick={(e) => {
                      if ((e.target as HTMLElement).closest("button")) return;
                      setSelectedId(o.id === selectedId ? null : o.id);
                    }}
                  >
                    <TableCell className="max-w-xs">
                      <p className="font-medium">
                        {o.name} {!o.active && <Badge variant="outline">Inactiva</Badge>} <FamilyBadge family={x.family} />
                      </p>
                      <p className="break-words sm:truncate text-xs text-muted-foreground">{o.response}</p>
                    </TableCell>
                    <TableCell>{s?.uses ?? 0}</TableCell>
                    <TableCell
                      className={cn(
                        "tabular-nums",
                        trend?.tone === "up" && "text-destructive",
                        trend?.tone === "down" && "text-emerald-700",
                      )}
                    >
                      {trend?.text ?? "—"}
                    </TableCell>
                    <TableCell>{s?.conversations ?? 0}</TableCell>
                    <TableCell data-testid="obj-rate">{formatRate(s?.won ?? 0, s?.conversations ?? 0)}</TableCell>
                    <TableCell>{topUser(s)}</TableCell>
                    <TableCell className="max-w-[220px] text-xs">
                      {x.businessAction ? (
                        <span className={cn(x.actionDoneAt && "text-emerald-700")}>
                          {x.actionDoneAt && <CheckCircle2 className="mr-1 inline h-3 w-3" />}
                          {x.businessAction}
                        </span>
                      ) : x.family ? (
                        <span className="text-muted-foreground">{OBJECTION_FAMILIES[x.family].lever}</span>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>
                      <Switch
                        aria-label={`Activar ${o.name}`}
                        checked={o.active}
                        disabled={busy}
                        onCheckedChange={(active) => actions.update.mutate({ id: o.id, input: { active } })}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="icon-sm" variant="ghost" aria-label={`Subir ${o.name}`} disabled={busy || i === 0} onClick={() => move(i, i - 1)}>
                          <ArrowUp />
                        </Button>
                        <Button size="icon-sm" variant="ghost" aria-label={`Bajar ${o.name}`} disabled={busy || i === rows.length - 1} onClick={() => move(i, i + 1)}>
                          <ArrowDown />
                        </Button>
                        <Button size="icon-sm" variant="ghost" aria-label={`Editar ${o.name}`} onClick={() => setEditing(o)}>
                          <Pencil />
                        </Button>
                        <Button size="icon-sm" variant="ghost" aria-label={`Eliminar ${o.name}`} onClick={() => setDeleting(o)}>
                          <Trash2 />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          </div>
          {selected && (
            <ObjectionDetail
              key={selected.id}
              objection={selected}
              stat={byId.get(selected.id) as ObjectionStatD | undefined}
              onEdit={() => setEditing(selected)}
              onClose={() => setSelectedId(null)}
            />
          )}
          </div>
        )}
      </section>

      <ObjectionTester />

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          {editing && (
            <ObjectionForm
              key={editing === "new" ? "new" : editing.id}
              objection={editing === "new" ? null : editing}
              busy={busy}
              onClose={() => setEditing(null)}
              onSave={(v) => {
                if (editing === "new") actions.create.mutate(v, { onSuccess: () => setEditing(null) });
                else actions.update.mutate({ id: editing.id, input: v }, { onSuccess: () => setEditing(null) });
              }}
            />
          )}
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={!!discarding}
        title="¿Descartar esta propuesta?"
        description={`Se descartará «${discarding?.name ?? ""}». Esta acción no se puede deshacer.`}
        confirmLabel="Descartar"
        onCancel={() => setDiscarding(null)}
        onConfirm={() => {
          const o = discarding;
          setDiscarding(null);
          if (o) actions.remove.mutate(o.id);
        }}
      />
      <ConfirmDialog
        open={!!deleting}
        title="¿Eliminar esta objeción?"
        description={`Se eliminará «${deleting?.name ?? ""}» y sus estadísticas de uso. Esta acción no se puede deshacer.`}
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          const o = deleting;
          setDeleting(null);
          if (o) actions.remove.mutate(o.id);
        }}
      />
    </div>
  );
}

export default function ObjecionesView() {
  return (
    <ContentAdminGate>
      <ObjecionesBody />
    </ContentAdminGate>
  );
}
