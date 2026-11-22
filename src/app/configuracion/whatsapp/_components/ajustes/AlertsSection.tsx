"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  BarChart3,
  BellOff,
  FileText,
  Info,
  type LucideIcon,
  MessageSquare,
  Pause,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { WaCard, WaCardHeader } from "@/components/whatsapp/ui/WaCard";
import { WaInput } from "@/components/whatsapp/ui/WaInput";
import { WaMini, WaPill } from "@/components/whatsapp/ui/WaPill";
import {
  waButton,
  waField,
  waInput,
  waLabel,
  waSelectTrigger,
  waSwitch,
} from "@/components/whatsapp/ui/wa-classes";
import { WhatsAppResourceState } from "@/components/whatsapp/WhatsAppResourceState";
import {
  ALERT_DEFINITIONS,
  ALERT_RECIPIENT_OPTIONS,
  RECENT_ALERTS_DAYS,
} from "@/features/whatsapp/constants/whatsapp-settings-catalog";
import { WHATSAPP_TAB_DEFINITIONS } from "@/features/whatsapp/constants/whatsapp-tabs";
import {
  WHATSAPP_ALERT_TYPES,
  type WhatsAppAlertType,
  type WhatsAppTab,
} from "@/features/whatsapp/enums/whatsapp.enums";
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
import { cn } from "@/lib/utils";
import { SettingsDraftFooter, SuggestedValuesNote } from "./SettingsDraftFooter";
import { resolveSettingsSource, type SettingsSource } from "./settings-types";

const UNIT_SUFFIX = { percent: "%", minutes: "min" } as const;

const ALERT_ICONS: Record<WhatsAppAlertType, LucideIcon> = {
  [WHATSAPP_ALERT_TYPES.QUALITY]: ShieldCheck,
  [WHATSAPP_ALERT_TYPES.TEMPLATE]: FileText,
  [WHATSAPP_ALERT_TYPES.FAILED_PCT]: TriangleAlert,
  [WHATSAPP_ALERT_TYPES.DAILY_LIMIT_PCT]: BarChart3,
  [WHATSAPP_ALERT_TYPES.UNATTENDED_MINUTES]: MessageSquare,
};

const TOGGLE_ROW =
  "flex items-center gap-3 rounded-xl border border-wa-border bg-wa-surface px-4 py-[13px] text-[13px]";

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
      <form noValidate className="flex flex-col gap-2" onSubmit={(event) => event.preventDefault()}>
        {source.note && <SuggestedValuesNote reason={source.note} />}
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {ALERT_DEFINITIONS.map((definition, index) => {
            const enabled = values.rules?.[index]?.enabled ?? false;
            const unit = definition.unit;
            const Icon = ALERT_ICONS[definition.type];
            return (
              <li key={definition.type} className={TOGGLE_ROW}>
                <Icon className="size-[18px] shrink-0 text-wa-muted" aria-hidden="true" />
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <FormField
                    control={form.control}
                    name={`rules.${index}.enabled`}
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between gap-3 space-y-0">
                        <FormLabel className="text-[13px] font-normal leading-snug text-wa-fg">
                          {definition.label}
                        </FormLabel>
                        <FormControl>
                          <Switch
                            className={waSwitch}
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
                        <FormItem className="flex flex-col gap-1 space-y-0">
                          <div className="flex flex-wrap items-center gap-1.5 text-xs text-wa-muted">
                            <FormLabel className="text-xs font-normal text-wa-muted">
                              {unit === "percent" ? "Avisar desde" : "Avisar después de"}
                            </FormLabel>
                            <FormControl>
                              <WaInput
                                {...field}
                                inputMode="numeric"
                                className={cn(waInput, "wa-num w-16 px-2 py-1 text-center")}
                                disabled={!canEdit || !enabled}
                              />
                            </FormControl>
                            <span>
                              {UNIT_SUFFIX[unit]} (entre {definition.min} y {definition.max})
                            </span>
                          </div>
                          <FormMessage className="text-xs text-wa-red" />
                        </FormItem>
                      )}
                    />
                  )}
                </div>
              </li>
            );
          })}
        </ul>

        <FormField
          control={form.control}
          name="pauseCampaignsOnRed"
          render={({ field }) => (
            <FormItem className={cn(TOGGLE_ROW, "space-y-0 border-wa-teal")}>
              <Pause className="size-[18px] shrink-0 text-wa-muted" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <FormLabel htmlFor={pauseId} className="text-[13px] font-normal text-wa-fg">
                  Pausar envíos programados y masivos si la calidad del número baja a roja
                </FormLabel>
                <p className="m-0 text-[11px] text-wa-muted">
                  Los avisos automáticos de envío siguen saliendo. POWIP pausa y reanuda las
                  campañas; esta pantalla no pausa nada.
                </p>
              </div>
              <FormControl>
                <Switch
                  id={pauseId}
                  className={waSwitch}
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
            <FormItem className={cn(waField, "mt-1.5")}>
              <FormLabel className={waLabel}>Quién recibe las alertas</FormLabel>
              <Select
                value={field.value}
                disabled={!canEdit}
                onValueChange={(value) => {
                  if (value && value !== field.value) field.onChange(value);
                }}
              >
                <FormControl>
                  <SelectTrigger className={waSelectTrigger} onBlur={field.onBlur}>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {ALERT_RECIPIENT_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="m-0 flex items-start gap-1.5 text-xs text-wa-muted">
                <BellOff className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                La campanita de POWIP todavía no existe: hasta que esté disponible, las alertas no
                se verán dentro de POWIP.
              </p>
            </FormItem>
          )}
        />

        <p className="m-0 flex items-start gap-1.5 text-xs text-wa-muted">
          <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
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
    <WaCard aria-labelledby="recent-alerts-title">
      <WaCardHeader
        level={3}
        titleId="recent-alerts-title"
        title="Últimas alertas"
        actions={<WaPill>{RECENT_ALERTS_DAYS} días</WaPill>}
      />
      <WhatsAppResourceState
        state={alerts}
        pendingTitle="Alertas pendientes de integración"
        pendingDescription="Las alertas reales aparecerán cuando POWIP las genere."
        loadingLabel="Cargando alertas"
        errorTitle="No se pudieron cargar las alertas"
        onRetry={onRetry}
        isEmpty={(data) => data.length === 0}
        empty={
          <p className="m-0 text-[13px] text-wa-muted">
            Sin alertas en los últimos {RECENT_ALERTS_DAYS} días.
          </p>
        }
      >
        {(data) => (
          <ul className="m-0 list-none p-0">
            {data.map((alert) => {
              const tab = parseWhatsAppTab(alert.relatedTab);
              return (
                <li
                  key={alert.id}
                  className="flex flex-wrap items-center gap-3 border-t border-wa-border py-3 first:border-t-0 first:pt-0"
                >
                  <WaMini tone="warn" className="wa-num">
                    <time dateTime={alert.createdAt.toISOString()}>
                      {formatLimaDayLabel(alert.createdAt, now)} {formatLimaTime(alert.createdAt)}
                    </time>
                  </WaMini>
                  <span className="min-w-[180px] flex-1 text-[13px] [overflow-wrap:anywhere]">
                    {alert.message}
                  </span>
                  {tab ? (
                    <Button
                      type="button"
                      className={waButton({ size: "sm" })}
                      onClick={() => onOpenTab(tab)}
                    >
                      Ver
                      <span className="sr-only"> en {tabLabels.get(tab)}</span>
                    </Button>
                  ) : (
                    <span className="text-xs text-wa-muted">Sin pestaña relacionada</span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </WhatsAppResourceState>
    </WaCard>
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
    <div className="grid grid-cols-1 items-start gap-5 min-[900px]:grid-cols-2">
      <WaCard aria-labelledby="alerts-title">
        <WaCardHeader
          level={3}
          titleId="alerts-title"
          title="Alertas de salud"
          description="Te avisamos antes de que un problema afecte a tus clientes."
        />
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
      </WaCard>
      <RecentAlerts alerts={recentAlerts} now={now} onRetry={onRetry} onOpenTab={onOpenTab} />
    </div>
  );
}
