"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Info, X } from "lucide-react";
import { type MutableRefObject, useEffect, useId, useRef, useState } from "react";
import { type ControllerRenderProps, useForm, useWatch } from "react-hook-form";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { BlockedActionButton } from "@/components/whatsapp/BlockedActionButton";
import {
  waButton,
  waDialogBody,
  waDialogContent,
  waDialogFooter,
  waDialogHeader,
  waDialogTitle,
  waField,
  waHint,
  waLabel,
  waSwitch,
  waTextarea,
} from "@/components/whatsapp/ui/wa-classes";
import { WhatsAppPhonePreview } from "@/components/whatsapp/WhatsAppPhonePreview";
import { WhatsAppResourceState } from "@/components/whatsapp/WhatsAppResourceState";
import {
  AUTO_REPLY_VARIABLES,
  CONVERSATION_LIMITS,
} from "@/features/whatsapp/constants/whatsapp-conversation-catalog";
import type { WhatsAppAutoReplySettings } from "@/features/whatsapp/models/conversation.model";
import type { WhatsAppResourceState as ResourceState } from "@/features/whatsapp/models/resource-state.model";
import {
  type AutoReplyValues,
  autoReplySchema,
  toAutoReplyValues,
} from "@/features/whatsapp/schemas/auto-reply.schema";
import {
  insertTextAtSelection,
  toVariableToken,
} from "@/features/whatsapp/utils/template-variables.util";
import { cn } from "@/lib/utils";
import { TemplateSegmentedChoice } from "../plantillas/TemplateSegmentedChoice";

const AUTO_REPLY_BLOCKED_ID = "auto-reply-blocked";

const SAMPLE_VALUES = Object.fromEntries(
  AUTO_REPLY_VARIABLES.map((variable) => [variable.key, variable.sample]),
);

const PREVIEW_OPTIONS = [
  { value: "inHoursText" as const, label: "En horario" },
  { value: "outOfHoursText" as const, label: "Fuera de horario" },
];

type TextFieldName = "inHoursText" | "outOfHoursText";

interface AutoReplyDialogProps {
  settings: ResourceState<WhatsAppAutoReplySettings | null>;
  businessName: string;
  canPersist: boolean;
  onRetry?: () => void;
  onClose: () => void;
  onSave?: (values: AutoReplyValues) => void;
}

function VariableTextField({
  field,
  label,
  description,
}: {
  field: ControllerRenderProps<AutoReplyValues, TextFieldName>;
  label: string;
  description: string;
}) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const insertVariable = (key: string) => {
    const element = textareaRef.current;
    const result = insertTextAtSelection(
      field.value,
      element?.selectionStart,
      element?.selectionEnd,
      toVariableToken(key),
    );
    field.onChange(result.value);
    requestAnimationFrame(() => {
      if (!element) return;
      element.focus();
      element.setSelectionRange(result.selectionStart, result.selectionEnd);
    });
  };

  return (
    <FormItem className={waField}>
      <div className="flex items-center justify-between gap-2">
        <FormLabel className={waLabel}>{label}</FormLabel>
        <span className="wa-num text-xs text-wa-muted">
          {field.value.length}/{CONVERSATION_LIMITS.autoReplyMaxLength}
        </span>
      </div>
      <FormControl>
        <Textarea
          {...field}
          ref={(element) => {
            textareaRef.current = element;
            field.ref(element);
          }}
          rows={3}
          className={cn(waTextarea, "min-h-20")}
        />
      </FormControl>
      <div className="flex flex-wrap gap-1.5">
        {AUTO_REPLY_VARIABLES.map((variable) => (
          <Button
            key={variable.key}
            type="button"
            className="h-auto rounded-[7px] border border-wa-border bg-wa-surface-2 px-[9px] py-1 font-wa-mono text-xs font-semibold text-wa-teal shadow-none hover:border-wa-teal hover:bg-wa-teal-soft hover:text-wa-teal focus-visible:border-wa-border focus-visible:ring-0 focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-wa-primary"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => insertVariable(variable.key)}
          >
            {toVariableToken(variable.key)}
            <span className="sr-only">{`, insertar ${variable.label} en ${label}`}</span>
          </Button>
        ))}
      </div>
      <FormDescription className={waHint}>{description}</FormDescription>
      <FormMessage className="text-xs text-wa-red" />
    </FormItem>
  );
}

function hasAutoReplyChanges(
  values: AutoReplyValues,
  defaults: Partial<AutoReplyValues> | undefined,
): boolean {
  return (
    values.enabled !== defaults?.enabled ||
    values.inHoursText !== defaults?.inHoursText ||
    values.outOfHoursText !== defaults?.outOfHoursText
  );
}

function AutoReplyForm({
  settings,
  businessName,
  canPersist,
  onRequestClose,
  changeCheckRef,
  onSave,
}: {
  settings: WhatsAppAutoReplySettings | null;
  businessName: string;
  canPersist: boolean;
  onRequestClose: () => void;
  changeCheckRef: MutableRefObject<(() => boolean) | null>;
  onSave?: (values: AutoReplyValues) => void;
}) {
  const switchId = useId();
  const form = useForm<AutoReplyValues>({
    resolver: zodResolver(autoReplySchema),
    defaultValues: toAutoReplyValues(settings),
    mode: "onChange",
  });
  const values = useWatch({ control: form.control }) as AutoReplyValues;
  const [previewField, setPreviewField] = useState<TextFieldName>("inHoursText");
  const blocked = !canPersist || !onSave;

  useEffect(() => {
    changeCheckRef.current = () =>
      hasAutoReplyChanges(form.getValues(), form.formState.defaultValues);
    return () => {
      changeCheckRef.current = null;
    };
  }, [changeCheckRef, form]);

  useEffect(() => {
    if (!hasAutoReplyChanges(form.getValues(), form.formState.defaultValues)) {
      form.reset(toAutoReplyValues(settings));
    }
  }, [settings, form]);

  return (
    <Form {...form}>
      <form
        noValidate
        className="flex min-h-0 flex-1 flex-col"
        onSubmit={form.handleSubmit((submitted) => {
          if (!blocked) onSave?.(submitted);
        })}
      >
        <div className={cn(waDialogBody, "flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto")}>
          {settings === null && (
            <p className="m-0 flex items-start gap-2 rounded-xl border border-dashed border-wa-border-strong bg-wa-surface-2 px-3 py-2.5 text-xs text-wa-muted">
              <Info className="mt-px size-3.5 shrink-0" aria-hidden="true" />
              Valores sugeridos para una configuración nueva. No es una configuración guardada.
            </p>
          )}
          <FormField
            control={form.control}
            name="enabled"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between gap-3 space-y-0">
                <FormLabel htmlFor={switchId} className="text-sm font-medium text-wa-fg">
                  Responder automáticamente cuando el cliente escribe
                </FormLabel>
                <FormControl>
                  <Switch
                    id={switchId}
                    className={waSwitch}
                    checked={field.value}
                    onCheckedChange={(checked) => field.onChange(checked)}
                  />
                </FormControl>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="inHoursText"
            render={({ field }) => (
              <VariableTextField
                field={field}
                label="En horario de atención"
                description="Se usa cuando las asesoras están atendiendo."
              />
            )}
          />
          <FormField
            control={form.control}
            name="outOfHoursText"
            render={({ field }) => (
              <VariableTextField
                field={field}
                label="Fuera de horario"
                description="Se usa fuera del horario de atención de las asesoras."
              />
            )}
          />
          <p className="m-0 text-xs text-wa-muted">
            Solo puedes usar {"{{cliente}}"} y {"{{link_rastreo}}"}. Se envía una sola vez por
            ventana de 24 h en cada conversación. El servicio de POWIP decide cuándo enviarla y qué
            texto usar según el horario; esta pantalla no envía nada.
          </p>
          <div className="flex flex-col gap-2.5">
            <TemplateSegmentedChoice
              legend="Vista previa"
              name="auto-reply-preview"
              value={previewField}
              options={PREVIEW_OPTIONS}
              onValueChange={setPreviewField}
            />
            <WhatsAppPhonePreview
              businessName={businessName}
              body={values[previewField] ?? ""}
              values={SAMPLE_VALUES}
              emptyBodyLabel="Escribe el mensaje…"
            />
            <p className="m-0 text-center text-xs text-wa-muted">
              Muestra con datos de ejemplo («Lucía», «powip.lat/r/EJEMPLO»). No es un mensaje real.
            </p>
          </div>
        </div>
        <div className={cn(waDialogFooter, "static flex-col items-stretch gap-2.5")}>
          <div className="flex flex-wrap justify-end gap-2.5">
            <Button type="button" className={waButton()} onClick={onRequestClose}>
              Cancelar
            </Button>
            <BlockedActionButton
              className={waButton({ variant: "primary" })}
              type={blocked ? "button" : "submit"}
              blocked={blocked}
              blockedReasonId={AUTO_REPLY_BLOCKED_ID}
            >
              Guardar
            </BlockedActionButton>
          </div>
          {blocked && (
            <p id={AUTO_REPLY_BLOCKED_ID} className="m-0 text-xs text-wa-muted sm:text-right">
              Pendiente de integración: todavía no se puede guardar la respuesta automática. No se
              guardó nada.
            </p>
          )}
        </div>
      </form>
    </Form>
  );
}

export function AutoReplyDialog({
  settings,
  businessName,
  canPersist,
  onRetry,
  onClose,
  onSave,
}: AutoReplyDialogProps) {
  const changeCheckRef = useRef<(() => boolean) | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const requestClose = () => {
    if (changeCheckRef.current?.()) {
      setConfirmOpen(true);
      return;
    }
    onClose();
  };

  const formSettings =
    settings.kind === "ready"
      ? settings.data
      : settings.kind === "pending-integration"
        ? null
        : undefined;

  return (
    <>
      <Dialog open onOpenChange={(open) => !open && requestClose()}>
        <DialogContent
          showCloseButton={false}
          className={cn(
            waDialogContent,
            "flex max-h-[calc(100dvh-2rem)] w-full flex-col sm:max-w-[540px]",
          )}
        >
          <DialogHeader className={waDialogHeader}>
            <div className="min-w-0">
              <DialogTitle className={waDialogTitle}>Respuesta automática</DialogTitle>
              <DialogDescription className="sr-only">
                Mensaje que recibe el comprador cuando escribe al número de la tienda.
              </DialogDescription>
            </div>
            <Button
              type="button"
              className={cn(waButton({ variant: "ghost", size: "icon" }), "-my-1.5 -mr-2")}
              aria-label="Cerrar ventana"
              onClick={requestClose}
            >
              <X aria-hidden="true" />
            </Button>
          </DialogHeader>
          {formSettings === undefined ? (
            <div className={waDialogBody}>
              <WhatsAppResourceState
                state={settings}
                pendingTitle=""
                loadingLabel="Cargando la respuesta automática"
                errorTitle="No se pudo cargar la respuesta automática"
                onRetry={onRetry}
              >
                {() => null}
              </WhatsAppResourceState>
            </div>
          ) : (
            <AutoReplyForm
              settings={formSettings}
              businessName={businessName}
              canPersist={canPersist}
              onRequestClose={requestClose}
              changeCheckRef={changeCheckRef}
              onSave={onSave}
            />
          )}
        </DialogContent>
      </Dialog>
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className={cn(waDialogContent, "sm:max-w-[440px]")}>
          <AlertDialogHeader className={waDialogHeader}>
            <AlertDialogTitle className={waDialogTitle}>
              ¿Descartar los cambios de la respuesta automática?
            </AlertDialogTitle>
          </AlertDialogHeader>
          <div className={waDialogBody}>
            <AlertDialogDescription className="m-0 text-sm text-wa-muted">
              Los cambios no guardados se perderán.
            </AlertDialogDescription>
          </div>
          <AlertDialogFooter className={waDialogFooter}>
            <AlertDialogCancel className={waButton()}>Seguir editando</AlertDialogCancel>
            <AlertDialogAction className={waButton({ variant: "solid-danger" })} onClick={onClose}>
              Descartar cambios
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
