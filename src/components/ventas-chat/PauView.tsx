"use client";
import { useState } from "react";
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Info,
  Loader2,
  Lock,
  MessageSquare,
  Pencil,
  Plus,
  Sparkles,
  Store,
  Trash2,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useCrmMe } from "@/hooks/useCrmMe";
import { usePauLearning } from "@/hooks/useCrmPauLearning";
import { crmError } from "@/services/crmService";
import {
  usePauProviderActions,
  usePauProviders,
  usePauSettings,
  useUpdatePauSettings,
} from "@/hooks/useCrmPau";
import { toast } from "sonner";
import type { PauMode, PauProvider } from "@/types/crm";
import { CRM_UNREACHABLE } from "./ConversationList";
import ConfirmDialog from "./ConfirmDialog";
import PauProviderDialog from "./PauProviderDialog";
import { PauAprende } from "./PauAprende";
import { PauTrainingSection } from "./PauTrainingSection";
import { SandboxSection, UsageSection } from "./PauUsageSandbox";
import {
  CapabilitiesSection,
  PersonalitySection,
  PhaseChannelsSection,
  StorePhaseSection,
  ProviderRulesSection,
  UsageByProviderSection,
} from "./PauConfigSections";
import {
  PAU_INSTRUCTIONS_MAX,
  PAU_KNOWLEDGE_MAX,
  PAU_MODE_LABEL,
  PAU_MODE_OPTIONS,
  PROVIDER_LABEL,
  storeMode,
} from "./pau";
import { relativeTime } from "./format";

const MODE_ICON: Record<PauMode, LucideIcon> = { off: MessageSquare, copilot: Sparkles, auto: Bot };

type StoreTarget = { id: string; name: string };

/** Tiendas que se configuran; sin tiendas conocidas, el modo general como una sola tienda. */
function useStoreTargets(): StoreTarget[] {
  const { stores } = useCrmMe();
  return stores.length ? stores : [{ id: "", name: "Todas las tiendas" }];
}

/**
 * Selector de tienda (KUNCA, LIVII…): Pau se configura por tienda, una a la vez,
 * en lugar de apilar todas las tiendas en una sola página.
 */
function StorePicker({
  targets,
  value,
  onChange,
}: {
  targets: StoreTarget[];
  value: string;
  onChange: (id: string) => void;
}) {
  if (targets.length < 2) return null;
  return (
    <div role="tablist" aria-label="Tienda a configurar" className="flex flex-wrap items-center gap-2">
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <Store className="h-3.5 w-3.5" aria-hidden /> Tienda
      </span>
      {targets.map((t) => (
        <button
          key={t.id || "all"}
          type="button"
          role="tab"
          aria-selected={value === t.id}
          onClick={() => onChange(t.id)}
          className={cn(
            "rounded-full border px-3 py-1 text-sm font-medium transition-colors",
            value === t.id
              ? "border-primary bg-primary/10 text-primary"
              : "bg-card text-muted-foreground hover:text-foreground",
          )}
        >
          {t.name}
        </button>
      ))}
    </div>
  );
}

function ModeSection({ isAdmin, storeId }: { isAdmin: boolean; storeId: string }) {
  const settings = usePauSettings();
  const update = useUpdatePauSettings();
  const { stores } = useCrmMe();
  const allTargets = useStoreTargets();
  // Tienda a la que se le pide confirmar «Pau vende y cobra» ("" = todas las tiendas).
  const [confirmAuto, setConfirmAuto] = useState<string | null>(null);
  const s = settings.data;
  const err = settings.isError ? crmError(settings.error) : null;
  // El administrador configura la tienda elegida; la vendedora ve el modo de todas.
  const selected = allTargets.filter((t) => t.id === storeId);
  const targets = isAdmin && selected.length ? selected : allTargets;

  const save = (storeId: string, mode: PauMode) =>
    update.mutate(storeId ? { storeModes: { [storeId]: mode } } : { mode });

  const choose = (storeId: string, mode: PauMode) => {
    if (!s || update.isPending) return;
    const current = storeId ? storeMode(s, storeId) : s.mode;
    if (mode === current) return;
    if (mode === "auto") {
      setConfirmAuto(storeId);
      return;
    }
    save(storeId, mode);
  };

  return (
    <section aria-labelledby="pau-quien" className="space-y-3">
      <div>
        <h2 id="pau-quien" className="sr-only">Quién vende</h2>
      </div>
      {settings.isLoading && (
        <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
        </p>
      )}
      {err && (
        <div role="alert" className="space-y-2 text-sm">
          <p className="font-medium text-destructive">{err.unreachable ? CRM_UNREACHABLE : err.message}</p>
          <Button size="sm" variant="outline" onClick={() => settings.refetch()}>
            Reintentar
          </Button>
        </div>
      )}
      {s && !isAdmin && (
        <div className="space-y-2">
          <p className="text-sm" data-testid="pau-current-mode">
            Modo actual:{" "}
            {targets.map((t, i) => (
              <span key={t.id || "all"}>
                {i > 0 && " · "}
                {stores.length > 1 && `${t.name}: `}
                <strong>{PAU_MODE_LABEL[t.id ? storeMode(s, t.id) : s.mode]}</strong>
              </span>
            ))}
          </p>
          <p role="status" className="flex items-center gap-2 rounded-md border bg-muted p-3 text-sm text-muted-foreground">
            <Lock className="h-4 w-4 shrink-0" /> Solo un administrador puede configurar a Pau.
          </p>
        </div>
      )}
      {s && isAdmin && (
        <>
          {!s.hasProvider && (
            <p
              role="alert"
              className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Para encender a Pau primero conecta un proveedor de IA en la pestaña{" "}
                <strong>Proveedores de IA</strong>.
              </span>
            </p>
          )}
          {targets.map((t) => {
            const current = t.id ? storeMode(s, t.id) : s.mode;
            return (
              <div key={t.id || "all"} className="space-y-4 rounded-2xl border bg-card p-5 shadow-sm" data-testid="pau-store-card">
                <div>
                  <h3 className="text-base font-semibold uppercase tracking-wide">{t.name}</h3>
                  <p className="text-xs text-muted-foreground">El negocio decide quién vende en cada tienda</p>
                </div>
                <div
                  role="radiogroup"
                  aria-label={`Quién vende en ${t.name}`}
                  className="grid gap-3 md:grid-cols-3"
                >
                  {PAU_MODE_OPTIONS.map((o) => {
                    const checked = current === o.value;
                    const Icon = MODE_ICON[o.value];
                    const blocked = o.value !== "off" && !s.hasProvider;
                    return (
                      <button
                        key={o.value}
                        type="button"
                        role="radio"
                        aria-checked={checked}
                        disabled={blocked || update.isPending}
                        onClick={() => choose(t.id, o.value)}
                        className={cn(
                          "flex flex-col items-start gap-1.5 rounded-xl border p-4 text-left transition-colors",
                          "hover:bg-accent/50 disabled:cursor-not-allowed disabled:opacity-50",
                          checked && "border-primary bg-accent",
                        )}
                      >
                        <span
                          aria-hidden
                          className={cn(
                            "mb-1 grid h-8 w-8 place-items-center rounded-lg",
                            checked ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                          )}
                        >
                          <Icon className="h-4 w-4" />
                        </span>
                        <span className="flex items-center gap-2 text-sm font-semibold">
                          {o.title}
                          {checked && <CheckCircle2 className="h-4 w-4 text-primary" aria-hidden />}
                        </span>
                        <span className="text-xs text-muted-foreground">{o.description}</span>
                      </button>
                    );
                  })}
                </div>
                <StorePhaseSection storeId={t.id} storeName={t.name} />
              </div>
            );
          })}
        </>
      )}
      <ConfirmDialog
        open={confirmAuto !== null}
        title="¿Dejar que Pau venda y cobre sola?"
        description="Pau escribirá a clientes reales sin que nadie apruebe cada mensaje. Cierra la venta, pide los datos de envío y el comprobante, y lo revisa; Finanzas da el visto final. Nunca inventa precios ni stock, y solo da descuentos dentro de tu permiso. Pasa el chat a una persona en reclamos, salud, pedidos por mayor, cuando le falta un dato, cuando pide ayuda o cuando alguien del equipo envía un mensaje en ese chat; en la bandeja verás «Pau pidió ayuda». Puedes tomar cualquier chat o apagar a Pau cuando quieras."
        confirmLabel="Sí, que venda sola"
        onCancel={() => setConfirmAuto(null)}
        onConfirm={() => {
          const id = confirmAuto ?? "";
          setConfirmAuto(null);
          save(id, "auto");
        }}
      />
    </section>
  );
}

function ProviderRow({
  p,
  onEdit,
  onDelete,
}: {
  p: PauProvider;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const actions = usePauProviderActions();
  const [busy, setBusy] = useState<"test" | "default" | null>(null);

  const test = async () => {
    setBusy("test");
    try {
      const r = await actions.test(p.id);
      if (r.ok) toast.success("La llave funciona");
      else toast.error(r.error ?? "La prueba falló");
    } catch (e) {
      toast.error(crmError(e).message);
    } finally {
      setBusy(null);
    }
  };
  const makeDefault = async () => {
    setBusy("default");
    try {
      await actions.update(p.id, { isDefault: true });
    } catch (e) {
      toast.error(crmError(e).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <li className="space-y-2 rounded-md border p-3" data-testid="provider-row">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold">{p.label}</span>
        <Badge variant="secondary">{PROVIDER_LABEL[p.provider]}</Badge>
        {p.isDefault && <Badge>Predeterminado</Badge>}
      </div>
      <p className="text-xs text-muted-foreground">
        Llave {p.keyHint} · Modelo {p.model}
      </p>
      <p className="flex items-center gap-1.5 text-xs" data-testid="provider-test">
        {p.lastTestOk === true && (
          <>
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
            <span>Última prueba correcta{p.lastTestAt ? ` · ${relativeTime(p.lastTestAt)}` : ""}</span>
          </>
        )}
        {p.lastTestOk === false && (
          <>
            <XCircle className="h-3.5 w-3.5 text-destructive" />
            <span className="text-destructive">
              Última prueba falló{p.lastTestError ? `: ${p.lastTestError}` : ""}
            </span>
          </>
        )}
        {p.lastTestOk === null && <span className="text-muted-foreground">Sin probar todavía</span>}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={test} disabled={busy !== null} aria-label={`Probar ${p.label}`}>
          {busy === "test" && <Loader2 className="animate-spin" />} Probar
        </Button>
        {!p.isDefault && (
          <Button
            size="sm"
            variant="outline"
            onClick={makeDefault}
            disabled={busy !== null}
            aria-label={`Hacer predeterminado ${p.label}`}
          >
            Predeterminado
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={onEdit} aria-label={`Editar ${p.label}`}>
          <Pencil /> Editar
        </Button>
        <Button size="sm" variant="outline" onClick={onDelete} aria-label={`Eliminar ${p.label}`}>
          <Trash2 /> Eliminar
        </Button>
      </div>
    </li>
  );
}

function ProvidersSection() {
  const providers = usePauProviders();
  const actions = usePauProviderActions();
  const [dialog, setDialog] = useState<{ provider?: PauProvider; key: number } | null>(null);
  const [toDelete, setToDelete] = useState<PauProvider | null>(null);
  const items = providers.data ?? [];
  const err = providers.isError ? crmError(providers.error) : null;

  return (
    <section id="pau-proveedores" aria-labelledby="pau-prov-h" className="space-y-3 rounded-md border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 id="pau-prov-h" className="text-base font-semibold">Proveedores de IA</h2>
          <p className="text-sm text-muted-foreground">
            Pau usa la llave de tu cuenta de Anthropic (Claude) u OpenAI. La llave se guarda cifrada y nunca se vuelve a
            mostrar. El consumo lo cobra el proveedor directamente a tu negocio.
          </p>
        </div>
        <Button size="sm" onClick={() => setDialog({ key: Date.now() })}>
          <Plus /> Conectar proveedor
        </Button>
      </div>
      {providers.isLoading && (
        <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando proveedores…
        </p>
      )}
      {err && (
        <div role="alert" className="space-y-2 text-sm">
          <p className="font-medium text-destructive">{err.unreachable ? CRM_UNREACHABLE : err.message}</p>
          <Button size="sm" variant="outline" onClick={() => providers.refetch()}>
            Reintentar
          </Button>
        </div>
      )}
      {!providers.isLoading && !err && items.length === 0 && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Info className="h-4 w-4" /> Aún no conectaste ningún proveedor.
        </p>
      )}
      <ul className="space-y-2">
        {items.map((p) => (
          <ProviderRow
            key={p.id}
            p={p}
            onEdit={() => setDialog({ provider: p, key: Date.now() })}
            onDelete={() => setToDelete(p)}
          />
        ))}
      </ul>
      {dialog && (
        <PauProviderDialog
          key={dialog.key}
          open
          provider={dialog.provider}
          onOpenChange={(o) => !o && setDialog(null)}
        />
      )}
      <ConfirmDialog
        open={!!toDelete}
        title={`¿Eliminar «${toDelete?.label ?? ""}»?`}
        description={
          items.length <= 1
            ? "Es el último proveedor: al eliminarlo Pau se apagará y dejará de responder y sugerir."
            : "Se borra la llave guardada. Si era el predeterminado, Pau usará otro proveedor conectado."
        }
        onCancel={() => setToDelete(null)}
        onConfirm={() => {
          if (toDelete) actions.remove.mutate(toDelete.id);
          setToDelete(null);
        }}
      />
    </section>
  );
}

function KnowledgeSection() {
  const settings = usePauSettings();
  const update = useUpdatePauSettings();
  const [instr, setInstr] = useState<string | null>(null);
  const [know, setKnow] = useState<string | null>(null);
  const s = settings.data;
  const instrValue = instr ?? s?.instructions ?? "";
  const knowValue = know ?? s?.knowledge ?? "";
  const dirty =
    !!s && ((instr !== null && instr !== s.instructions) || (know !== null && know !== s.knowledge));

  const save = () => {
    if (!s || !dirty) return;
    const input: { instructions?: string; knowledge?: string } = {};
    if (instr !== null && instr !== s.instructions) input.instructions = instr;
    if (know !== null && know !== s.knowledge) input.knowledge = know;
    update.mutate(input, {
      onSuccess: () => {
        setInstr(null);
        setKnow(null);
        toast.success("Guardado");
      },
    });
  };

  return (
    <section aria-labelledby="pau-conocimiento" className="space-y-3 rounded-md border bg-card p-4">
      <div>
        <h2 id="pau-conocimiento" className="text-base font-semibold">Instrucciones y conocimiento</h2>
        <p
          role="note"
          className="mt-1 flex items-start gap-2 rounded-md border bg-muted p-2 text-sm text-muted-foreground"
        >
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          Pau solo sabe lo que esté escrito aquí. Si falta un dato, no lo inventa: pasa el chat a una persona.
        </p>
      </div>
      {!s ? (
        <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
        </p>
      ) : (
        <>
          <div className="space-y-1.5">
            <Label htmlFor="pau-instructions">Instrucciones</Label>
            <Textarea
              id="pau-instructions"
              rows={5}
              maxLength={PAU_INSTRUCTIONS_MAX}
              value={instrValue}
              onChange={(e) => setInstr(e.target.value)}
              placeholder="Tono y reglas. Ej.: Habla de tú, cálida y breve. Nunca prometas descuentos. Si piden hablar con una persona, pasa el chat."
            />
            <p className="text-right text-xs text-muted-foreground" data-testid="instructions-count">
              {instrValue.length} / {PAU_INSTRUCTIONS_MAX} caracteres
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pau-knowledge">Conocimiento del negocio</Label>
            <Textarea
              id="pau-knowledge"
              rows={10}
              maxLength={PAU_KNOWLEDGE_MAX}
              value={knowValue}
              onChange={(e) => setKnow(e.target.value)}
              placeholder="Productos, precios, envíos, medios de pago y horarios de atención."
            />
            <p className="text-right text-xs text-muted-foreground" data-testid="knowledge-count">
              {knowValue.length} / {PAU_KNOWLEDGE_MAX} caracteres
            </p>
          </div>
          <div className="flex justify-end">
            <Button onClick={save} disabled={!dirty || update.isPending}>
              {update.isPending && <Loader2 className="animate-spin" />} Guardar
            </Button>
          </div>
        </>
      )}
    </section>
  );
}

export type PauTab = "modo" | "pers" | "perm" | "prov" | "apr" | "cons";

const PAU_TABS: Array<{ key: PauTab; label: string; admin: boolean }> = [
  { key: "modo", label: "Quién vende", admin: false },
  { key: "pers", label: "Personalidad", admin: true },
  { key: "perm", label: "Qué puede hacer", admin: true },
  { key: "prov", label: "Proveedores de IA", admin: true },
  { key: "apr", label: "Aprende", admin: true },
  { key: "cons", label: "Consumo", admin: true },
];

/** Encabezado del mockup 152: modo de cada tienda y proveedores conectados. */
function PauSummary({ isAdmin }: { isAdmin: boolean }) {
  const s = usePauSettings().data;
  // Solo administrador lee los proveedores; la vendedora no ve el conteo.
  const providers = usePauProviders(isAdmin).data;
  const { stores } = useCrmMe();
  if (!s) return null;
  const ok = Array.isArray(providers) ? providers.length : 0;
  const modes = stores.length
    ? stores.map((t) => `${t.name}: ${PAU_MODE_LABEL[storeMode(s, t.id)]}`).join(" · ")
    : PAU_MODE_LABEL[s.mode];
  return (
    <div className="flex items-center gap-3 rounded-2xl border bg-card p-4 shadow-sm">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
        <Sparkles className="h-5 w-5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <b className="block">Pau · agente de ventas y cobranzas</b>
        <span className="block text-xs text-muted-foreground" data-testid="pau-summary">
          {modes}
          {isAdmin && ` · ${ok} proveedor${ok === 1 ? "" : "es"} de IA conectado${ok === 1 ? "" : "s"}`}
        </span>
      </div>
      <Badge className="shrink-0 bg-primary/10 text-primary hover:bg-primary/10">Incluido en tu plan</Badge>
    </div>
  );
}

/** Pestaña Pau: agente de ventas con IA de cada negocio. */
export default function PauView({ defaultTab = "modo" }: { defaultTab?: PauTab }) {
  const { isAdmin, level } = useCrmMe();
  const [tab, setTab] = useState<PauTab>(defaultTab);
  // «Aprende» también lo revisa la supervisora (mockup 152); el resto de la configuración es del administrador.
  const tabs = PAU_TABS.filter((t) => isAdmin || !t.admin || (t.key === "apr" && level === "supervisor"));
  const current = tabs.some((t) => t.key === tab) ? tab : "modo";
  const canReview = tabs.some((t) => t.key === "apr");
  const pendingCount = usePauLearning(canReview).data?.pending.length ?? 0;
  const targets = useStoreTargets();
  const [storeChoice, setStoreChoice] = useState("");
  // Tienda elegida en «Quién vende»; por defecto la primera (KUNCA, LIVII…).
  const storeId = targets.some((t) => t.id === storeChoice) ? storeChoice : targets[0].id;
  return (
    // Sección propia de Pau a todo el ancho (mockup 152), no una columna centrada.
    <div className="w-full space-y-4" data-testid="pau-view">
      <PauSummary isAdmin={isAdmin} />
      <div role="tablist" aria-label="Secciones de Pau" className="flex flex-wrap gap-1 border-b">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={current === t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              current === t.key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
            {t.key === "apr" && pendingCount > 0 && (
              <span
                className="ml-1.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-xs font-semibold text-primary"
                aria-label={`${pendingCount} por aprobar`}
              >
                {pendingCount}
              </span>
            )}
          </button>
        ))}
      </div>
      <div role="tabpanel" className="space-y-4">
        {current !== "modo" && targets.length > 1 && (
          <p className="text-xs text-muted-foreground" data-testid="pau-all-stores">
            Esta configuración vale para todas las tiendas. Quién vende y la fase se eligen por tienda en «Quién vende».
          </p>
        )}
        {current === "modo" && (
          <>
            {isAdmin && <StorePicker targets={targets} value={storeId} onChange={setStoreChoice} />}
            <ModeSection isAdmin={isAdmin} storeId={storeId} />
            {isAdmin && <PhaseChannelsSection />}
          </>
        )}
        {current === "pers" && (
          <>
            <PersonalitySection />
            <KnowledgeSection />
            <SandboxSection />
          </>
        )}
        {current === "perm" && <CapabilitiesSection />}
        {current === "prov" && (
          <>
            <ProvidersSection />
            <ProviderRulesSection />
          </>
        )}
        {current === "apr" && (
          <>
            <PauAprende />
            {isAdmin && <PauTrainingSection />}
          </>
        )}
        {current === "cons" && (
          <>
            <UsageSection />
            <UsageByProviderSection />
          </>
        )}
      </div>
    </div>
  );
}
