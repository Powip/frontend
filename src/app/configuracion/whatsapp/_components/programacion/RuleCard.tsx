"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Clock3 } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { BlockedActionButton } from "@/components/whatsapp/BlockedActionButton";
import {
  getRuleDefinition,
  WHATSAPP_RULE_WHEN_MODE_LABELS,
} from "@/features/whatsapp/constants/whatsapp-scheduling-catalog";
import { WHATSAPP_TEMPLATE_STATUS_LABELS } from "@/features/whatsapp/constants/whatsapp-template-catalog";
import {
  WHATSAPP_RULE_WHEN_MODES,
  WHATSAPP_TEMPLATE_STATUSES,
  type WhatsAppRuleWhenMode,
} from "@/features/whatsapp/enums/whatsapp.enums";
import { toRuleConfigValues } from "@/features/whatsapp/mappers/to-scheduling-form-values.mapper";
import type { WhatsAppResourceState } from "@/features/whatsapp/models/resource-state.model";
import type { WhatsAppRule } from "@/features/whatsapp/models/rule.model";
import type { WhatsAppScopeCatalogs } from "@/features/whatsapp/models/scope-catalog.model";
import type { WhatsAppTemplate } from "@/features/whatsapp/models/template.model";
import {
  createRuleConfigSchema,
  type RuleConfigValues,
} from "@/features/whatsapp/schemas/rule-config.schema";
import { describeRuleScope, describeRuleWhen } from "@/features/whatsapp/utils/rule-summary.util";
import { cn } from "@/lib/utils";
import { RuleScopeFields } from "./RuleScopeFields";
import { buildScopeLabels } from "./scope-labels";

const WHEN_VALUE_DEFAULTS: Partial<
  Record<WhatsAppRuleWhenMode, { field: keyof RuleConfigValues; value: string }>
> = {
  [WHATSAPP_RULE_WHEN_MODES.DELAY_MINUTES]: { field: "delayMinutes", value: "30" },
  [WHATSAPP_RULE_WHEN_MODES.FIXED_TIME]: { field: "fixedTime", value: "09:00" },
  [WHATSAPP_RULE_WHEN_MODES.HOURS_BEFORE_DELIVERY]: { field: "hoursBefore", value: "24" },
};

export interface RuleActivationRequest {
  rule: WhatsAppRule;
  mode: "activate" | "count";
  hasUnsavedChanges: boolean;
  scopeSummary: string;
}

interface RuleCardProps {
  rule: WhatsAppRule;
  templates: WhatsAppResourceState<WhatsAppTemplate[]>;
  catalogs: WhatsAppScopeCatalogs;
  canManage: boolean;
  canPersist: boolean;
  persistenceNoteId: string;
  highlighted: boolean;
  preselectTemplateId: string | null;
  onRequestActivation: (request: RuleActivationRequest) => void;
  onRequestDeactivation: (rule: WhatsAppRule) => void;
  onPreviewTemplate: (template: WhatsAppTemplate) => void;
}

function toWhen(values: RuleConfigValues) {
  return {
    mode: values.whenMode,
    minutes: values.delayMinutes ? Number(values.delayMinutes) : null,
    time: values.fixedTime || null,
    hours: values.hoursBefore ? Number(values.hoursBefore) : null,
  };
}

export function RuleCard({
  rule,
  templates,
  catalogs,
  canManage,
  canPersist,
  persistenceNoteId,
  highlighted,
  preselectTemplateId,
  onRequestActivation,
  onRequestDeactivation,
  onPreviewTemplate,
}: RuleCardProps) {
  const definition = getRuleDefinition(rule.key);
  const supportsReminder = rule.reminder !== null || (definition?.supportsReminder ?? false);
  const schema = useMemo(
    () => createRuleConfigSchema({ allowedWhenModes: rule.allowedWhenModes, supportsReminder }),
    [rule.allowedWhenModes, supportsReminder],
  );
  const form = useForm<RuleConfigValues>({
    resolver: zodResolver(schema),
    defaultValues: toRuleConfigValues(rule),
    mode: "onTouched",
  });
  const { isDirty } = form.formState;
  const values = useWatch({ control: form.control }) as RuleConfigValues;
  const [confirmDiscardOpen, setConfirmDiscardOpen] = useState(false);
  const [preselectedNote, setPreselectedNote] = useState(false);
  const containerRef = useRef<HTMLElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const preselectApplied = useRef(false);
  const headingId = useId();
  const readOnly = !canManage;

  useEffect(() => {
    if (!form.formState.isDirty) form.reset(toRuleConfigValues(rule));
  }, [rule, form]);

  useEffect(() => {
    if (!highlighted) return;
    containerRef.current?.scrollIntoView?.({ behavior: "smooth", block: "center" });
    headingRef.current?.focus();
  }, [highlighted]);

  const templateList = useMemo(
    () => (templates.kind === "ready" ? templates.data : []),
    [templates],
  );
  const selectedTemplate =
    templateList.find((template) => template.id === values.templateId) ?? null;

  useEffect(() => {
    if (preselectApplied.current || !preselectTemplateId || readOnly) return;
    const target = templateList.find((template) => template.id === preselectTemplateId);
    if (!target || target.status !== WHATSAPP_TEMPLATE_STATUSES.APPROVED) return;
    preselectApplied.current = true;
    if (form.getValues("templateId") !== target.id) {
      form.setValue("templateId", target.id, { shouldDirty: true });
      setPreselectedNote(true);
    }
  }, [preselectTemplateId, templateList, readOnly, form]);

  const keepsApprovedVersion =
    rule.active &&
    selectedTemplate?.status === WHATSAPP_TEMPLATE_STATUSES.PENDING &&
    !!selectedTemplate.approvedVersion;
  const blockedMessage =
    rule.blockedReason ??
    (selectedTemplate &&
    selectedTemplate.status !== WHATSAPP_TEMPLATE_STATUSES.APPROVED &&
    !keepsApprovedVersion
      ? `La plantilla ${selectedTemplate.name} está ${WHATSAPP_TEMPLATE_STATUS_LABELS[
          selectedTemplate.status
        ].toLowerCase()} en Meta. Podrás activar este aviso cuando esté aprobada.`
      : null);

  const scopeSummary = describeRuleScope(
    {
      dateMode: values.dateMode,
      from: values.from || null,
      to: values.to || null,
      maxOrderAgeDays: Number(values.maxOrderAgeDays) || 0,
      storeIds: values.storeIds,
      salesChannels: values.salesChannels,
      shippingTypes: values.shippingTypes,
      courierIds: values.courierIds,
    },
    buildScopeLabels(catalogs),
  );

  const requestActivation = (mode: "activate" | "count") =>
    onRequestActivation({ rule, mode, hasUnsavedChanges: isDirty, scopeSummary });

  const handleWhenModeChange = (mode: WhatsAppRuleWhenMode) => {
    form.setValue("whenMode", mode, { shouldDirty: true, shouldValidate: true });
    const fallback = WHEN_VALUE_DEFAULTS[mode];
    if (fallback && !form.getValues(fallback.field)) {
      form.setValue(fallback.field, fallback.value as never, { shouldDirty: true });
    }
  };

  const stats = rule.stats;
  const monthlyCost = stats?.estimatedMonthly?.pen ?? null;

  return (
    <article
      ref={containerRef}
      aria-labelledby={headingId}
      data-rule-key={rule.key}
      className={cn(
        "flex min-w-0 flex-col gap-3 rounded-xl border bg-card p-4 shadow-sm",
        rule.active && "border-emerald-300 dark:border-emerald-500/40",
        highlighted && "ring-2 ring-primary ring-offset-2 ring-offset-background",
      )}
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h4 id={headingId} ref={headingRef} tabIndex={-1} className="font-semibold outline-none">
            {rule.label}
          </h4>
          {rule.triggerLabel && (
            <p className="text-xs text-muted-foreground">Se dispara: {rule.triggerLabel}</p>
          )}
        </div>
        <Switch
          checked={rule.active}
          disabled={readOnly || (!rule.active && !!blockedMessage)}
          aria-label={`${rule.active ? "Desactivar" : "Activar"} aviso ${rule.label}`}
          onCheckedChange={(checked) => {
            if (checked) requestActivation("activate");
            else onRequestDeactivation(rule);
          }}
        />
      </div>

      {blockedMessage && (
        <p className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
          <Clock3 className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {blockedMessage}
        </p>
      )}

      {keepsApprovedVersion && selectedTemplate && (
        <p className="rounded-lg border bg-muted/40 p-2.5 text-xs">
          Meta está revisando cambios de {selectedTemplate.name}; mientras tanto se sigue enviando
          la versión aprobada.
        </p>
      )}

      {preselectedNote && (
        <p role="status" className="rounded-lg border bg-muted/40 p-2.5 text-xs">
          Plantilla preseleccionada desde Plantillas. Todavía no se guardó ni se activó.
        </p>
      )}

      <Form {...form}>
        <form noValidate className="space-y-3" onSubmit={(event) => event.preventDefault()}>
          <fieldset disabled={readOnly} className="min-w-0 space-y-3">
            <legend className="sr-only">Configuración del aviso {rule.label}</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="templateId"
                render={({ field }) => (
                  <FormItem className="min-w-0">
                    <FormLabel>Plantilla</FormLabel>
                    <Select
                      value={field.value || undefined}
                      onValueChange={(value) => {
                        if (!value || value === field.value) return;
                        field.onChange(value);
                        setPreselectedNote(false);
                      }}
                      disabled={readOnly || templates.kind !== "ready"}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full" onBlur={field.onBlur}>
                          <SelectValue
                            placeholder={
                              templates.kind === "ready"
                                ? "Elige una plantilla"
                                : "Plantillas pendientes de integración"
                            }
                          />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {templateList.map((template) => (
                          <SelectItem
                            key={template.id}
                            value={template.id}
                            disabled={template.status !== WHATSAPP_TEMPLATE_STATUSES.APPROVED}
                          >
                            {template.name}
                            {template.status !== WHATSAPP_TEMPLATE_STATUSES.APPROVED &&
                              ` (${WHATSAPP_TEMPLATE_STATUS_LABELS[template.status].toLowerCase()})`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="whenMode"
                render={({ field }) => (
                  <FormItem className="min-w-0">
                    <FormLabel>Cuándo enviar</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={(value) => {
                        if (!value || value === field.value) return;
                        handleWhenModeChange(value as WhatsAppRuleWhenMode);
                      }}
                      disabled={readOnly}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full" onBlur={field.onBlur}>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {rule.allowedWhenModes.map((mode) => (
                          <SelectItem key={mode} value={mode}>
                            {WHATSAPP_RULE_WHEN_MODE_LABELS[mode]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {values.whenMode === WHATSAPP_RULE_WHEN_MODES.DELAY_MINUTES && (
              <FormField
                control={form.control}
                name="delayMinutes"
                render={({ field }) => (
                  <FormItem className="max-w-xs">
                    <FormLabel>Minutos después</FormLabel>
                    <FormControl>
                      <Input {...field} inputMode="numeric" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            {values.whenMode === WHATSAPP_RULE_WHEN_MODES.FIXED_TIME && (
              <FormField
                control={form.control}
                name="fixedTime"
                render={({ field }) => (
                  <FormItem className="max-w-xs">
                    <FormLabel>Hora (Lima)</FormLabel>
                    <FormControl>
                      <Input {...field} type="time" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            {values.whenMode === WHATSAPP_RULE_WHEN_MODES.HOURS_BEFORE_DELIVERY && (
              <FormField
                control={form.control}
                name="hoursBefore"
                render={({ field }) => (
                  <FormItem className="max-w-xs">
                    <FormLabel>Horas antes de la entrega estimada</FormLabel>
                    <FormControl>
                      <Input {...field} inputMode="numeric" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {supportsReminder && (
              <div className="flex flex-wrap items-start gap-3">
                <FormField
                  control={form.control}
                  name="reminderEnabled"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center gap-2 space-y-0 pt-2">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={(checked) =>
                            form.setValue("reminderEnabled", checked === true, {
                              shouldDirty: true,
                            })
                          }
                        />
                      </FormControl>
                      <FormLabel className="font-normal">Recordar si no lo recoge</FormLabel>
                    </FormItem>
                  )}
                />
                {values.reminderEnabled && (
                  <FormField
                    control={form.control}
                    name="reminderHours"
                    render={({ field }) => (
                      <FormItem className="w-40">
                        <FormLabel>Después de (horas)</FormLabel>
                        <FormControl>
                          <Input {...field} inputMode="numeric" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>
            )}

            <RuleScopeFields
              catalogs={catalogs}
              summary={scopeSummary}
              readOnly={readOnly}
              onRequestCount={() => requestActivation("count")}
            />
          </fieldset>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-dashed pt-3 text-xs text-muted-foreground">
            <span>{describeRuleWhen(toWhen(values))} · respeta horario</span>
            <span className="tabular-nums">
              {rule.active
                ? [
                    stats?.sentToday !== null && stats?.sentToday !== undefined
                      ? `${stats.sentToday} hoy`
                      : null,
                    monthlyCost ? `≈ S/ ${monthlyCost}/mes` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "Activo"
                : "Apagado"}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={!selectedTemplate}
              onClick={() => selectedTemplate && onPreviewTemplate(selectedTemplate)}
            >
              Ver mensaje
            </Button>
          </div>

          {canManage && isDirty && (
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setConfirmDiscardOpen(true)}
              >
                Descartar cambios
              </Button>
              <BlockedActionButton
                size="sm"
                blocked={!canPersist}
                blockedReasonId={persistenceNoteId}
                onClick={() => undefined}
              >
                Guardar cambios
              </BlockedActionButton>
            </div>
          )}
        </form>
      </Form>

      <AlertDialog open={confirmDiscardOpen} onOpenChange={setConfirmDiscardOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Descartar los cambios de «{rule.label}»?</AlertDialogTitle>
            <AlertDialogDescription>
              Volverás a la configuración guardada de este aviso.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Seguir editando</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                form.reset(toRuleConfigValues(rule));
                setPreselectedNote(false);
              }}
            >
              Descartar cambios
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </article>
  );
}
