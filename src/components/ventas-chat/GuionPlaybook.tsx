"use client";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useSaveScriptPlaybook } from "@/hooks/useCrmContent";
import type { Script, ScriptClosingRules, ScriptTemperature, TemperatureKey } from "@/types/crmContent";
import { useDraft } from "./AjustesCard";
import { TEMPERATURE_BADGE } from "./temperature";

const CUTOFF_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function SaveRow({ canSave, saving, onSave, hint }: { canSave: boolean; saving: boolean; onSave: () => void; hint?: string | null }) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
      {hint && <p className="mr-auto text-xs text-amber-700">{hint}</p>}
      <Button type="button" size="sm" disabled={!canSave || saving} onClick={onSave}>
        {saving && <Loader2 className="animate-spin" />} Guardar
      </Button>
    </div>
  );
}

function TemperatureCard({ items, editable }: { items: ScriptTemperature[]; editable: boolean }) {
  const m = useSaveScriptPlaybook();
  const { draft, setDraft, dirty } = useDraft(items);
  const empty = draft.some((t) => !t.signal.trim() || !t.play.trim());
  const set = (key: TemperatureKey, field: "signal" | "play", value: string) =>
    setDraft((cur) => cur.map((t) => (t.key === key ? { ...t, [field]: value } : t)));
  return (
    <section aria-labelledby="guion-temperatura" className="space-y-3 rounded-md border bg-card p-4">
      <div>
        <h2 id="guion-temperatura" className="text-base font-semibold">
          Temperatura del cliente
        </h2>
        <p className="text-sm text-muted-foreground">La IA clasifica cada chat y sugiere la jugada.</p>
      </div>
      <ul className="space-y-3">
        {draft.map((t) => {
          const badge = TEMPERATURE_BADGE[t.key];
          return (
            <li key={t.key} className="space-y-1.5" data-testid={`temperature-${t.key}`}>
              <Badge variant={badge.variant}>{badge.label}</Badge>
              {editable ? (
                <>
                  <Input
                    aria-label={`Señal: ${badge.label}`}
                    maxLength={120}
                    value={t.signal}
                    onChange={(e) => set(t.key, "signal", e.target.value)}
                  />
                  <Textarea
                    aria-label={`Jugada: ${badge.label}`}
                    rows={2}
                    maxLength={300}
                    value={t.play}
                    onChange={(e) => set(t.key, "play", e.target.value)}
                  />
                </>
              ) : (
                <p className="text-sm">
                  <b>{t.signal}</b> → {t.play}
                </p>
              )}
            </li>
          );
        })}
      </ul>
      {editable && (
        <SaveRow
          canSave={dirty && !empty}
          saving={m.isPending}
          onSave={() => m.mutate({ temperature: draft })}
          hint={empty ? "Completa la señal y la jugada de las tres temperaturas." : null}
        />
      )}
    </section>
  );
}

function RuleRow({ title, help, children }: { title: string; help: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b py-2 last:border-b-0">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{help}</p>
      </div>
      {children}
    </div>
  );
}

function ClosingCard({ rules, editable }: { rules: ScriptClosingRules; editable: boolean }) {
  const m = useSaveScriptPlaybook();
  const { draft, setDraft, dirty } = useDraft(rules);
  const cutoffOk = CUTOFF_RE.test(draft.cutoffTime);
  const unitsOk = Number.isInteger(draft.lastUnits) && draft.lastUnits >= 0 && draft.lastUnits <= 999;
  const valid = cutoffOk && unitsOk;
  return (
    <section aria-labelledby="guion-cierre" className="space-y-3 rounded-md border bg-card p-4">
      <div>
        <h2 id="guion-cierre" className="text-base font-semibold">
          Reglas de cierre
        </h2>
        <p className="text-sm text-muted-foreground">Datos reales que la vendedora y la IA usan para cerrar.</p>
      </div>
      <div>
        <RuleRow
          title="Hora de corte para despachar HOY"
          help="Antes de esta hora se ofrece «despacho hoy»; después, «mañana a primera hora»."
        >
          <Input
            id="closing-cutoff"
            aria-label="Hora de corte"
            type="time"
            className="w-28"
            disabled={!editable}
            value={draft.cutoffTime}
            onChange={(e) => setDraft((c) => ({ ...c, cutoffTime: e.target.value }))}
          />
        </RuleRow>
        <RuleRow
          title={`Mostrar «últimas unidades» cuando quedan ${Number.isFinite(draft.lastUnits) ? draft.lastUnits : "…"} o menos`}
          help="Solo con stock real, para no prometer algo falso."
        >
          <Input
            id="closing-units"
            aria-label="Últimas unidades"
            type="number"
            min={0}
            max={999}
            className="w-20"
            disabled={!editable}
            value={Number.isFinite(draft.lastUnits) ? draft.lastUnits : ""}
            onChange={(e) =>
              setDraft((c) => ({ ...c, lastUnits: e.target.value === "" ? NaN : Number(e.target.value) }))
            }
          />
        </RuleRow>
        <RuleRow
          title="Respuesta inmediata al anuncio"
          help="Foto + precio + «¿Para dónde lo deseas?» en segundos, mientras la vendedora toma el chat."
        >
          <Switch
            aria-label="Respuesta inmediata al anuncio"
            disabled={!editable}
            checked={draft.instantReply}
            onCheckedChange={(v) => setDraft((c) => ({ ...c, instantReply: v }))}
          />
        </RuleRow>
        <div className="space-y-1.5 pt-2">
          <Label htmlFor="closing-promo">Promo del día</Label>
          <Input
            id="closing-promo"
            maxLength={200}
            placeholder="Ej.: envío gratis a Lima por compras desde S/ 120"
            disabled={!editable}
            value={draft.promo}
            onChange={(e) => setDraft((c) => ({ ...c, promo: e.target.value }))}
          />
          <p className="text-xs text-muted-foreground">Visible en todos los chats para que todas ofrezcan lo mismo.</p>
        </div>
      </div>
      {editable && (
        <SaveRow
          canSave={dirty && valid}
          saving={m.isPending}
          onSave={() => m.mutate({ closingRules: { ...draft, promo: draft.promo.trim() } })}
          hint={
            !cutoffOk ? "Elige la hora de corte." : !unitsOk ? "Las unidades deben ser un número entre 0 y 999." : null
          }
        />
      )}
    </section>
  );
}

/** Tarjetas «Temperatura del cliente» y «Reglas de cierre» del guion. */
export default function GuionPlaybook({ script, editable }: { script: Script; editable: boolean }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <TemperatureCard items={script.temperature} editable={editable} />
      <ClosingCard rules={script.closingRules} editable={editable} />
    </div>
  );
}
