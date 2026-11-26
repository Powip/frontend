"use client";
import { useState } from "react";
import Link from "next/link";
import { Loader2, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { crmError } from "@/services/crmService";
import { useConversationFollowups, useCrmTags, useUpdateConversation } from "@/hooks/useCrmChat";
import { useFollowupRules } from "@/hooks/useCrmEngagement";
import { usePipelines } from "@/hooks/useCrmPlanning";
import { pipelineOf } from "@/lib/crmPipelines";
import type { Conversation } from "@/types/crm";
import { OBJECTIVE_LABEL, formatWait } from "./engagement";
import { formatDue } from "./agenda";

export const TAG_MAX = 30;
export const TAGS_MAX = 10;

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
    </h3>
  );
}

const same = (a: string, b: string) => a.toLocaleLowerCase("es") === b.toLocaleLowerCase("es");

/** Etiquetas del chat: chips con quitar y alta con sugerencias de las ya usadas. */
export function TagsSection({ conversation }: { conversation: Conversation }) {
  const update = useUpdateConversation(conversation.id);
  const suggestions = useCrmTags();
  const [input, setInput] = useState("");
  const tags = conversation.tags ?? [];
  const full = tags.length >= TAGS_MAX;

  const save = (next: string[]) => update.mutate({ tags: next });
  const add = (raw: string) => {
    const tag = raw.trim().slice(0, TAG_MAX);
    if (!tag || full || update.isPending) return;
    setInput("");
    if (tags.some((t) => same(t, tag))) return;
    save([...tags, tag]);
  };

  const typed = input.trim();
  const suggested = (Array.isArray(suggestions.data) ? suggestions.data : [])
    .filter((s) => !tags.some((t) => same(t, s)))
    .filter((s) => !typed || s.toLocaleLowerCase("es").includes(typed.toLocaleLowerCase("es")))
    .slice(0, 6);

  return (
    <section className="space-y-2" aria-label="Etiquetas">
      <SectionTitle>Etiquetas</SectionTitle>
      {tags.length === 0 && <p className="text-sm text-muted-foreground">Sin etiquetas.</p>}
      {tags.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {tags.map((t) => (
            <li
              key={t}
              data-testid="tag-chip"
              className="inline-flex items-center gap-1 rounded-full border bg-muted/50 py-0.5 pl-2 pr-1 text-xs"
            >
              {t}
              <button
                type="button"
                aria-label={`Quitar etiqueta ${t}`}
                disabled={update.isPending}
                className="rounded-full p-0.5 hover:bg-accent"
                onClick={() => save(tags.filter((x) => x !== t))}
              >
                <X className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {!full && (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            add(input);
          }}
        >
          <Input
            value={input}
            maxLength={TAG_MAX}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Nueva etiqueta"
            aria-label="Nueva etiqueta"
          />
          <Button type="submit" size="sm" variant="outline" disabled={!typed || update.isPending}>
            <Plus /> Añadir
          </Button>
        </form>
      )}
      {full && <p className="text-xs text-muted-foreground">Máximo {TAGS_MAX} etiquetas por chat.</p>}
      {!full && suggested.length > 0 && (
        <div role="group" aria-label="Etiquetas sugeridas" className="flex flex-wrap gap-1.5">
          {suggested.map((s) => (
            <button
              key={s}
              type="button"
              disabled={update.isPending}
              className="rounded-full border border-dashed px-2 py-0.5 text-xs text-muted-foreground hover:bg-accent"
              onClick={() => add(s)}
            >
              + {s}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

/** Seguimientos automáticos que saldrán si el cliente no responde. */
export function FollowupsSection({ conversation }: { conversation: Conversation }) {
  const q = useConversationFollowups(conversation.id);
  const items = Array.isArray(q.data) ? q.data : [];
  return (
    <section className="space-y-2" aria-label="Próximos seguimientos">
      <SectionTitle>Próximos seguimientos</SectionTitle>
      {q.isLoading && (
        <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando seguimientos…
        </p>
      )}
      {q.isError && (
        <p role="alert" className="text-sm text-destructive">
          {crmError(q.error).message}
        </p>
      )}
      {q.data && items.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No hay seguimientos automáticos programados para este chat.
        </p>
      )}
      {items.length > 0 && (
        <ul className="space-y-1.5">
          {items.map((f) => (
            <li key={`${f.ruleId}-${f.dueAt}`} data-testid="followup-item" className="rounded-md border p-2 text-sm">
              <p className="break-words sm:truncate font-medium">{f.ruleName}</p>
              <p className="text-xs text-muted-foreground">
                {OBJECTIVE_LABEL[f.objective] ?? f.objective} ·{" "}
                {f.target === "agent" ? "avisa a la vendedora" : "mensaje al cliente"} · {formatDue(f.dueAt)}
              </p>
              {f.viaTemplate && (
                <p className="text-[11px] text-amber-700 dark:text-amber-400">
                  Saldrá por plantilla: la ventana de 24 h ya estará cerrada.
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Reglas automáticas activas que valen para la etapa actual del chat. */
export function StageRulesSection({ conversation }: { conversation: Conversation }) {
  const rules = useFollowupRules();
  const pipeline = pipelineOf(usePipelines().data, conversation);
  if (!Array.isArray(rules.data)) return null;
  const stage = pipeline?.stages.find((s) => s.id === conversation.stageId);
  // Mismo criterio que el motor: sin etapa, la regla vale para las etapas abiertas.
  const open = !stage || stage.kind === "open";
  const applied = rules.data.filter(
    (r) => r.active && (r.stageId ? r.stageId === conversation.stageId : open),
  );
  return (
    <section className="space-y-2" aria-label="Reglas que aplican">
      <SectionTitle>Reglas que aplican</SectionTitle>
      {applied.length === 0 && (
        <p className="text-sm text-muted-foreground">
          {stage
            ? `Ninguna regla automática para la etapa ${stage.name}.`
            : "Ninguna regla automática para este chat."}
        </p>
      )}
      <ul className="space-y-1">
        {applied.map((r) => (
          <li key={r.id} className="flex items-center justify-between gap-2 text-sm">
            <span className="min-w-0 break-words">{r.name}</span>
            <span className="shrink-0 text-xs text-muted-foreground">{formatWait(r.waitMinutes)}</span>
          </li>
        ))}
      </ul>
      <Button asChild size="sm" variant="outline">
        <Link href="/comercial/ventas-chat/seguimientos">Ver reglas</Link>
      </Button>
    </section>
  );
}
