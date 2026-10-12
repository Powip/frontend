"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Send } from "lucide-react";
import { useId, useState } from "react";
import { useForm } from "react-hook-form";
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
import { BlockedActionButton } from "@/components/whatsapp/BlockedActionButton";
import { DoubleTick, SingleTick } from "@/components/whatsapp/MessageStatusTicks";
import { WaCard, WaCardHeader } from "@/components/whatsapp/ui/WaCard";
import { WaInput } from "@/components/whatsapp/ui/WaInput";
import {
  waButton,
  waField,
  waInput,
  waLabel,
  waSelectTrigger,
} from "@/components/whatsapp/ui/wa-classes";
import { WHATSAPP_TEMPLATE_STATUSES } from "@/features/whatsapp/enums/whatsapp.enums";
import type { WhatsAppTestRun } from "@/features/whatsapp/models/connection.model";
import type { WhatsAppResourceState as ResourceState } from "@/features/whatsapp/models/resource-state.model";
import type { WhatsAppTemplate } from "@/features/whatsapp/models/template.model";
import {
  type TestMessageValues,
  testMessageSchema,
} from "@/features/whatsapp/schemas/connection.schema";
import { resolveTestProgress } from "@/features/whatsapp/utils/connection.util";
import { formatLimaTime } from "@/features/whatsapp/utils/lima-time.util";
import { normalizeOptOutPhone } from "@/features/whatsapp/utils/opt-out-phone.util";
import { cn } from "@/lib/utils";
import { type ConnectionMutations, errorMessage } from "./connection-types";

const STEPS = [
  { key: "sent", label: "Enviado", icon: <SingleTick className="text-wa-tick" /> },
  { key: "delivered", label: "Entregado", icon: <DoubleTick className="text-wa-tick" /> },
  { key: "read", label: "Leído", icon: <DoubleTick className="text-wa-tick-read" /> },
] as const;

function StepChips({ run }: { run: WhatsAppTestRun | null }) {
  const times = {
    sent: run?.sentAt ?? null,
    delivered: run?.deliveredAt ?? null,
    read: run?.readAt ?? null,
  };
  return (
    <ol className="m-0 flex list-none flex-wrap gap-2 p-0" aria-label="Estados de la prueba">
      {STEPS.map((step) => {
        const at = times[step.key];
        return (
          <li
            key={step.key}
            className={cn(
              "flex items-center gap-1.5 rounded-[9px] border px-2.5 py-1.5 text-[12.5px] font-medium transition-colors",
              at
                ? "border-solid border-wa-border-strong bg-wa-surface-2 text-wa-fg"
                : "border-dashed border-wa-border-strong text-wa-muted-2",
            )}
          >
            {step.icon}
            {step.label}
            {at ? (
              <span className="wa-num font-normal text-wa-muted"> {formatLimaTime(at)}</span>
            ) : (
              <span className="sr-only"> · sin confirmar</span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

function TestProgressNote({ run, now }: { run: WhatsAppTestRun; now: Date }) {
  const progress = resolveTestProgress(run, now);
  return (
    <div className="space-y-1 text-[13px]" aria-live="polite">
      <p className="m-0 text-wa-muted">
        Prueba a <span className="wa-num text-wa-fg">{run.phone}</span> con{" "}
        <span className="font-wa-mono text-[12.5px] font-semibold text-wa-fg">
          {run.templateName}
        </span>
      </p>
      {progress.kind === "in-progress" && (
        <p className="m-0 text-xs text-wa-muted">
          Esperando que Meta confirme el estado. Los estados se encienden solo cuando llegan.
        </p>
      )}
      {progress.kind === "failed" && (
        <p role="alert" className="m-0 font-medium text-wa-red">
          {progress.message}
        </p>
      )}
      {progress.kind === "read" && <p className="m-0 text-wa-green">La prueba llegó y se leyó.</p>}
      {progress.kind === "delivered-without-read" && (
        <p className="m-0">
          La prueba llegó. «Leído» puede no aparecer si el destinatario desactivó las confirmaciones
          de lectura; la prueba terminó.
        </p>
      )}
    </div>
  );
}

interface TestMessageSectionProps {
  accountId: string | null;
  templates: ResourceState<WhatsAppTemplate[]>;
  storeId: string;
  testRun: WhatsAppTestRun | null;
  now: Date;
  blockedReason: string | null;
  sendTest: ConnectionMutations["sendTest"];
  onTestStarted?: (run: WhatsAppTestRun) => void;
}

export function TestMessageSection({
  accountId,
  templates,
  storeId,
  testRun,
  now,
  blockedReason,
  sendTest,
  onTestStarted,
}: TestMessageSectionProps) {
  const reasonId = useId();
  const [sendError, setSendError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const form = useForm<TestMessageValues>({
    resolver: zodResolver(testMessageSchema),
    defaultValues: { phone: "", templateId: "" },
    mode: "onTouched",
  });
  const approved =
    templates.kind === "ready"
      ? templates.data.filter(
          (template) =>
            template.status === WHATSAPP_TEMPLATE_STATUSES.APPROVED &&
            (template.storeId === null || template.storeId === storeId),
        )
      : [];
  const inProgress = testRun !== null && resolveTestProgress(testRun, now).kind === "in-progress";
  const reason =
    blockedReason ??
    (!accountId ? "Conecta un número para enviar una prueba." : null) ??
    (inProgress ? "Hay una prueba en curso." : null);
  const blocked = !!reason || sending;

  const submit = form.handleSubmit(async (values) => {
    if (blocked || !sendTest || !accountId) return;
    const phone = normalizeOptOutPhone(values.phone);
    if (!phone) return;
    setSending(true);
    setSendError(null);
    try {
      const run = await sendTest({ accountId, phone, templateId: values.templateId });
      onTestStarted?.(run);
    } catch (caught) {
      setSendError(errorMessage(caught, "No se pudo enviar la prueba."));
    } finally {
      setSending(false);
    }
  });

  return (
    <WaCard aria-labelledby="test-message-title">
      <WaCardHeader
        level={3}
        titleId="test-message-title"
        title="Enviar mensaje de prueba"
        description="Comprueba cómo le llega a un cliente y mira cómo cambian los estados reales."
      />
      <Form {...form}>
        <form noValidate className="flex flex-col gap-3.5" onSubmit={submit}>
          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem className={waField}>
                <FormLabel className={waLabel}>Número de WhatsApp</FormLabel>
                <FormControl>
                  <WaInput
                    {...field}
                    inputMode="tel"
                    autoComplete="off"
                    placeholder="987 654 321"
                    className={cn(waInput, "wa-num")}
                  />
                </FormControl>
                <FormMessage className="text-xs text-wa-red" />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="templateId"
            render={({ field }) => (
              <FormItem className={waField}>
                <FormLabel className={waLabel}>Plantilla</FormLabel>
                <Select
                  value={field.value || undefined}
                  disabled={approved.length === 0}
                  onValueChange={(value) => {
                    if (value && value !== field.value) field.onChange(value);
                  }}
                >
                  <FormControl>
                    <SelectTrigger className={waSelectTrigger} onBlur={field.onBlur}>
                      <SelectValue
                        placeholder={
                          templates.kind !== "ready"
                            ? "Plantillas pendientes de integración"
                            : approved.length === 0
                              ? "No hay plantillas aprobadas"
                              : "Elige una plantilla aprobada"
                        }
                      />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {approved.map((template) => (
                      <SelectItem key={template.id} value={template.id}>
                        {template.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage className="text-xs text-wa-red" />
              </FormItem>
            )}
          />
          <BlockedActionButton
            type={blocked ? "button" : "submit"}
            className={waButton({ variant: "whatsapp" })}
            blocked={blocked}
            blockedReasonId={reasonId}
          >
            <Send aria-hidden="true" />
            Enviar prueba
          </BlockedActionButton>
          <StepChips run={testRun} />
          {testRun && <TestProgressNote run={testRun} now={now} />}
          {sendError && (
            <p role="alert" className="m-0 text-[13px] text-wa-red">
              {sendError}
            </p>
          )}
          {reason && (
            <p id={reasonId} className="m-0 text-xs text-wa-muted">
              {reason}
            </p>
          )}
        </form>
      </Form>
    </WaCard>
  );
}
