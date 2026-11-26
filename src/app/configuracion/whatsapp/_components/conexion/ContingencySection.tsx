"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ShieldAlert, Smartphone } from "lucide-react";
import { type ReactNode, useEffect, useId } from "react";
import { useForm, useWatch } from "react-hook-form";
import { Checkbox } from "@/components/ui/checkbox";
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
import { WaCallout } from "@/components/whatsapp/ui/WaCallout";
import { WaCard, WaCardHeader } from "@/components/whatsapp/ui/WaCard";
import { WaInput } from "@/components/whatsapp/ui/WaInput";
import { WaPill } from "@/components/whatsapp/ui/WaPill";
import {
  waCheckbox,
  waField,
  waInput,
  waLabel,
  waSelectTrigger,
  waSwitch,
} from "@/components/whatsapp/ui/wa-classes";
import { WhatsAppResourceState } from "@/components/whatsapp/WhatsAppResourceState";
import type { WhatsAppContingencySettings } from "@/features/whatsapp/models/connection.model";
import type { WhatsAppAgentOption } from "@/features/whatsapp/models/conversation.model";
import type { WhatsAppResourceState as ResourceState } from "@/features/whatsapp/models/resource-state.model";
import {
  type ContingencyValues,
  contingencySchema,
  toContingencyValues,
} from "@/features/whatsapp/schemas/connection.schema";
import { formatLimaDateTime } from "@/features/whatsapp/utils/lima-time.util";
import { cn } from "@/lib/utils";
import { SettingsDraftFooter, SuggestedValuesNote } from "../ajustes/SettingsDraftFooter";
import { resolveSettingsSource, type SettingsSource } from "../ajustes/settings-types";

const SENDER_ALL = "all_agents";

const TITLE = "Número de contingencia";
const DESCRIPTION =
  "Si el número principal deja de enviar, los avisos pasan a este número para que ningún cliente se quede sin su rastreo.";

function TriggerCheckbox({
  checked,
  disabled,
  onChange,
}: {
  checked: boolean;
  disabled: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <FormControl>
      <Checkbox
        className={waCheckbox}
        checked={checked}
        disabled={disabled}
        onCheckedChange={(value) => onChange(value === true)}
      />
    </FormControl>
  );
}

function ContingencyStatus({ saved }: { saved: WhatsAppContingencySettings | null }) {
  if (saved?.active === true) {
    return (
      <WaCallout tone="amber" icon={ShieldAlert} className="mb-4">
        <span className="font-medium">
          Contingencia activa
          {saved.activatedAt ? ` desde ${formatLimaDateTime(saved.activatedAt)}` : ""}
        </span>
        {saved.reason ? ` · ${saved.reason}` : ""}
      </WaCallout>
    );
  }
  if (saved && saved.active === null) {
    return (
      <p className="-mt-2 mb-4 text-xs text-wa-muted">
        POWIP no informó si la contingencia está activa ahora.
      </p>
    );
  }
  return null;
}

function BackupNumber({ settings }: { settings: WhatsAppContingencySettings | null }) {
  const backup = settings?.backupAccount ?? null;
  return (
    <div className="flex flex-wrap items-center gap-3.5">
      <span
        className={cn(
          "grid size-11 shrink-0 place-items-center rounded-full",
          backup
            ? "bg-wa-whatsapp-soft text-wa-whatsapp-dark"
            : "border border-dashed border-wa-border-strong bg-wa-surface-2 text-wa-muted-2",
        )}
      >
        <Smartphone className="size-[18px]" aria-hidden="true" />
      </span>
      <div className="min-w-[160px] flex-1">
        <p className="wa-num m-0 font-semibold">
          {backup ? (backup.phone ?? "Número sin dato") : "Número de respaldo"}
        </p>
        <p className="m-0 text-xs text-wa-muted">
          {backup
            ? (backup.verifiedName ?? "App WhatsApp Business")
            : "Sin número de respaldo informado. Cómo se registra un número solo app todavía no está definido."}
        </p>
      </div>
      <WaPill tone="warn">Envío asistido</WaPill>
    </div>
  );
}

function RecoveryNote() {
  return (
    <WaCallout>
      Cuando el número principal se recupera, los avisos vuelven a salir solos y POWIP avisa al
      administrador.
    </WaCallout>
  );
}

function ContingencyCard({
  header,
  status,
  left,
  aside,
}: {
  header: ReactNode;
  status: ReactNode;
  left: ReactNode;
  aside: ReactNode;
}) {
  return (
    <WaCard aria-labelledby="contingency-title">
      {header}
      {status}
      <div className="grid grid-cols-1 gap-5 min-[900px]:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-3.5">{left}</div>
        <div className="min-w-0">{aside}</div>
      </div>
    </WaCard>
  );
}

function ContingencyForm({
  source,
  settings,
  agents,
  canEdit,
  blockedReason,
  onSave,
  aside,
}: {
  source: SettingsSource<ContingencyValues>;
  settings: WhatsAppContingencySettings | null;
  agents: ResourceState<WhatsAppAgentOption[]>;
  canEdit: boolean;
  blockedReason: string | null;
  onSave?: (values: ContingencyValues) => Promise<void>;
  aside: ReactNode;
}) {
  const enabledId = useId();
  const form = useForm<ContingencyValues>({
    resolver: zodResolver(contingencySchema),
    defaultValues: source.values,
    mode: "onChange",
  });
  const values = useWatch({ control: form.control }) as ContingencyValues;
  const sourceKey = JSON.stringify(source.values);
  const isDirty = JSON.stringify(values) !== JSON.stringify(form.formState.defaultValues);
  const agentOptions = agents.kind === "ready" ? agents.data : [];

  useEffect(() => {
    if (JSON.stringify(form.getValues()) === JSON.stringify(form.formState.defaultValues)) {
      form.reset(JSON.parse(sourceKey) as ContingencyValues);
    }
  }, [sourceKey, form]);

  const revalidateTriggers = () => {
    void form.trigger(["manualOnly", "failuresCount", "failuresMinutes"]);
  };
  const senderValue = values.senderType === "user" ? values.senderUserId || undefined : SENDER_ALL;

  const save = async () => {
    const valid = await form.trigger();
    if (!valid || !onSave) throw new Error("Revisa los campos marcados.");
    await onSave(form.getValues());
  };

  const enabledSwitch = (
    <FormField
      control={form.control}
      name="enabled"
      render={({ field }) => (
        <FormItem className="flex flex-row items-center gap-2 space-y-0">
          <FormControl>
            <Switch
              id={enabledId}
              className={waSwitch}
              checked={field.value}
              disabled={!canEdit}
              onCheckedChange={(checked) => {
                field.onChange(checked);
                void form.trigger("manualOnly");
              }}
            />
          </FormControl>
          <FormLabel htmlFor={enabledId} className="text-xs font-normal text-wa-fg">
            Contingencia activa
          </FormLabel>
        </FormItem>
      )}
    />
  );

  const checkboxRow = "flex flex-row items-center gap-2 space-y-0";
  const checkboxLabel = "text-[13px] font-normal leading-snug text-wa-fg";

  return (
    <Form {...form}>
      <ContingencyCard
        header={
          <WaCardHeader
            titleId="contingency-title"
            title={TITLE}
            description={DESCRIPTION}
            actions={enabledSwitch}
          />
        }
        status={<ContingencyStatus saved={settings} />}
        left={
          <form
            noValidate
            className="flex min-w-0 flex-col gap-3.5"
            onSubmit={(event) => event.preventDefault()}
          >
            {source.note && <SuggestedValuesNote reason={source.note} />}
            <BackupNumber settings={settings} />
            <fieldset className={cn(waField, "m-0 border-0 p-0")}>
              <legend className={cn(waLabel, "mb-1.5")}>Pasar a contingencia cuando</legend>
              <div className="flex flex-col gap-2">
                <FormField
                  control={form.control}
                  name="onRestrictedOrRed"
                  render={(props) => (
                    <FormItem className={checkboxRow}>
                      <TriggerCheckbox
                        checked={props.field.value}
                        disabled={!canEdit}
                        onChange={(checked) => {
                          props.field.onChange(checked);
                          revalidateTriggers();
                        }}
                      />
                      <FormLabel className={checkboxLabel}>
                        Meta restringe el número principal o su calidad baja a roja
                      </FormLabel>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="onDailyLimit"
                  render={(props) => (
                    <FormItem className={checkboxRow}>
                      <TriggerCheckbox
                        checked={props.field.value}
                        disabled={!canEdit}
                        onChange={(checked) => {
                          props.field.onChange(checked);
                          revalidateTriggers();
                        }}
                      />
                      <FormLabel className={checkboxLabel}>
                        Se alcanza el límite diario de Meta
                      </FormLabel>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="failuresEnabled"
                  render={(props) => (
                    <FormItem className={checkboxRow}>
                      <TriggerCheckbox
                        checked={props.field.value}
                        disabled={!canEdit}
                        onChange={(checked) => {
                          props.field.onChange(checked);
                          revalidateTriggers();
                        }}
                      />
                      <FormLabel className={checkboxLabel}>Fallan varios envíos seguidos</FormLabel>
                    </FormItem>
                  )}
                />
                {values.failuresEnabled && (
                  <div className="flex flex-wrap items-start gap-x-2 gap-y-1 pl-6 text-[13px]">
                    <FormField
                      control={form.control}
                      name="failuresCount"
                      render={({ field }) => (
                        <FormItem className="flex flex-col gap-1 space-y-0">
                          <span className="flex items-center gap-2">
                            <FormLabel className="sr-only">Envíos fallidos seguidos</FormLabel>
                            <FormControl>
                              <WaInput
                                {...field}
                                inputMode="numeric"
                                className={cn(waInput, "wa-num w-16 px-2 py-1 text-center")}
                                disabled={!canEdit}
                              />
                            </FormControl>
                            <span aria-hidden="true" className="whitespace-nowrap">
                              envíos seguidos en
                            </span>
                          </span>
                          <FormMessage className="text-xs text-wa-red" />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="failuresMinutes"
                      render={({ field }) => (
                        <FormItem className="flex flex-col gap-1 space-y-0">
                          <span className="flex items-center gap-2">
                            <FormLabel className="sr-only">En minutos</FormLabel>
                            <FormControl>
                              <WaInput
                                {...field}
                                inputMode="numeric"
                                className={cn(waInput, "wa-num w-16 px-2 py-1 text-center")}
                                disabled={!canEdit}
                              />
                            </FormControl>
                            <span aria-hidden="true" className="whitespace-nowrap">
                              minutos
                            </span>
                          </span>
                          <FormMessage className="text-xs text-wa-red" />
                        </FormItem>
                      )}
                    />
                  </div>
                )}
                <FormField
                  control={form.control}
                  name="manualOnly"
                  render={(props) => (
                    <FormItem className="flex flex-col gap-1 space-y-0">
                      <div className="flex items-center gap-2">
                        <TriggerCheckbox
                          checked={props.field.value}
                          disabled={!canEdit}
                          onChange={(checked) => {
                            props.field.onChange(checked);
                            revalidateTriggers();
                          }}
                        />
                        <FormLabel className={checkboxLabel}>
                          Solo cuando yo la active (manual)
                        </FormLabel>
                      </div>
                      <FormMessage className="text-xs text-wa-red" />
                    </FormItem>
                  )}
                />
              </div>
            </fieldset>
            <FormField
              control={form.control}
              name="senderType"
              render={({ field }) => (
                <FormItem className={waField}>
                  <FormLabel className={waLabel}>Quién envía los mensajes asistidos</FormLabel>
                  <Select
                    value={senderValue}
                    disabled={!canEdit}
                    onValueChange={(value) => {
                      if (!value) return;
                      if (value === SENDER_ALL) {
                        field.onChange("all_agents");
                        form.setValue("senderUserId", "", { shouldValidate: true });
                      } else {
                        field.onChange("user");
                        form.setValue("senderUserId", value, { shouldValidate: true });
                      }
                    }}
                  >
                    <FormControl>
                      <SelectTrigger className={waSelectTrigger}>
                        <SelectValue placeholder="Elige una persona" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={SENDER_ALL}>Todas las asesoras de la tienda</SelectItem>
                      {agentOptions.map((agent) => (
                        <SelectItem key={agent.id} value={agent.id}>
                          {agent.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {agents.kind !== "ready" && (
                    <p className="m-0 text-xs text-wa-muted">
                      La lista de asesoras se carga cuando se puede guardar la contingencia.
                    </p>
                  )}
                  <FormMessage className="text-xs text-wa-red" />
                </FormItem>
              )}
            />
            <RecoveryNote />
            <SettingsDraftFooter
              isDirty={isDirty}
              blockedReason={blockedReason}
              saveLabel="Guardar contingencia"
              discardTitle="¿Descartar los cambios en la contingencia?"
              onDiscard={() => form.reset(form.formState.defaultValues as ContingencyValues)}
              onSave={onSave ? save : undefined}
            />
          </form>
        }
        aside={aside}
      />
    </Form>
  );
}

interface ContingencySectionProps {
  settings: ResourceState<WhatsAppContingencySettings | null>;
  agents: ResourceState<WhatsAppAgentOption[]>;
  storeKey: string;
  canEdit: boolean;
  blockedReason: string | null;
  onSave?: (values: ContingencyValues) => Promise<void>;
  onRetry?: () => void;
  aside?: ReactNode;
}

export function ContingencySection({
  settings,
  agents,
  storeKey,
  canEdit,
  blockedReason,
  onSave,
  onRetry,
  aside,
}: ContingencySectionProps) {
  const source = resolveSettingsSource(settings, toContingencyValues);
  const saved = settings.kind === "ready" ? settings.data : null;
  if (source) {
    return (
      <ContingencyForm
        key={storeKey}
        source={source}
        settings={saved}
        agents={agents}
        canEdit={canEdit}
        blockedReason={blockedReason}
        onSave={onSave}
        aside={aside}
      />
    );
  }
  return (
    <ContingencyCard
      header={<WaCardHeader titleId="contingency-title" title={TITLE} description={DESCRIPTION} />}
      status={null}
      left={
        <WhatsAppResourceState
          state={settings}
          pendingTitle=""
          loadingLabel="Cargando la contingencia"
          errorTitle="No se pudo cargar la contingencia"
          onRetry={onRetry}
        >
          {() => null}
        </WhatsAppResourceState>
      }
      aside={aside}
    />
  );
}
