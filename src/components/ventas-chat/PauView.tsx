"use client";
import { useState } from "react";
import { AlertTriangle, CheckCircle2, Info, Loader2, Lock, Pencil, Plus, Trash2, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useCrmMe } from "@/hooks/useCrmMe";
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
import { SandboxSection, UsageSection } from "./PauUsageSandbox";
import {
  PAU_INSTRUCTIONS_MAX,
  PAU_KNOWLEDGE_MAX,
  PAU_MODE_LABEL,
  PAU_MODE_OPTIONS,
  PROVIDER_LABEL,
} from "./pau";
import { relativeTime } from "./format";

function ModeSection({ isAdmin }: { isAdmin: boolean }) {
  const settings = usePauSettings();
  const update = useUpdatePauSettings();
  const [confirmAuto, setConfirmAuto] = useState(false);
  const s = settings.data;
  const err = settings.isError ? crmError(settings.error) : null;

  const choose = (mode: PauMode) => {
    if (!s || mode === s.mode || update.isPending) return;
    if (mode === "auto") {
      setConfirmAuto(true);
      return;
    }
    update.mutate({ mode });
  };

  return (
    <section aria-labelledby="pau-quien" className="space-y-3 rounded-md border bg-card p-4">
      <div>
        <h2 id="pau-quien" className="text-base font-semibold">Quién atiende</h2>
        <p className="text-sm text-muted-foreground">
          Elige cómo participa Pau en los chats de WhatsApp.
        </p>
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
            Modo actual: <strong>{PAU_MODE_LABEL[s.mode]}</strong>
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
                Para encender a Pau primero conecta un proveedor de IA en{" "}
                <a href="#pau-proveedores" className="font-medium underline">
                  Proveedores de IA
                </a>
                .
              </span>
            </p>
          )}
          <div role="radiogroup" aria-label="Quién atiende" className="grid gap-2 md:grid-cols-3">
            {PAU_MODE_OPTIONS.map((o) => {
              const checked = s.mode === o.value;
              const blocked = o.value !== "off" && !s.hasProvider;
              return (
                <button
                  key={o.value}
                  type="button"
                  role="radio"
                  aria-checked={checked}
                  disabled={blocked || update.isPending}
                  onClick={() => choose(o.value)}
                  className={cn(
                    "flex flex-col items-start gap-1 rounded-md border p-3 text-left transition-colors",
                    "hover:bg-accent/50 disabled:cursor-not-allowed disabled:opacity-50",
                    checked && "border-primary bg-accent",
                  )}
                >
                  <span className="flex items-center gap-2 text-sm font-semibold">
                    {o.title}
                    {checked && <CheckCircle2 className="h-4 w-4 text-primary" aria-hidden />}
                  </span>
                  <span className="text-xs text-muted-foreground">{o.description}</span>
                </button>
              );
            })}
          </div>
        </>
      )}
      <ConfirmDialog
        open={confirmAuto}
        title="¿Dejar que Pau responda solo?"
        description="Pau escribirá a clientes reales por WhatsApp sin que nadie apruebe cada mensaje. Pasa el chat a una persona cuando le falta un dato, cuando pide ayuda o cuando alguien del equipo envía un mensaje en ese chat; en la bandeja verás «Pau pidió ayuda». Puedes tomar cualquier chat o apagar a Pau cuando quieras."
        confirmLabel="Sí, que responda solo"
        onCancel={() => setConfirmAuto(false)}
        onConfirm={() => {
          setConfirmAuto(false);
          update.mutate({ mode: "auto" });
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

/** Pestaña Pau: agente de ventas con IA de cada negocio. */
export default function PauView() {
  const { isAdmin } = useCrmMe();
  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <ModeSection isAdmin={isAdmin} />
      {isAdmin && (
        <>
          <ProvidersSection />
          <KnowledgeSection />
          <UsageSection />
          <SandboxSection />
        </>
      )}
    </div>
  );
}
