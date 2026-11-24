"use client";
import { useEffect, useState } from "react";
import { BookOpen, ExternalLink, MessageSquareQuote, Search, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useUpdateConversation } from "@/hooks/useCrmChat";
import {
  useGeneralMaterials,
  useObjections,
  useRegisterObjectionUse,
  useScript,
  useSheets,
} from "@/hooks/useCrmContent";
import { useDetectObjection } from "@/hooks/useCrmSalesTools";
import type { Conversation } from "@/types/crm";
import type { Material } from "@/types/crmContent";
import ConfirmDialog from "./ConfirmDialog";
import { MATERIAL_KIND_LABEL, firstName, materialText, stepText } from "./ContentLib";

interface Props {
  conversation: Conversation;
  /** Texto actual de la caja de mensaje. */
  text: string;
  /** Pone el texto en la caja SIN enviarlo. */
  onFill: (text: string) => void;
  /** La ventana de 24 h está cerrada: la caja está bloqueada. */
  windowOpen: boolean;
  /**
   * La pantalla ya muestra los pasos (barra «Venta en 1 minuto») y la objeción
   * detectada (tarjeta «Sugerencia»): aquí solo queda el panel «Respuestas».
   */
  compact?: boolean;
}

/** Barra «Guion» y panel «Respuestas» sobre la caja de mensaje. Nada se envía solo. */
export default function ContentChatBar({ conversation, text, onFill, windowOpen, compact = false }: Props) {
  const script = useScript();
  const objections = useObjections();
  const general = useGeneralMaterials();
  const update = useUpdateConversation(conversation.id);
  const registerUse = useRegisterObjectionUse(conversation.id);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [pendingStep, setPendingStep] = useState<number | null>(null);
  const sheets = useSheets(debounced);
  // Detección automática: se pide una vez por cada mensaje nuevo del cliente.
  const trigger = conversation.lastInboundAt ?? null;
  const detection = useDetectObjection(conversation.id, trigger, windowOpen && !compact);
  const [dismissed, setDismissed] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 250);
    return () => clearTimeout(t);
  }, [search]);

  const steps = script.data?.steps ?? [];
  const activeObjections = (objections.data ?? []).filter((o) => o.active);
  const generalItems = general.data ?? [];
  const sheetItems = (sheets.data ?? []).filter((s) => s.active);
  const hasSheets = sheetItems.length > 0 || debounced !== "";
  const hasReplies = activeObjections.length > 0 || generalItems.length > 0 || hasSheets;

  if ((compact || steps.length === 0) && !hasReplies) return null;

  const name = firstName(conversation);

  const applyStep = (i: number) => {
    onFill(stepText(steps[i], name));
    update.mutate({ scriptStep: i });
  };
  const clickStep = (i: number) => {
    if (text.trim()) setPendingStep(i);
    else applyStep(i);
  };

  /** Inserta sin pisar lo escrito: si la caja ya tiene texto, lo añade en otra línea. */
  const insert = (value: string) => {
    onFill(text.trim() ? `${text.replace(/\s+$/, "")}\n${value}` : value);
    setOpen(false);
  };
  const insertMaterial = (m: Material) => insert(materialText(m));

  const detected = detection.data;
  const showDetected =
    !compact && !!detected?.label && !!detected.suggestedResponse && dismissed !== trigger;

  const materialButton = (m: Material) => (
    <button
      key={m.id}
      type="button"
      onClick={() => insertMaterial(m)}
      className="flex w-full items-center gap-2 rounded-md border px-2 py-1.5 text-left text-xs hover:bg-accent/50"
    >
      <span className="shrink-0 rounded bg-secondary px-1.5 py-0.5 text-[10px]">{MATERIAL_KIND_LABEL[m.kind]}</span>
      <span className="min-w-0 flex-1 break-words sm:truncate">{m.title}</span>
      <ExternalLink className="h-3 w-3 shrink-0 opacity-50" aria-hidden />
    </button>
  );

  return (
    <div role="region" aria-label="Guion" className="mb-2" data-testid="content-bar">
      <div className="flex flex-wrap items-center gap-1.5 rounded-md border bg-muted/40 px-2 py-1.5">
        {!compact && steps.length > 0 && (
          <>
            <BookOpen className="h-4 w-4 shrink-0 text-primary" aria-hidden />
            <span className="text-xs font-medium">Guion</span>
            <ol className="flex flex-wrap items-center gap-1">
              {steps.map((s, i) => {
                const current = conversation.scriptStep === i;
                return (
                  <li key={i}>
                    <button
                      type="button"
                      disabled={!windowOpen || update.isPending}
                      aria-current={current ? "step" : undefined}
                      title={s.message}
                      onClick={() => clickStep(i)}
                      className={cn(
                        "rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                        current
                          ? "border-primary bg-primary text-primary-foreground"
                          : "bg-background hover:bg-accent",
                      )}
                    >
                      {i + 1}. {s.name}
                    </button>
                  </li>
                );
              })}
            </ol>
          </>
        )}
        {hasReplies && (
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button size="sm" variant="outline" className="ml-auto" disabled={!windowOpen}>
                <MessageSquareQuote /> Respuestas
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="max-h-[70vh] w-[min(26rem,90vw)] space-y-4 overflow-y-auto">
              <section aria-label="Objeciones" className="space-y-1.5">
                <h3 className="text-xs font-semibold uppercase text-muted-foreground">Objeciones</h3>
                {activeObjections.length === 0 && <p className="text-xs text-muted-foreground">No hay objeciones activas.</p>}
                {activeObjections.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => {
                      insert(o.response);
                      registerUse.mutate(o.id);
                    }}
                    className="block w-full rounded-md border px-2 py-1.5 text-left hover:bg-accent/50"
                  >
                    <span className="block text-xs font-medium">{o.name}</span>
                    <span className="sm:line-clamp-2 text-xs text-muted-foreground">{o.response}</span>
                  </button>
                ))}
              </section>
              <section aria-label="Material" className="space-y-1.5">
                <h3 className="text-xs font-semibold uppercase text-muted-foreground">Material</h3>
                {generalItems.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium">Del negocio</p>
                    {generalItems.map(materialButton)}
                  </div>
                )}
                <Input
                  icon={Search}
                  aria-label="Buscar producto"
                  placeholder="Buscar producto…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                {sheetItems.length === 0 && debounced !== "" && (
                  <p className="text-xs text-muted-foreground">Ningún producto coincide.</p>
                )}
                {sheetItems.map((s) => (
                  <div key={s.id} className="space-y-1 rounded-md border p-2" data-testid="chat-sheet">
                    <p className="text-xs font-semibold">{s.name}</p>
                    {s.price && (
                      <button
                        type="button"
                        aria-label={`Insertar precio de ${s.name}`}
                        onClick={() => insert(`${s.name}: ${s.price}`)}
                        className="block w-full rounded border px-2 py-1 text-left text-xs hover:bg-accent/50"
                      >
                        <span className="font-medium">Precio:</span> {s.price}
                      </button>
                    )}
                    {s.highlights && (
                      <button
                        type="button"
                        aria-label={`Insertar qué destacar de ${s.name}`}
                        onClick={() => insert(s.highlights)}
                        className="block w-full rounded border px-2 py-1 text-left text-xs hover:bg-accent/50"
                      >
                        <span className="font-medium">Destacar:</span> {s.highlights}
                      </button>
                    )}
                    {s.materials.map(materialButton)}
                  </div>
                ))}
              </section>
            </PopoverContent>
          </Popover>
        )}
      </div>
      {showDetected && detected && (
        <div
          role="status"
          aria-label="Objeción detectada"
          data-testid="objection-detected"
          className="mt-1.5 flex items-start gap-2 rounded-md border border-primary/30 bg-primary/5 px-2 py-1.5"
        >
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium">
              Posible objeción: {detected.label}{" "}
              <span className="font-normal text-muted-foreground">
                ({Math.round(detected.confidence * 100)} %{detected.source === "mock" ? " · reglas" : " · IA"})
              </span>
            </p>
            <p className="sm:line-clamp-2 text-xs text-muted-foreground">{detected.suggestedResponse}</p>
          </div>
          <Button
            size="sm"
            variant="outline"
            disabled={!windowOpen}
            onClick={() => {
              insert(detected.suggestedResponse as string);
              if (detected.objectionId) registerUse.mutate(detected.objectionId);
              setDismissed(trigger);
            }}
          >
            Usar respuesta
          </Button>
          <button
            type="button"
            aria-label="Descartar sugerencia"
            onClick={() => setDismissed(trigger)}
            className="rounded p-1 text-muted-foreground hover:bg-accent"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>
      )}
      <ConfirmDialog
        open={pendingStep !== null}
        title="¿Reemplazar lo que escribiste?"
        description="La caja ya tiene texto. El paso del guion lo reemplazará. No se envía nada: podrás revisarlo antes."
        confirmLabel="Reemplazar"
        onCancel={() => setPendingStep(null)}
        onConfirm={() => {
          const i = pendingStep;
          setPendingStep(null);
          if (i !== null) applyStep(i);
        }}
      />
    </div>
  );
}
