"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { BellOff, Info } from "lucide-react";
import { useEffect, useId, useMemo } from "react";
import { useForm, useWatch } from "react-hook-form";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { WhatsAppResourceState } from "@/components/whatsapp/WhatsAppResourceState";
import {
  ALERT_DEFINITIONS,
  ALERT_RECIPIENT_OPTIONS,
  RECENT_ALERTS_DAYS,
} from "@/features/whatsapp/constants/whatsapp-settings-catalog";
import { WHATSAPP_TAB_DEFINITIONS } from "@/features/whatsapp/constants/whatsapp-tabs";
import type { WhatsAppTab } from "@/features/whatsapp/enums/whatsapp.enums";
import type { WhatsAppResourceState as ResourceState } from "@/features/whatsapp/models/resource-state.model";
import type {
  WhatsAppAlertSettings,
  WhatsAppRecentAlert,
} from "@/features/whatsapp/models/settings-tab.model";
import {
  type AlertSettingsValues,
  alertSettingsSchema,
  toAlertSettingsValues,
} from "@/features/whatsapp/schemas/settings-tab.schema";
import { formatLimaDayLabel, formatLimaTime } from "@/features/whatsapp/utils/lima-time.util";
import { parseWhatsAppTab } from "@/features/whatsapp/utils/whatsapp-tab.util";
import { SettingsDraftFooter, SuggestedValuesNote } from "./SettingsDraftFooter";
import { resolveSettingsSource, type SettingsSource } from "./settings-types";

const UNIT_SUFFIX = { percent: "%", minutes: "min" } as const;

function AlertRulesForm({
  source,
  canEdit,
  blockedReason,
  onSave,
}: {
  source: SettingsSource<AlertSettingsValues>;
  canEdit: boolean;
  blockedReason: string | null;
  onSave?: (values: AlertSettingsValues) => Promise<void>;
}) {
  const pauseId = useId();
  const form = useForm<AlertSettingsValues>({
    resolver: zodResolver(alertSettingsSchema),
    defaultValues: source.values,
    mode: "onChange",
  });
  const values = useWatch({ control: form.control }) as AlertSettingsValues;
  const sourceKey = JSON.stringify(source.values);
  const baseKey = JSON.stringify(form.formState.defaultValues);
  const isDirty = JSON.stringify(values) !== baseKey;

  useEffect(() => {
    const next = JSON.parse(sourceKey) as AlertSettingsValues;
    if (JSON.stringify(form.getValues()) === JSON.stringify(form.formState.defaultValues)) {
      form.reset(next);
    }
  }, [sourceKey, form]);

  const save = async () => {
    const valid = await form.trigger();
    if (!valid || !onSave) throw new Error("Revisa los umbrales marcados.");
    await onSave(form.getValues());
  };

  return (
    <Form {...form}>
      <form noValidate className="space-y-4" onSubmit={(event) => event.preventDefault()}>
        {source.note && <SuggestedValuesNote reason={source.note} />}
        <ul className="space-y-2">
          {ALERT_DEFINITIONS.map((definition, index) => {
            const enabled = values.rules?.[index]?.enabled ?? false;
            const unit = definition.unit;
            return (
              <li key={definition.type} className="space-y-2 rounded-lg border p-3">
                <FormField
                  control={form.control}
                  name={`rules.${index}.enabled`}
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between gap-3 space-y-0">
                      <FormLabel className="font-normal">{definition.label}</FormLabel>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          disabled={!canEdit}
                          onCheckedChange={(checked) => {
                            field.onChange(checked);
                            void form.trigger(`rules.${index}.threshold`);
                          }}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                {unit && (
                  <FormField
                    control={form.control}
                    name={`rules.${index}.threshold`}
                    render={({ field }) => (
                      <FormItem className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <FormLabel className="text-sm font-normal text-muted-foreground">
                            {unit === "percent" ? "Avisar desde" : "Avisar después de"}
                          </FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              inputMode="numeric"
                              className="h-8 w-20"
                              disabled={!canEdit || !enabled}
                            />
                          </FormControl>
                          <span className="text-sm text-muted-foreground">
                            {UNIT_SUFFIX[unit]} (entre {definition.min} y {definition.max})
                          </span>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </li>
            );
          })}
        </ul>

        <FormField
          control={form.control}
          name="pauseCampaignsOnRed"
          render={({ field }) => (
            <FormItem className="flex items-start justify-between gap-3 space-y-0 rounded-lg border p-3">
              <div className="space-y-1">
                <FormLabel htmlFor={pauseId} className="font-normal">
                  Pausar envíos programados y masivos si la calidad del número baja a roja
                </FormLabel>
                <p className="text-xs text-muted-foreground">
                  Los avisos automáticos de envío siguen saliendo. POWIP pausa y reanuda las
                  campañas; esta pantalla no pausa nada.
                </p>
              </div>
              <FormControl>
                <Switch
                  id={pauseId}
                  checked={field.value}
                  disabled={!canEdit}
                  onCheckedChange={(checked) => field.onChange(checked)}
                />
              </FormControl>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="recipients"
          render={({ field }) => (
            <FormItem>
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium">Quién recibe las alertas</legend>
                {ALERT_RECIPIENT_OPTIONS.map((option) => (
                  <label key={option.value} className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="alert-recipients"
                      value={option.value}
                      checked={field.value === option.value}
                      disabled={!canEdit}
                      onChange={() => field.onChange(option.value)}
                      className="h-4 w-4 accent-primary"
                    />
                    {option.label}
                  </label>
                ))}
              </fieldset>
              <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                <BellOff className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                La campanita de POWIP todavía no existe: hasta que esté disponible, las alertas no
                se verán dentro de POWIP.
              </p>
            </FormItem>
          )}
        />

        <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          POWIP evalúa las alertas y no repite la misma antes de 6 horas.
        </p>

        <SettingsDraftFooter
          isDirty={isDirty}
          blockedReason={blockedReason}
          saveLabel="Guardar alertas"
          discardTitle="¿Descartar los cambios en las alertas?"
          onDiscard={() => form.reset(form.formState.defaultValues as AlertSettingsValues)}
          onSave={onSave ? save : undefined}
        />
      </form>
    </Form>
  );
}

function RecentAlerts({
  alerts,
  now,
  onRetry,
  onOpenTab,
}: {
  alerts: ResourceState<WhatsAppRecentAlert[]>;
  now: Date;
  onRetry?: () => void;
  onOpenTab: (tab: WhatsAppTab) => void;
}) {
  const tabLabels = useMemo(
    () => new Map(WHATSAPP_TAB_DEFINITIONS.map((definition) => [definition.key, definition.label])),
    [],
  );
  return (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold">Últimas alertas ({RECENT_ALERTS_DAYS} días)</h4>
      <WhatsAppResourceState
        state={alerts}
        pendingTitle="Alertas pendientes de integración"
        pendingDescription="Las alertas reales aparecerán cuando POWIP las genere."
        loadingLabel="Cargando alertas"
        errorTitle="No se pudieron cargar las alertas"
        onRetry={onRetry}
        isEmpty={(data) => data.length === 0}
        empty={
          <p className="text-sm text-muted-foreground">
            Sin alertas en los últimos {RECENT_ALERTS_DAYS} días.
          </p>
        }
      >
        {(data) => (
          <ul className="divide-y rounded-lg border">
            {data.map((alert) => {
              const tab = parseWhatsAppTab(alert.relatedTab);
              return (
                <li
                  key={alert.id}
                  className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm"
                >
                  <span className="min-w-0 flex-1">
                    <time
                      className="mr-2 text-xs text-muted-foreground"
                      dateTime={alert.createdAt.toISOString()}
                    >
                      {formatLimaDayLabel(alert.createdAt, now)} {formatLimaTime(alert.createdAt)}
                    </time>
                    <span className="[overflow-wrap:anywhere]">{alert.message}</span>
                  </span>
                  {tab ? (
                    <Button type="button" variant="ghost" size="sm" onClick={() => onOpenTab(tab)}>
                      Ver
                      <span className="sr-only"> en {tabLabels.get(tab)}</span>
                    </Button>
                  ) : (
                    <span className="text-xs text-muted-foreground">Sin pestaña relacionada</span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </WhatsAppResourceState>
    </div>
  );
}

interface AlertsSectionProps {
  settings: ResourceState<WhatsAppAlertSettings | null>;
  recentAlerts: ResourceState<WhatsAppRecentAlert[]>;
  storeKey: string;
  now: Date;
  canEdit: boolean;
  blockedReason: string | null;
  onSave?: (values: AlertSettingsValues) => Promise<void>;
  onRetry?: () => void;
  onOpenTab: (tab: WhatsAppTab) => void;
}

export function AlertsSection({
  settings,
  recentAlerts,
  storeKey,
  now,
  canEdit,
  blockedReason,
  onSave,
  onRetry,
  onOpenTab,
}: AlertsSectionProps) {
  const source = resolveSettingsSource(settings, toAlertSettingsValues);
  return (
    <section aria-labelledby="alerts-title" className="space-y-4 rounded-xl border p-4">
      <div>
        <h3 id="alerts-title" className="font-semibold">
          Alertas de salud
        </h3>
        <p className="text-sm text-muted-foreground">
          Te avisamos antes de que un problema afecte a tus clientes.
        </p>
      </div>
      {source ? (
        <AlertRulesForm
          key={storeKey}
          source={source}
          canEdit={canEdit}
          blockedReason={blockedReason}
          onSave={onSave}
        />
      ) : (
        <WhatsAppResourceState
          state={settings}
          pendingTitle=""
          loadingLabel="Cargando alertas"
          errorTitle="No se pudo cargar la configuración de alertas"
          onRetry={onRetry}
        >
          {() => null}
        </WhatsAppResourceState>
      )}
      <RecentAlerts alerts={recentAlerts} now={now} onRetry={onRetry} onOpenTab={onOpenTab} />
    </section>
  );
}
