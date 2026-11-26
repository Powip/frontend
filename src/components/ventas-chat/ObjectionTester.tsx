"use client";
import { useState } from "react";
import { Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useTestObjection } from "@/hooks/useCrmSalesTools";
import SuggestionSourceBadge from "./SuggestionSourceBadge";

/**
 * Prueba la detección automática con un mensaje de ejemplo. En el chat la
 * detección corre sola con cada mensaje del cliente y sugiere la respuesta.
 */
export default function ObjectionTester() {
  const [text, setText] = useState("");
  const test = useTestObjection();
  const r = test.data;
  return (
    <section aria-labelledby="obj-probar" className="space-y-3 rounded-md border bg-card p-4">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" aria-hidden />
        <h2 id="obj-probar" className="text-sm font-semibold">
          Detección automática
        </h2>
      </div>
      <p className="text-xs text-muted-foreground">
        En cada mensaje del cliente el CRM busca la objeción y sugiere su respuesta en la barra del chat. Usa la IA de
        Pau si está configurada; si no, reglas por palabras clave. Prueba aquí con un mensaje de ejemplo.
      </p>
      <form
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (text.trim()) test.mutate(text.trim());
        }}
      >
        <Label htmlFor="obj-test-text">Mensaje del cliente</Label>
        <Textarea
          id="obj-test-text"
          rows={2}
          maxLength={1000}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Ej.: Está muy caro, en otra tienda lo vi más barato"
        />
        <Button type="submit" size="sm" disabled={!text.trim() || test.isPending}>
          {test.isPending ? "Analizando…" : "Probar"}
        </Button>
      </form>
      {r && (
        <div data-testid="objection-test-result" className="space-y-1 rounded-md border bg-muted/40 p-3 text-xs">
          {r.label ? (
            <>
              <p className="flex flex-wrap items-center gap-2 font-medium">
                Objeción: {r.label}
                <Badge variant="secondary">{Math.round(r.confidence * 100)} %</Badge>
                <SuggestionSourceBadge source={r.source} />
              </p>
              {r.suggestedResponse ? (
                <p className="text-muted-foreground">Respuesta sugerida: {r.suggestedResponse}</p>
              ) : (
                <p className="text-muted-foreground">No hay una respuesta activa para esta objeción.</p>
              )}
            </>
          ) : (
            <p className="text-muted-foreground">No se detectó ninguna objeción.</p>
          )}
        </div>
      )}
    </section>
  );
}
