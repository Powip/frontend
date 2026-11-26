"use client";
import { useState } from "react";
import { Check, Plus, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCrmMe } from "@/hooks/useCrmMe";
import { useSheets } from "@/hooks/useCrmContent";
import { useTestimonies, useTestimonyActions } from "@/hooks/useCrmBlockDK";
import { cn } from "@/lib/utils";
import type { MaterialStatus, Testimony } from "@/types/crmBlockDK";
import { ContentError, ContentLoading } from "./ContentStatus";
import { NATIVE_SELECT_CLASS } from "./format";

const FILTERS: Array<{ key: MaterialStatus; label: string }> = [
  { key: "pending", label: "Por aprobar" },
  { key: "published", label: "Publicados" },
  { key: "rejected", label: "Rechazados" },
];

const STATUS_PILL: Record<MaterialStatus, { label: string; className: string }> = {
  pending: { label: "Por aprobar", className: "border-amber-300 bg-amber-50 text-amber-800" },
  published: { label: "Publicado", className: "border-emerald-300 bg-emerald-50 text-emerald-800" },
  rejected: { label: "Rechazado", className: "border-red-300 bg-red-50 text-red-700" },
};

function ProposeForm({ onDone }: { onDone: () => void }) {
  const sheets = useSheets("");
  const { propose } = useTestimonyActions();
  const [sheetId, setSheetId] = useState("");
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const ok = sheetId && title.trim() && /^https?:\/\//i.test(url.trim());
  return (
    <form
      aria-label="Proponer testimonio"
      className="grid gap-2 rounded-md border bg-background p-3 md:grid-cols-[1fr_1fr_1.4fr_auto]"
      onSubmit={(e) => {
        e.preventDefault();
        if (!ok) return;
        propose.mutate({ sheetId, title: title.trim(), url: url.trim() }, { onSuccess: onDone });
      }}
    >
      <select
        aria-label="Producto del testimonio"
        className={cn(NATIVE_SELECT_CLASS, "h-9 text-sm")}
        value={sheetId}
        onChange={(e) => setSheetId(e.target.value)}
      >
        <option value="">Producto…</option>
        {(sheets.data ?? []).map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
      <Input aria-label="Título del testimonio" placeholder="Foto de Ana · Lima" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={160} />
      <Input aria-label="Enlace del testimonio" placeholder="https://…" value={url} onChange={(e) => setUrl(e.target.value)} />
      <Button type="submit" size="sm" className="h-9" disabled={!ok || propose.isPending}>
        Enviar
      </Button>
    </form>
  );
}

function Row({ item, canReview }: { item: Testimony; canReview: boolean }) {
  const { review } = useTestimonyActions();
  const pill = STATUS_PILL[item.status];
  const busy = review.isPending && review.variables?.item.id === item.id;
  return (
    <li className="flex flex-wrap items-center gap-2 rounded-md bg-card px-2 py-1.5">
      <span aria-hidden className="size-8 flex-none rounded-md bg-amber-100" />
      <span className="min-w-0 grow">
        <a href={item.url} target="_blank" rel="noreferrer" className="block truncate text-sm font-semibold hover:underline">
          {item.title}
        </a>
        <small className="block text-[11.5px] text-muted-foreground">
          {[item.sheetName ?? "Sin producto", item.proposedByName ? `Del chat · ${item.proposedByName}` : null, item.reviewedByName ? `Revisó ${item.reviewedByName}` : null]
            .filter(Boolean)
            .join(" · ")}
        </small>
      </span>
      {item.status === "pending" && canReview ? (
        <>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => review.mutate({ item, status: "published" })}>
            <Check className="size-3.5" />
            Aprobar
          </Button>
          <Button size="sm" variant="ghost" className="text-red-600" disabled={busy} onClick={() => review.mutate({ item, status: "rejected" })}>
            Rechazar
          </Button>
        </>
      ) : (
        <Badge variant="outline" className={pill.className}>
          {pill.label}
        </Badge>
      )}
    </li>
  );
}

/**
 * Testimonios por aprobar (mockup 152, K4). La vendedora propone; el primero de un
 * producto se publica solo y los demás esperan al supervisor o administrador.
 */
export default function GuionTestimonies() {
  const { isSupervisor } = useCrmMe();
  const [filter, setFilter] = useState<MaterialStatus>("pending");
  const [proposing, setProposing] = useState(false);
  const list = useTestimonies(filter);
  const pending = list.data?.pending ?? 0;
  const items = list.data?.items ?? [];

  return (
    <section
      aria-labelledby="guion-testimonios"
      className="space-y-2 rounded-xl border border-amber-300/70 bg-amber-50/70 p-3 dark:bg-amber-950/20"
    >
      <div className="flex flex-wrap items-center gap-2">
        <h2 id="guion-testimonios" className="grow text-sm font-semibold">
          <Star aria-hidden className="mr-1 inline size-3.5 -translate-y-px text-amber-500" />
          {pending} {pending === 1 ? "testimonio por aprobar" : "testimonios por aprobar"}
        </h2>
        <div role="tablist" aria-label="Filtrar testimonios" className="flex gap-1">
          {FILTERS.map((f) => (
            <Button
              key={f.key}
              role="tab"
              aria-selected={filter === f.key}
              size="sm"
              variant={filter === f.key ? "secondary" : "ghost"}
              className="h-7"
              onClick={() => setFilter(f.key)}
            >
              {f.label}
            </Button>
          ))}
        </div>
        <Button size="sm" variant="outline" className="h-7" onClick={() => setProposing((v) => !v)} aria-expanded={proposing}>
          <Plus className="size-3.5" />
          Proponer testimonio
        </Button>
      </div>
      {proposing && <ProposeForm onDone={() => setProposing(false)} />}
      {list.isLoading && <ContentLoading />}
      {list.isError && <ContentError error={list.error} onRetry={() => list.refetch()} />}
      {list.data && items.length === 0 && (
        <p className="text-sm text-muted-foreground">
          {filter === "pending"
            ? "No hay testimonios esperando. Lo que propongan las vendedoras aparece aquí."
            : filter === "published"
              ? "Aún no hay testimonios publicados."
              : "No hay testimonios rechazados."}
        </p>
      )}
      {items.length > 0 && (
        <ul className="space-y-1.5" aria-label="Testimonios">
          {items.map((t) => (
            <Row key={t.id} item={t} canReview={isSupervisor} />
          ))}
        </ul>
      )}
      {!isSupervisor && (
        <p className="text-[11px] text-muted-foreground">Ya hay testimonios: lo que subas lo aprueba el supervisor.</p>
      )}
    </section>
  );
}
