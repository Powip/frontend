"use client";
import { useState } from "react";
import { CheckCircle2, Pencil, Quote, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useObjectionBlockDActions } from "@/hooks/useCrmBlockD";
import type { Objection } from "@/types/crmContent";
import { OBJECTION_FAMILIES, type ObjectionExtra, type ObjectionFamily, type ObjectionStatD } from "@/types/crmBlockD";
import { NATIVE_SELECT_CLASS } from "./format";
import { formatRate } from "./ContentLib";

export type ObjectionWithExtra = Objection & Omit<ObjectionExtra, "id">;

/** Variación contra el periodo anterior: «+3», «−2», «=» o «nueva». */
export function trendLabel(uses: number, previous: number): { text: string; tone: "up" | "down" | "flat" } {
  if (previous === 0) return uses > 0 ? { text: "nueva", tone: "up" } : { text: "=", tone: "flat" };
  const diff = uses - previous;
  if (diff === 0) return { text: "=", tone: "flat" };
  const pct = Math.round((diff / previous) * 100);
  return diff > 0 ? { text: `+${pct}%`, tone: "up" } : { text: `${pct}%`, tone: "down" };
}

export function FamilyBadge({ family }: { family?: ObjectionFamily }) {
  if (!family) return null;
  return (
    <Badge variant="secondary" className="bg-primary/10 text-primary">
      {OBJECTION_FAMILIES[family].label}
    </Badge>
  );
}

/** Panel de detalle de una objeción (mockup 152): frases reales, respuesta oficial, quién la levanta mejor y acción del negocio. */
export default function ObjectionDetail({
  objection,
  stat,
  onEdit,
  onClose,
}: {
  objection: ObjectionWithExtra;
  stat?: ObjectionStatD;
  onEdit: () => void;
  onClose: () => void;
}) {
  const { update } = useObjectionBlockDActions();
  const [action, setAction] = useState<string | null>(null);
  const draft = action ?? objection.businessAction ?? "";
  const family = objection.family;
  const info = family ? OBJECTION_FAMILIES[family] : null;
  const best = stat?.byUser.length ? [...stat.byUser].sort((a, b) => b.won - a.won || b.uses - a.uses) : [];
  return (
    <aside aria-label={`Detalle de ${objection.name}`} className="space-y-4 rounded-lg border bg-card p-4" data-testid="objection-detail">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <h3 className="text-base font-semibold">{objection.name}</h3>
          <FamilyBadge family={family} />
        </div>
        <Button size="icon-sm" variant="ghost" aria-label="Cerrar detalle" onClick={onClose}>
          <X />
        </Button>
      </div>

      <label className="block space-y-1 text-xs">
        <span className="font-medium">Familia (metodología VRPC)</span>
        <select
          className={NATIVE_SELECT_CLASS}
          value={family ?? ""}
          onChange={(e) => update.mutate({ id: objection.id, family: e.target.value as ObjectionFamily })}
        >
          {(Object.keys(OBJECTION_FAMILIES) as ObjectionFamily[]).map((f) => (
            <option key={f} value={f}>
              {OBJECTION_FAMILIES[f].label}
            </option>
          ))}
        </select>
        {info && (
          <span className="block text-muted-foreground">
            Siente: {info.feels}. Palanca: {info.lever}.
          </span>
        )}
      </label>

      <section className="space-y-1">
        <h4 className="text-xs font-semibold">Así lo dicen tus clientes</h4>
        {stat?.phrases.length ? (
          <ul className="space-y-1">
            {stat.phrases.map((p) => (
              <li key={p} className="flex gap-2 rounded-md bg-muted/50 px-2 py-1 text-xs">
                <Quote className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" /> {p}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">Aún no hay chats donde se haya usado esta respuesta.</p>
        )}
      </section>

      <section className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-xs font-semibold">Respuesta oficial (la usa también la IA)</h4>
          <Button size="sm" variant="outline" onClick={onEdit}>
            <Pencil /> Editar
          </Button>
        </div>
        <p className="whitespace-pre-wrap rounded-md border p-2 text-sm">{objection.response}</p>
      </section>

      <section className="space-y-1">
        <h4 className="text-xs font-semibold">Quién la levanta mejor</h4>
        {best.length ? (
          <ul className="space-y-1 text-xs">
            {best.slice(0, 5).map((u) => (
              <li key={u.userId} className="flex justify-between gap-2">
                <span>{u.userName}</span>
                <span className="tabular-nums text-muted-foreground">
                  {u.won} venta{u.won === 1 ? "" : "s"} · {u.uses} uso{u.uses === 1 ? "" : "s"}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">Sin usos en el periodo.</p>
        )}
        {stat && (
          <p className="text-[11px] text-muted-foreground">
            Terminó en venta: {formatRate(stat.won, stat.conversations)} de {stat.conversations} chats.
          </p>
        )}
      </section>

      <section className="space-y-1">
        <h4 className="text-xs font-semibold">Qué puede hacer el negocio</h4>
        <Textarea
          rows={3}
          maxLength={400}
          value={draft}
          placeholder={info ? `Ej.: ${info.lever}` : "Ej.: ofrecer pago contraentrega"}
          onChange={(e) => setAction(e.target.value)}
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={action == null || update.isPending}
            onClick={() => update.mutate({ id: objection.id, businessAction: draft.trim() }, { onSuccess: () => setAction(null) })}
          >
            Guardar
          </Button>
          {objection.actionDoneAt ? (
            <span className="inline-flex items-center gap-1 text-xs text-emerald-700">
              <CheckCircle2 className="h-4 w-4" /> Hecho
              <button
                type="button"
                className="ml-1 text-muted-foreground underline"
                onClick={() => update.mutate({ id: objection.id, actionDone: false })}
              >
                deshacer
              </button>
            </span>
          ) : (
            <Button
              size="sm"
              disabled={!draft.trim() || update.isPending}
              onClick={() => update.mutate({ id: objection.id, businessAction: draft.trim(), actionDone: true })}
            >
              <CheckCircle2 /> Marcar como hecho
            </Button>
          )}
        </div>
      </section>
    </aside>
  );
}
