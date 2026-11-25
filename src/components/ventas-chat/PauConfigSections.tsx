"use client";
import { useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, Ban, KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { useCrmMe } from "@/hooks/useCrmMe";
import { usePauProviders, usePauSettings, usePauUsage, useUpdatePauSettings } from "@/hooks/useCrmPau";
import type { ConversationChannel, PauCapability, PauChannelKey, PauConfig, PauConfigInput, PauModelTask, PauPhase } from "@/types/crm";
import ChannelBadge from "./ChannelBadge";
import { NATIVE_SELECT_CLASS } from "./format";

/*
 * Configuración ampliada de Pau (mockup 152, filas P4–P9 y P11). Cada bloque guarda solo
 * su parte; el servidor mezcla con lo guardado y valida todo.
 */

export const PAU_PHASES: Array<{ value: PauPhase; title: string; description: string }> = [
  { value: 0, title: "Fase 0 · Copiloto", description: "Solo sugiere y arma el pedido. La vendedora envía." },
  { value: 1, title: "Fase 1 · Fuera de horario", description: "Atiende sola de noche y en feriados. De día, copiloto." },
  {
    value: 2,
    title: "Fase 2 · Ventas simples",
    description: "Cotiza sola consultas simples. Casos especiales pasan a persona.",
  },
  {
    value: 3,
    title: "Fase 3 · Autonomía",
    description: "Cotiza sola todo lo que el negocio permita. El cierre y el cobro los hace una persona.",
  },
];

const CHANNELS: Array<{ key: PauChannelKey; label: string; badge: ConversationChannel; hint?: string }> = [
  { key: "whatsapp", label: "WhatsApp", badge: "whatsapp" },
  { key: "instagram", label: "Instagram", badge: "instagram" },
  { key: "messenger", label: "Messenger", badge: "messenger" },
  { key: "comments", label: "Comentarios", badge: "instagram", hint: "En comentarios públicos solo responde la vendedora" },
];

/** Pau solo cotiza (decisión de Jairo, 25-nov): cerrar y cobrar lo hace siempre una persona. */
const CLOSING: PauCapability[] = ["createOrder", "powipLink", "deposit", "collectBalance"];
const CLOSING_HINT = "Lo hace una persona: Pau solo cotiza y pasa el chat";

const CAPABILITIES: Array<{ key: PauCapability; label: string; hint?: string }> = [
  { key: "createOrder", label: "Crear el pedido en Comercial › Ventas" },
  { key: "powipLink", label: "Enviar el POWIP Link de pago" },
  { key: "deposit", label: "Ofrecer pagar solo el adelanto (según la política de la tienda)" },
  { key: "collectBalance", label: "Cobrar adelantos y saldos pendientes" },
  { key: "documents", label: "Enviar guía Shalom, boleta y constancias" },
  { key: "catalog", label: "Enviar el Catálogo POWIP Link" },
  { key: "material", label: "Enviar fotos y testimonios" },
  { key: "discounts", label: "Dar descuentos", hint: "Apagado: si piden rebaja, pasa la conversación a una persona" },
];

/** Fijo de POWIP para todas las tiendas (mockup 152). */
export const PAU_PRINCIPLES = [
  "Verdad operativa: nunca inventa stock, precio, promoción, fecha de entrega ni cobertura. Si no hay dato: «Lo confirmo con el equipo y te escribo».",
  "Escasez y urgencia reales: «últimas unidades» solo con stock bajo; «despacho HOY» solo antes de la hora de corte.",
  "Transparencia: si preguntan, dice que es Pau, asistente virtual de la tienda, y ofrece pasar con una asesora.",
  "Respeta el no: un intento con la respuesta oficial; si insiste, ofrece seguimiento y no presiona.",
  "Precio: no da descuentos fuera de las promociones y combos configurados.",
  "Datos mínimos: nombre, distrito, dirección o agencia y DNI en provincia. Nunca contraseñas ni datos de tarjeta.",
  "Pagos seguros: solo links de POWIP o cuentas registradas de la tienda.",
  "Pasa a una persona: reclamo, pide hablar con alguien, pedido especial, no sabe, riesgo COD alto, pedido grande o 2 intentos sin avanzar.",
  "Sin temas ajenos: política, religión, salud u otros negocios.",
];

const NEVER_SAYS = [
  "«¡¡Última oportunidad!! Solo quedan 2» (si hay 8 en stock).",
  "«Si no pagas hoy anulamos tu pedido y te reportamos.»",
  "«Te hago 20 % de descuento solo por ser tú.»",
  "«Llega mañana seguro» (sin fecha confirmada del courier).",
  "«Pásame tu número de tarjeta por aquí.»",
];

const MODEL_TASKS: Array<{ key: PauModelTask; label: string }> = [
  { key: "chat", label: "Conversar y vender" },
  { key: "audio", label: "Transcribir notas de voz y llamadas" },
  { key: "summary", label: "Resumir llamadas y aprendizajes" },
];

function useConfig() {
  const settings = usePauSettings();
  const update = useUpdatePauSettings();
  const save = (config: PauConfigInput, message = "Guardado") =>
    update.mutate({ config }, { onSuccess: () => toast.success(message) });
  return { config: settings.data?.config, loading: settings.isLoading, save, saving: update.isPending };
}

function Card({ title, subtitle, children, id }: { title: string; subtitle?: string; children: ReactNode; id: string }) {
  return (
    <section aria-labelledby={id} className="space-y-3 rounded-xl border bg-card p-4">
      <div>
        <h2 id={id} className="text-base font-semibold">
          {title}
        </h2>
        {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

function Row({ label, hint, children }: { label: ReactNode; hint?: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t py-2 first:border-t-0">
      <div className="min-w-[12rem] flex-1">
        <div className="text-sm font-medium">{label}</div>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      <div className="flex max-w-full shrink-0 items-center gap-2 [&>*]:shrink-0">{children}</div>
    </div>
  );
}

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: Array<[T, string]>;
  onChange: (v: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-lg border bg-muted/40 p-0.5">
      {options.map(([v, n]) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={value === v}
          onClick={() => onChange(v)}
          className={cn(
            "rounded-md px-3 py-1 text-xs font-medium transition-colors",
            value === v ? "bg-background text-primary shadow-sm" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {n}
        </button>
      ))}
    </div>
  );
}

function Loading() {
  return (
    <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
    </p>
  );
}

/**
 * P4: fase de Pau en una tienda. Va dentro de la tarjeta de esa tienda en «Quién vende»
 * (mockup 152: «FASE DE PAU EN KUNCA»).
 */
export function StorePhaseSection({ storeId, storeName }: { storeId: string; storeName: string }) {
  const { config, loading, save, saving } = useConfig();
  if (loading) return <Loading />;
  if (!config) return null;
  const current: PauPhase =
    storeId && config.phases[storeId] !== undefined ? config.phases[storeId] : config.phase;
  return (
    <div className="space-y-2" data-testid="pau-store-phase">
      <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        Fase de Pau en {storeName}
      </h4>
      <div role="radiogroup" aria-label={`Fase de Pau en ${storeName}`} className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
        {PAU_PHASES.map((p) => {
          const checked = current === p.value;
          return (
            <button
              key={p.value}
              type="button"
              role="radio"
              aria-checked={checked}
              disabled={saving}
              onClick={() =>
                !checked && save(storeId ? { phases: { [storeId]: p.value } } : { phase: p.value }, "Fase guardada")
              }
              className={cn(
                "flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-colors hover:bg-accent/50",
                checked && "border-teal-600 bg-teal-50 dark:bg-teal-950/40",
              )}
            >
              <span className="text-sm font-semibold">{p.title}</span>
              <span className="text-xs text-muted-foreground">{p.description}</span>
            </button>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">Piloto recomendado: empezar en Fase 0 y subir según resultados.</p>
    </div>
  );
}

/** P5–P6: canales donde responde Pau y qué hace fuera del horario (para todas las tiendas). */
export function PhaseChannelsSection() {
  const { config, loading, save, saving } = useConfig();
  if (loading) return <Loading />;
  if (!config) return null;
  return (
    <>
      <Card id="pau-canales" title="Canales donde responde Pau" subtitle="Para todas las tiendas. El CRM atiende WhatsApp, Instagram y Messenger.">
        <div>
          {CHANNELS.map((c) => (
            <Row
              key={c.key}
              label={
                <span className="flex items-center gap-2">
                  <ChannelBadge channel={c.badge} /> {c.label}
                </span>
              }
              hint={c.hint}
            >
              <Switch
                aria-label={c.label}
                checked={config.channels[c.key]}
                disabled={saving}
                onCheckedChange={(v) => save({ channels: { [c.key]: v } }, "Canales guardados")}
              />
            </Row>
          ))}
          <Row label="Fuera del horario de atención">
            <select
              aria-label="Fuera del horario de atención"
              className={cn(NATIVE_SELECT_CLASS, "h-9 w-72 text-sm")}
              value={config.offHours}
              disabled={saving}
              onChange={(e) => save({ offHours: e.target.value as PauConfig["offHours"] }, "Guardado")}
            >
              <option value="answer">Pau atiende aunque la tienda esté en Copiloto</option>
              <option value="absence">Mensaje de ausencia</option>
            </select>
          </Row>
        </div>
      </Card>
    </>
  );
}

const PERSONALITY_TEXTS: Array<[keyof PauConfig["personality"], string, string]> = [
  ["greeting", "Saludo propio", "¡Hola {nombre}! Soy Pau, asistente virtual de {tienda} 😊"],
  ["farewell", "Despedida propia", "¡Gracias por tu compra!"],
  ["brandWords", "Palabras de la marca", "Ej.: tejido a mano, alpaca peruana"],
  ["avoidWords", "Palabras a evitar", "Ej.: barato, oferta loca"],
  ["forbiddenTopics", "Temas que no toca", "Ej.: política, religión"],
];

/** P7: cómo habla Pau, horario de cobranza y lo que no se puede configurar. */
export function PersonalitySection() {
  const { config, loading, save, saving } = useConfig();
  const [draft, setDraft] = useState<Partial<PauConfig["personality"]>>({});
  if (loading) return <Loading />;
  if (!config) return null;
  const p = { ...config.personality, ...draft };
  const set = <K extends keyof PauConfig["personality"]>(k: K, v: PauConfig["personality"][K]) =>
    setDraft((d) => ({ ...d, [k]: v }));
  const dirty = Object.entries(draft).some(([k, v]) => config.personality[k as keyof PauConfig["personality"]] !== v);
  return (
    <>
      <Card
        id="pau-pers"
        title="Cómo habla Pau"
        subtitle="Lo configura cada negocio. Siempre se presenta como «Pau, asistente virtual de {tienda}»."
      >
        <div>
          <Row label="Tratamiento">
            <Segmented label="Tratamiento" value={p.treatment} options={[["tu", "Tú"], ["usted", "Usted"]]} onChange={(v) => set("treatment", v)} />
          </Row>
          <Row label="Calidez">
            <Segmented
              label="Calidez"
              value={p.warmth}
              options={[["formal", "Profesional"], ["cercano", "Cercano"], ["muy", "Muy cercano"]]}
              onChange={(v) => set("warmth", v)}
            />
          </Row>
          <Row label="Emojis">
            <Segmented
              label="Emojis"
              value={p.emojis}
              options={[["no", "Ninguno"], ["pocos", "Pocos"], ["varios", "Más"]]}
              onChange={(v) => set("emojis", v)}
            />
          </Row>
          <Row label="Firmeza en cobranza">
            <Segmented
              label="Firmeza en cobranza"
              value={p.firmness}
              options={[["suave", "Suave"], ["estandar", "Estándar"], ["firme", "Firme"]]}
              onChange={(v) => set("firmness", v)}
            />
          </Row>
          {PERSONALITY_TEXTS.map(([k, label, placeholder]) => (
            <Row key={k} label={<Label htmlFor={`pau-p-${k}`}>{label}</Label>}>
              <Input
                id={`pau-p-${k}`}
                className="h-9 w-80 max-w-full"
                maxLength={500}
                placeholder={placeholder}
                value={String(p[k] ?? "")}
                onChange={(e) => set(k, e.target.value as never)}
              />
            </Row>
          ))}
          <Row label="Horario de cobranza" hint="[VERIFICAR] con asesoría legal si el límite del Código del Consumidor aplica a WhatsApp">
            <Segmented label="Días de cobranza" value={p.collectionDays} options={[["LV", "L–V"], ["LS", "L–S"]]} onChange={(v) => set("collectionDays", v)} />
            <Input type="time" aria-label="Cobrar desde" className="h-9 w-28" value={p.collectionFrom} onChange={(e) => set("collectionFrom", e.target.value)} />
            <span className="text-xs text-muted-foreground">a</span>
            <Input type="time" aria-label="Cobrar hasta" className="h-9 w-28" value={p.collectionTo} onChange={(e) => set("collectionTo", e.target.value)} />
          </Row>
        </div>
        <div className="flex justify-end gap-2">
          {dirty && (
            <Button variant="outline" onClick={() => setDraft({})} disabled={saving}>
              Descartar
            </Button>
          )}
          <Button
            disabled={!dirty || saving}
            onClick={() => save({ personality: draft }, "Personalidad guardada")}
          >
            {saving && <Loader2 className="animate-spin" />} Guardar personalidad
          </Button>
        </div>
      </Card>
      <Card id="pau-fijo" title="No configurable" subtitle="Fijo de POWIP para todas las tiendas">
        <ul className="space-y-1.5 text-sm">
          {PAU_PRINCIPLES.map((x) => (
            <li key={x} className="flex gap-2">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden /> {x}
            </li>
          ))}
        </ul>
        <h3 className="pt-1 text-sm font-semibold">Lo que Pau no diría</h3>
        <ul className="space-y-1.5 text-sm text-muted-foreground">
          {NEVER_SAYS.map((x) => (
            <li key={x} className="flex gap-2">
              <Ban className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden /> {x}
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}

/** P8: qué puede hacer sola, escalera de cobranza y cuándo pasa a una persona. */
export function CapabilitiesSection() {
  const { config, loading, save, saving } = useConfig();
  const [steps, setSteps] = useState<PauConfig["reminders"] | null>(null);
  if (loading) return <Loading />;
  if (!config) return null;
  const h = config.handoff;
  const reminders = steps ?? config.reminders;
  const numberInput = (key: "afterFailedAttempts" | "amountOver", label: string, width: string) => (
    <Input
      type="number"
      aria-label={label}
      className={cn("h-9", width)}
      defaultValue={h[key]}
      key={`${key}-${h[key]}`}
      min={key === "amountOver" ? 0 : 1}
      onBlur={(e) => {
        const n = Number(e.target.value);
        if (Number.isFinite(n) && n !== h[key]) save({ handoff: { [key]: n } }, "Guardado");
      }}
    />
  );
  return (
    <div className="grid items-start gap-4 lg:grid-cols-2">
      <Card id="pau-perm-h" title="Lo que Pau puede hacer sola">
        <div>
          {CAPABILITIES.map((c) => (
            <Row key={c.key} label={c.label} hint={CLOSING.includes(c.key) ? CLOSING_HINT : c.hint}>
              <Switch
                aria-label={c.label}
                checked={CLOSING.includes(c.key) ? false : config.capabilities[c.key]}
                disabled={saving || CLOSING.includes(c.key)}
                onCheckedChange={(v) => save({ capabilities: { [c.key]: v } }, "Permisos guardados")}
              />
            </Row>
          ))}
        </div>
      </Card>
      <div className="space-y-4">
        <Card id="pau-escalera" title="Cobranza · escalera de recordatorios" subtitle="Lo que Pau envía si el cliente no paga.">
          <ol className="space-y-2">
            {reminders.map((r, i) => (
              <li key={i} className="grid grid-cols-[5.5rem_minmax(0,1fr)] items-center gap-2">
                <Input
                  aria-label={`Cuándo, paso ${i + 1}`}
                  className="h-9 w-full"
                  maxLength={20}
                  value={r.after}
                  onChange={(e) => setSteps(reminders.map((x, j) => (j === i ? { ...x, after: e.target.value } : x)))}
                />
                <Input
                  aria-label={`Qué envía, paso ${i + 1}`}
                  className="h-9"
                  maxLength={500}
                  value={r.text}
                  onChange={(e) => setSteps(reminders.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))}
                />
              </li>
            ))}
          </ol>
          {steps && (
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setSteps(null)}>
                Descartar
              </Button>
              <Button
                size="sm"
                disabled={saving}
                onClick={() =>
                  save({ reminders: steps }, "Escalera de cobranza guardada")
                }
              >
                Guardar escalera
              </Button>
            </div>
          )}
        </Card>
        <Card id="pau-handoff-h" title="Cuándo pasa a una persona" subtitle="La conversación pasa según el reparto de chats">
          <div>
            <Row label="El cliente pide hablar con alguien">
              <Switch aria-label="Pide persona" checked={h.asksPerson} disabled={saving} onCheckedChange={(v) => save({ handoff: { asksPerson: v } })} />
            </Row>
            <Row label="Hay un reclamo">
              <Switch aria-label="Reclamo" checked={h.complaint} disabled={saving} onCheckedChange={(v) => save({ handoff: { complaint: v } })} />
            </Row>
            <Row label="No resuelve después de">
              {numberInput("afterFailedAttempts", "Intentos", "w-20")}
              <span className="text-xs text-muted-foreground">intentos</span>
            </Row>
            <Row label="El pedido pasa de" hint="Las ventas grandes las cierra una persona">
              <span className="text-xs text-muted-foreground">S/</span>
              {numberInput("amountOver", "Monto", "w-28")}
            </Row>
            <Row label="Cliente con historial de rechazo">
              <Switch aria-label="Riesgo" checked={h.codRisk} disabled={saving} onCheckedChange={(v) => save({ handoff: { codRisk: v } })} />
            </Row>
            <Row label="Compras por mayor" hint="Pasa al embudo Mayorista">
              <Switch aria-label="Mayorista" checked={h.wholesale} disabled={saving} onCheckedChange={(v) => save({ handoff: { wholesale: v } })} />
            </Row>
          </div>
          <p className="text-xs text-muted-foreground">En la bandeja verás «Pau pidió ayuda».</p>
        </Card>
      </div>
    </div>
  );
}

const soles = (n: number) => `S/ ${n.toFixed(2)}`;

/** Gasto estimado del mes contra el tope (mockup 152): barra, % y aviso al 80 %. */
export function SpendMeter({ spent, cap }: { spent: number | null; cap: number | null }) {
  const month = new Date().toLocaleDateString("es-PE", { month: "long" }).toLowerCase();
  if (spent === null) {
    return (
      <p className="text-sm text-muted-foreground" data-testid="pau-spend-meter">
        Pon el precio de tus proveedores para ver el gasto estimado de {month}.
      </p>
    );
  }
  const pct = cap ? Math.min(100, Math.round((spent / cap) * 100)) : 0;
  return (
    <div className="space-y-1.5" data-testid="pau-spend-meter">
      <p className="flex items-center justify-between gap-2 text-sm">
        <span>Gasto estimado de {month}</span>
        <b className="tabular-nums">{cap ? `${soles(spent)} de ${soles(cap)}` : soles(spent)}</b>
      </p>
      {cap ? (
        <>
          <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Gasto del tope">
            <div className={cn("h-full rounded-full", pct >= 80 ? "bg-destructive" : "bg-primary")} style={{ width: `${pct}%` }} />
          </div>
          <p className={cn("text-xs", pct >= 80 ? "text-destructive" : "text-muted-foreground")}>
            {pct >= 100 ? "Tope alcanzado" : `${pct} % del tope`} · aviso al 80 %
          </p>
        </>
      ) : null}
    </div>
  );
}

/** P9: orden de uso, tiempo de espera, respaldo, tope de gasto y modelo por tarea. */
export function ProviderRulesSection() {
  const { config, loading, save, saving } = useConfig();
  const providers = usePauProviders().data ?? [];
  const usage = usePauUsage();
  if (loading) return <Loading />;
  if (!config || providers.length === 0) return null;
  const rules = config.providers;
  const rank = (id: string) => {
    const i = rules.order.indexOf(id);
    return i === -1 ? rules.order.length + providers.findIndex((p) => p.id === id) : i;
  };
  const ordered = [...providers].sort((a, b) => rank(a.id) - rank(b.id));
  const move = (index: number, delta: number) => {
    const ids = ordered.map((p) => p.id);
    const [id] = ids.splice(index, 1);
    ids.splice(index + delta, 0, id);
    save({ providers: { order: ids } }, "Orden guardado");
  };
  return (
    <>
      <p className="flex items-start gap-2 rounded-md border bg-muted p-3 text-sm text-muted-foreground">
        <KeyRound className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        Cada negocio usa sus propias llaves. El proveedor cobra el uso directo al negocio. POWIP no cobra por mensaje ni por
        token.
      </p>
      <Card id="pau-orden" title="Orden de uso" subtitle="Arriba = principal. Si falla o tarda, Pau usa el siguiente.">
        <ol className="space-y-2" data-testid="pau-provider-order">
          {ordered.map((p, i) => (
            <li key={p.id} className="flex flex-wrap items-center gap-2 rounded-lg border p-2">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                {i + 1}
              </span>
              <span className="min-w-0 flex-1 text-sm">
                <b>{p.label}</b> <span className="text-muted-foreground">· {p.model}</span>
              </span>
              <Button size="icon-sm" variant="outline" aria-label={`Subir ${p.label}`} disabled={i === 0 || saving} onClick={() => move(i, -1)}>
                <ArrowUp />
              </Button>
              <Button
                size="icon-sm"
                variant="outline"
                aria-label={`Bajar ${p.label}`}
                disabled={i === ordered.length - 1 || saving}
                onClick={() => move(i, 1)}
              >
                <ArrowDown />
              </Button>
            </li>
          ))}
        </ol>
        <div>
          <Row label="Pasar al siguiente si no responde en">
            <Input
              type="number"
              aria-label="Segundos de espera"
              className="h-9 w-20"
              min={3}
              max={60}
              defaultValue={rules.timeoutSeconds}
              key={`t-${rules.timeoutSeconds}`}
              onBlur={(e) => {
                const n = Number(e.target.value);
                if (Number.isFinite(n) && n !== rules.timeoutSeconds) save({ providers: { timeoutSeconds: n } });
              }}
            />
            <span className="text-xs text-muted-foreground">s</span>
          </Row>
          <Row label="Si todos fallan">
            <select
              aria-label="Si todos fallan"
              className={cn(NATIVE_SELECT_CLASS, "h-9 w-80 text-sm")}
              value={rules.allFail}
              disabled={saving}
              onChange={(e) => save({ providers: { allFail: e.target.value as PauConfig["providers"]["allFail"] } })}
            >
              <option value="handoff">Pasa el chat a una vendedora y avisa</option>
              <option value="holding">Responde «te escribimos en unos minutos» y avisa</option>
            </select>
          </Row>
        </div>
      </Card>
      <Card id="pau-tope" title="Tope de gasto mensual" subtitle="Para que el consumo de IA nunca te sorprenda">
        <SpendMeter spent={usage.data?.spentSoles ?? null} cap={rules.monthlyCapSoles} />
        <div>
          <Row label="Tope por mes">
            <span className="text-xs text-muted-foreground">S/</span>
            <Input
              type="number"
              aria-label="Tope por mes en soles"
              className="h-9 w-28"
              min={10}
              placeholder="Sin tope"
              defaultValue={rules.monthlyCapSoles ?? ""}
              key={`c-${rules.monthlyCapSoles}`}
              onBlur={(e) => {
                const raw = e.target.value.trim();
                const next = raw === "" ? null : Number(raw);
                if (next !== rules.monthlyCapSoles && (next === null || Number.isFinite(next))) {
                  save({ providers: { monthlyCapSoles: next } }, "Tope guardado");
                }
              }}
            />
          </Row>
          <Row label="Al llegar al tope">
            <select
              aria-label="Al llegar al tope"
              className={cn(NATIVE_SELECT_CLASS, "h-9 w-72 text-sm")}
              value={rules.capAction}
              disabled={saving}
              onChange={(e) => save({ providers: { capAction: e.target.value as PauConfig["providers"]["capAction"] } }, "Tope guardado")}
            >
              <option value="copilot">Pau pasa a Copiloto</option>
              <option value="pause">Pau se apaga hasta el próximo mes</option>
              <option value="notify">Solo avisar</option>
            </select>
          </Row>
          {ordered.map((p) => {
            const price = rules.pricePerMTokens?.[p.id];
            return (
              <Row key={p.id} label={`Precio de ${p.label} (S/ por millón de tokens)`}>
                <span className="text-xs text-muted-foreground">S/</span>
                <Input
                  type="number"
                  aria-label={`Precio por millón de tokens de ${p.label}`}
                  className="h-9 w-28"
                  min={0}
                  step="0.01"
                  placeholder="Sin precio"
                  defaultValue={price ?? ""}
                  key={`p-${p.id}-${price}`}
                  onBlur={(e) => {
                    const raw = e.target.value.trim();
                    const next = { ...(rules.pricePerMTokens ?? {}) };
                    if (raw === "") delete next[p.id];
                    else if (Number.isFinite(Number(raw)) && Number(raw) >= 0) next[p.id] = Number(raw);
                    else return;
                    if (next[p.id] !== price) save({ providers: { pricePerMTokens: next } }, "Precio guardado");
                  }}
                />
              </Row>
            );
          })}
          <p className="pt-2 text-xs text-muted-foreground">
            El precio lo ves en la página de tu proveedor. Sin precio, ese proveedor no suma al gasto estimado.
          </p>
        </div>
      </Card>
      <Card id="pau-tareas" title="Modelo por tarea" subtitle="Usa el modelo más barato donde alcanza">
        <div>
          {MODEL_TASKS.map((t) => (
            <Row key={t.key} label={t.label}>
              <select
                aria-label={t.label}
                className={cn(NATIVE_SELECT_CLASS, "h-9 w-72 text-sm")}
                value={rules.modelByTask[t.key] ?? ordered[0]?.id ?? ""}
                disabled={saving}
                onChange={(e) =>
                  save({ providers: { modelByTask: { ...rules.modelByTask, [t.key]: e.target.value } } }, "Modelo por tarea guardado")
                }
              >
                {ordered.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label} · {p.model}
                  </option>
                ))}
              </select>
            </Row>
          ))}
        </div>
      </Card>
    </>
  );
}

/** P11: uso del mes por proveedor. El costo exacto lo cobra cada proveedor. */
export function UsageByProviderSection() {
  const usage = usePauUsage();
  const rows = usage.data?.byProvider;
  if (!rows) return null;
  const fmt = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(2)} M` : n.toLocaleString("es-PE"));
  return (
    <Card id="pau-uso-prov" title="Uso por proveedor" subtitle="Estimado con el precio que pusiste. El costo exacto lo ves en tu cuenta de cada proveedor">
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aún no hay uso este mes.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="pau-usage-by-provider">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="py-2 font-medium">Proveedor</th>
                <th className="py-2 text-right font-medium">Tareas</th>
                <th className="py-2 text-right font-medium">Mensajes</th>
                <th className="py-2 text-right font-medium">Tokens</th>
                <th className="py-2 text-right font-medium">Gasto estimado</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={`${r.providerId}-${r.model}`} className="border-b last:border-0">
                  <td className="py-2">
                    <b>{r.label}</b> <span className="text-xs text-muted-foreground">· {r.model}</span>
                  </td>
                  <td className="py-2 text-right tabular-nums">{fmt(r.tasks)}</td>
                  <td className="py-2 text-right tabular-nums">{fmt(r.messages)}</td>
                  <td className="py-2 text-right tabular-nums">{fmt(r.tokens)}</td>
                  <td className="py-2 text-right tabular-nums">
                    {r.estimatedSoles == null ? (
                      <span className="text-xs text-muted-foreground" title="Pon su precio en «Tope de gasto mensual»">Sin precio</span>
                    ) : (
                      soles(r.estimatedSoles)
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
