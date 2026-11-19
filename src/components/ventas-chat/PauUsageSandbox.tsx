"use client";
import { useRef, useState } from "react";
import { Loader2, RotateCcw, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { crmError } from "@/services/crmService";
import { usePauSandbox, usePauUsage, useUpdatePauSettings } from "@/hooks/useCrmPau";
import type { PauSandboxResult, PauSandboxTurn } from "@/types/crm";
import { CRM_UNREACHABLE } from "./ConversationList";
import { PAU_MIN_CAP, capPercent, describeToolCall, formatTokens, groupUsage } from "./pau";

export function UsageSection() {
  const usage = usePauUsage();
  const update = useUpdatePauSettings();
  const [capDraft, setCapDraft] = useState<string | null>(null);
  const [capError, setCapError] = useState<string | null>(null);
  const u = usage.data;
  const err = usage.isError ? crmError(usage.error) : null;

  const capValue = capDraft ?? (u?.monthlyTokenCap != null ? String(u.monthlyTokenCap) : "");
  const percent = u ? capPercent(u.totalTokens, u.monthlyTokenCap) : null;

  const saveCap = () => {
    const n = Number(capValue.replace(/[\s.,]/g, ""));
    if (!capValue.trim() || !Number.isInteger(n) || n < PAU_MIN_CAP) {
      setCapError(`El tope debe ser un número de al menos ${formatTokens(PAU_MIN_CAP)} tokens`);
      return;
    }
    setCapError(null);
    update.mutate(
      { monthlyTokenCap: n },
      { onSuccess: () => { setCapDraft(null); usage.refetch(); } },
    );
  };
  const removeCap = () => {
    setCapError(null);
    update.mutate(
      { monthlyTokenCap: null },
      { onSuccess: () => { setCapDraft(null); usage.refetch(); } },
    );
  };

  return (
    <section aria-labelledby="pau-consumo" className="space-y-3 rounded-md border bg-card p-4">
      <div>
        <h2 id="pau-consumo" className="text-base font-semibold">Consumo del mes</h2>
        <p className="text-sm text-muted-foreground">
          Se cuenta en tokens (la medida del proveedor). El costo en dinero lo ves en la cuenta de tu proveedor.
        </p>
      </div>
      {usage.isLoading && (
        <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando consumo…
        </p>
      )}
      {err && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {err.unreachable ? CRM_UNREACHABLE : err.message}
        </p>
      )}
      {u && (
        <>
          <div className="grid gap-2 sm:grid-cols-4">
            {(
              [
                ["Tokens de entrada", u.inputTokens],
                ["Tokens de salida", u.outputTokens],
                ["Tokens en total", u.totalTokens],
                ["Llamadas al modelo", u.calls],
              ] as Array<[string, number]>
            ).map(([label, value]) => (
              <div key={label} className="rounded-md border p-3" data-testid="usage-stat">
                <p className="text-xl font-semibold tabular-nums">{formatTokens(value)}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>
          <ul className="space-y-1 text-sm" aria-label="Consumo por tipo">
            {groupUsage(u).map((g) => (
              <li key={g.label} className="flex flex-wrap justify-between gap-2" data-testid="usage-kind">
                <span>{g.label}</span>
                <span className="text-muted-foreground">
                  {formatTokens(g.calls)} llamadas · {formatTokens(g.inputTokens)} entrada ·{" "}
                  {formatTokens(g.outputTokens)} salida
                </span>
              </li>
            ))}
          </ul>
          {percent != null && u.monthlyTokenCap != null && (
            <div className="space-y-1" data-testid="usage-cap">
              <Progress value={percent} aria-label="Uso del tope mensual" />
              <p className="text-xs text-muted-foreground">
                {formatTokens(u.totalTokens)} de {formatTokens(u.monthlyTokenCap)} tokens ({percent} %)
                {percent >= 100 && " · Tope alcanzado: Pau no responderá hasta el próximo mes o hasta subir el tope."}
              </p>
            </div>
          )}
        </>
      )}
      <div className="space-y-1.5">
        <Label htmlFor="pau-cap">Tope mensual de tokens</Label>
        <div className="flex flex-wrap gap-2">
          <Input
            id="pau-cap"
            inputMode="numeric"
            className="max-w-48"
            value={capValue}
            onChange={(e) => setCapDraft(e.target.value)}
            placeholder="Sin tope"
          />
          <Button size="sm" onClick={saveCap} disabled={update.isPending || capDraft === null}>
            Fijar tope
          </Button>
          {u?.monthlyTokenCap != null && (
            <Button size="sm" variant="outline" onClick={removeCap} disabled={update.isPending}>
              Quitar tope
            </Button>
          )}
        </div>
        {capError && (
          <p role="alert" className="text-xs font-medium text-destructive">
            {capError}
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          Al llegar al tope, Pau deja de responder y de sugerir hasta el mes siguiente.
        </p>
      </div>
    </section>
  );
}

interface Entry {
  turn: PauSandboxTurn;
  result?: PauSandboxResult;
}

export function SandboxSection() {
  const sandbox = usePauSandbox();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [text, setText] = useState("");
  const [pendingText, setPendingText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const send = () => {
    const body = text.trim();
    if (!body || pendingText !== null) return;
    // Historial completo del ensayo; un turno de Pau sin texto (solo acciones) no se manda.
    const history: PauSandboxTurn[] = [
      ...entries.map((e) => e.turn).filter((t) => t.text.trim() !== ""),
      { role: "user", text: body },
    ];
    setPendingText(body);
    setText("");
    setError(null);
    sandbox.mutate(history, {
      onSuccess: (result) => {
        setEntries((prev) => [
          ...prev,
          { turn: { role: "user", text: body } },
          { turn: { role: "assistant", text: result.text ?? "" }, result },
        ]);
        setPendingText(null);
        requestAnimationFrame(() => endRef.current?.scrollIntoView?.({ block: "end" }));
      },
      onError: (e) => {
        setError(crmError(e).message);
        setText(body);
        setPendingText(null);
      },
    });
  };

  return (
    <section aria-labelledby="pau-probar" className="space-y-3 rounded-md border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 id="pau-probar" className="text-base font-semibold">Probar a Pau</h2>
          <p className="text-sm text-muted-foreground">
            Escribe como si fueras un cliente. Es un ensayo: no se envía nada por WhatsApp ni se cambia ningún dato.
            Cada prueba consume tokens.
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setEntries([]);
            setError(null);
            setText("");
          }}
          disabled={pendingText !== null || (entries.length === 0 && !error)}
        >
          <RotateCcw /> Reiniciar
        </Button>
      </div>

      <div
        className="max-h-80 min-h-24 space-y-2 overflow-y-auto rounded-md border bg-muted/30 p-3"
        data-testid="sandbox-log"
        aria-live="polite"
      >
        {entries.length === 0 && pendingText === null && (
          <p className="text-sm text-muted-foreground">Aún no hay mensajes. Escribe el primero como cliente.</p>
        )}
        {entries.map((e, i) => (
          <div key={i} className={cn("flex", e.turn.role === "user" ? "justify-end" : "justify-start")}>
            <div
              className={cn(
                "max-w-[85%] space-y-1 rounded-lg px-3 py-2 text-sm",
                e.turn.role === "user" ? "bg-primary text-primary-foreground" : "border bg-background",
              )}
            >
              <p className="text-[11px] opacity-80">{e.turn.role === "user" ? "Cliente (tú)" : "Pau"}</p>
              {e.turn.text ? (
                <p className="whitespace-pre-wrap break-words">{e.turn.text}</p>
              ) : (
                <p className="italic text-muted-foreground">Pau no escribió al cliente.</p>
              )}
              {e.result?.refused && (
                <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
                  El modelo se negó a responder este mensaje.
                </p>
              )}
              {e.result && e.result.toolCalls.length > 0 && (
                <ul className="space-y-0.5 border-t pt-1 text-xs" data-testid="sandbox-actions">
                  {e.result.toolCalls.map((c, j) => (
                    <li key={j}>{describeToolCall(c)}</li>
                  ))}
                </ul>
              )}
              {e.result && (
                <p className="text-[11px] text-muted-foreground" data-testid="sandbox-model">
                  Modelo: {e.result.model}
                </p>
              )}
            </div>
          </div>
        ))}
        {pendingText !== null && (
          <>
            <div className="flex justify-end">
              <div className="max-w-[85%] rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground">
                <p className="text-[11px] opacity-80">Cliente (tú)</p>
                <p className="whitespace-pre-wrap break-words">{pendingText}</p>
              </div>
            </div>
            <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Pau está escribiendo…
            </p>
          </>
        )}
        <div ref={endRef} />
      </div>
      {error && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}
      <div className="flex items-end gap-2">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              send();
            }
          }}
          rows={2}
          aria-label="Mensaje de ensayo"
          placeholder="Escribe como cliente (Enter envía)"
          className="min-h-0 resize-none"
        />
        <Button onClick={send} disabled={!text.trim() || pendingText !== null} aria-label="Enviar ensayo">
          <Send />
        </Button>
      </div>
    </section>
  );
}
