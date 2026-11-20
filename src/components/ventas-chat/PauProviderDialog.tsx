"use client";
import { useState } from "react";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { crmError } from "@/services/crmService";
import { usePauProviderActions } from "@/hooks/useCrmPau";
import type { PauProvider, PauProviderKind, PauProviderTest } from "@/types/crm";
import { NATIVE_SELECT_CLASS } from "./format";
import { ANTHROPIC_DEFAULT_MODEL, PROVIDER_LABEL } from "./pau";

const SELECT = cn(NATIVE_SELECT_CLASS, "h-9 text-sm");

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Proveedor a editar; sin él se conecta uno nuevo. */
  provider?: PauProvider;
}

/**
 * Conectar o editar un proveedor de IA. La llave solo vive en este estado
 * local mientras se escribe: se borra apenas se guarda y nunca se vuelve a pintar.
 */
export default function PauProviderDialog({ open, onOpenChange, provider }: Props) {
  const actions = usePauProviderActions();
  const [kind, setKind] = useState<PauProviderKind>(provider?.provider ?? "anthropic");
  const [label, setLabel] = useState(provider?.label ?? "");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState(
    provider?.model ?? (provider ? "" : ANTHROPIC_DEFAULT_MODEL),
  );
  const [baseUrl, setBaseUrl] = useState(provider?.baseUrl ?? "");
  const [tried, setTried] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PauProviderTest | null>(null);
  const [pickedModel, setPickedModel] = useState("");
  const [modelQuery, setModelQuery] = useState("");
  const visibleModels = result
    ? result.models.filter((m) => {
        const q = modelQuery.trim().toLowerCase();
        return !q || m.toLowerCase().includes(q) || m === pickedModel;
      })
    : [];
  const [savingModel, setSavingModel] = useState(false);

  const editing = !!provider;
  const errors = {
    label: label.trim() ? undefined : "Escribe una etiqueta para reconocerlo",
    apiKey: editing || apiKey.trim() ? undefined : "Pega la llave del proveedor",
    model: kind === "openai" && !model.trim() ? "OpenAI necesita que indiques el modelo" : undefined,
    baseUrl:
      kind === "openai_compatible" && !/^https:\/\/\S+$/.test(baseUrl.trim())
        ? "Escribe la URL base con https://"
        : undefined,
  };
  const valid = !errors.label && !errors.apiKey && !errors.model && !errors.baseUrl;

  const changeKind = (next: PauProviderKind) => {
    setKind(next);
    // El modelo de Claude solo se prellena para Anthropic.
    setModel((m) =>
      next === "anthropic"
        ? m.trim()
          ? m
          : ANTHROPIC_DEFAULT_MODEL
        : m === ANTHROPIC_DEFAULT_MODEL
          ? ""
          : m,
    );
  };

  const runTest = async (id: string) => {
    const r = await actions.test(id);
    setResult(r);
    setPickedModel(r.provider.model);
  };

  const submit = async () => {
    setTried(true);
    if (!valid || pending) return;
    setPending(true);
    setError(null);
    try {
      if (provider) {
        const key = apiKey.trim();
        await actions.update(provider.id, {
          label: label.trim(),
          model: model.trim() || undefined,
          ...(key ? { apiKey: key } : {}),
        });
        setApiKey("");
        if (key) await runTest(provider.id);
        else onOpenChange(false);
      } else {
        const created = await actions.create({
          provider: kind,
          label: label.trim(),
          apiKey: apiKey.trim(),
          ...(model.trim() ? { model: model.trim() } : {}),
          ...(kind === "openai_compatible" ? { baseUrl: baseUrl.trim() } : {}),
        });
        setApiKey("");
        await runTest(created.id);
      }
    } catch (err) {
      setError(crmError(err).message);
    } finally {
      setPending(false);
    }
  };

  const useModel = async () => {
    if (!result || !pickedModel || pickedModel === result.provider.model) {
      onOpenChange(false);
      return;
    }
    setSavingModel(true);
    try {
      await actions.update(result.provider.id, { model: pickedModel });
      onOpenChange(false);
    } catch (err) {
      setError(crmError(err).message);
    } finally {
      setSavingModel(false);
    }
  };

  const showErr = (k: keyof typeof errors) => (tried ? errors[k] : undefined);
  const changed = !!result && pickedModel !== "" && pickedModel !== result.provider.model;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar proveedor" : "Conectar proveedor"}</DialogTitle>
          <DialogDescription>
            La llave se guarda cifrada. El consumo lo cobra el proveedor directamente a tu negocio, no Powip.
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="space-y-3" data-testid="provider-test-result">
            {result.ok ? (
              <p
                role="status"
                className="flex items-start gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-400"
              >
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                Conexión correcta. La llave funciona.
              </p>
            ) : (
              <p role="alert" className="flex items-start gap-2 text-sm font-medium text-destructive">
                <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
                La prueba falló: {result.error ?? "el proveedor no respondió"}
              </p>
            )}
            {result.ok && result.models.length > 0 && (
              <div className="space-y-1.5">
                <Label htmlFor="pau-model-pick">Modelo que usará Pau</Label>
                <Input
                  id="pau-model-search"
                  type="search"
                  value={modelQuery}
                  onChange={(e) => setModelQuery(e.target.value)}
                  placeholder="Buscar modelo (ej.: free, deepseek, gemini)"
                  autoComplete="off"
                  spellCheck={false}
                />
                <select
                  id="pau-model-pick"
                  className="w-full rounded-md border border-input bg-background p-1 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={pickedModel}
                  onChange={(e) => setPickedModel(e.target.value)}
                  size={Math.min(10, Math.max(4, visibleModels.length))}
                >
                  {!result.models.includes(pickedModel) && (
                    <option value={pickedModel}>{pickedModel}</option>
                  )}
                  {visibleModels.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">
                  {visibleModels.length} de {result.models.length} modelos de tu cuenta.
                </p>
              </div>
            )}
            {error && (
              <p role="alert" className="text-sm font-medium text-destructive">
                {error}
              </p>
            )}
            <DialogFooter>
              {result.ok ? (
                <Button onClick={useModel} disabled={savingModel}>
                  {savingModel && <Loader2 className="animate-spin" />}
                  {changed ? "Usar este modelo" : "Listo"}
                </Button>
              ) : (
                <Button onClick={() => onOpenChange(false)}>Cerrar</Button>
              )}
            </DialogFooter>
          </div>
        ) : (
          <form
            className="space-y-3"
            autoComplete="off"
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="pau-provider">Proveedor</Label>
              <select
                id="pau-provider"
                className={SELECT}
                value={kind}
                disabled={editing}
                onChange={(e) => changeKind(e.target.value as PauProviderKind)}
              >
                {(Object.keys(PROVIDER_LABEL) as PauProviderKind[]).map((k) => (
                  <option key={k} value={k}>
                    {PROVIDER_LABEL[k]}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pau-label">Etiqueta</Label>
              <Input
                id="pau-label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Ej.: Cuenta principal"
                maxLength={80}
              />
              {showErr("label") && (
                <p role="alert" className="text-xs font-medium text-destructive">
                  {showErr("label")}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pau-key">
                {editing ? "Reemplazar llave (opcional)" : "Llave del proveedor"}
              </Label>
              <Input
                id="pau-key"
                type="password"
                autoComplete="off"
                spellCheck={false}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={
                  editing
                    ? `Vacío = conservar la actual (${provider?.keyHint ?? ""})`
                    : "Pega aquí la llave"
                }
              />
              {showErr("apiKey") && (
                <p role="alert" className="text-xs font-medium text-destructive">
                  {showErr("apiKey")}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              {kind === "openai_compatible" && (
                <div className="space-y-1.5">
                  <Label htmlFor="pau-base-url">URL base</Label>
                  <Input
                    id="pau-base-url"
                    value={baseUrl}
                    onChange={(e) => setBaseUrl(e.target.value)}
                    placeholder="https://ai-gateway.kilo.ai/api/v1"
                    autoComplete="off"
                    spellCheck={false}
                  />
                  {showErr("baseUrl") && (
                    <p role="alert" className="text-xs font-medium text-destructive">
                      {showErr("baseUrl")}
                    </p>
                  )}
                </div>
              )}
              <Label htmlFor="pau-model">
                Modelo{kind === "openai" ? "" : " (opcional)"}
              </Label>
              <Input
                id="pau-model"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder={
                  kind === "anthropic"
                    ? ANTHROPIC_DEFAULT_MODEL
                    : kind === "openai_compatible"
                      ? "Vacío = se elige al probar la conexión"
                      : "Ej.: gpt-4.1"
                }
                autoComplete="off"
              />
              {showErr("model") && (
                <p role="alert" className="text-xs font-medium text-destructive">
                  {showErr("model")}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Al guardar probamos la llave y te mostramos los modelos disponibles en tu cuenta.
              </p>
            </div>
            {error && (
              <p role="alert" className="text-sm font-medium text-destructive">
                {error}
              </p>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={pending}>
                {pending && <Loader2 className="animate-spin" />}
                {editing ? "Guardar" : "Conectar"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
