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
    <FormItem>
      <div className="flex items-center justify-between gap-2">
        <FormLabel>{label}</FormLabel>
        <span className="text-xs text-muted-foreground tabular-nums">
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
          className="min-h-20 resize-y"
        />
      </FormControl>
      <div className="flex flex-wrap gap-1.5">
        {AUTO_REPLY_VARIABLES.map((variable) => (
          <Button
            key={variable.key}
            type="button"
            variant="outline"
            size="sm"
            className="h-7 rounded-full font-mono text-xs"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => insertVariable(variable.key)}
          >
            {toVariableToken(variable.key)}
            <span className="sr-only">{`, insertar ${variable.label} en ${label}`}</span>
          </Button>
        ))}
      </div>
      <FormDescription>{description}</FormDescription>
      <FormMessage />
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
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-6">
          {settings === null && (
            <p className="flex items-start gap-2 rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
              <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              Valores sugeridos para una configuración nueva. No es una configuración guardada.
            </p>
          )}
          <FormField
            control={form.control}
            name="enabled"
            render={({ field }) => (
              <FormItem className="flex items-center justify-between gap-3 space-y-0 rounded-lg border p-3">
                <FormLabel htmlFor={switchId} className="font-medium">
                  Responder automáticamente cuando el cliente escribe
                </FormLabel>
                <FormControl>
                  <Switch
                    id={switchId}
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
          <p className="text-xs text-muted-foreground">
            Solo puedes usar {"{{cliente}}"} y {"{{link_rastreo}}"}. Se envía una sola vez por
            ventana de 24 h en cada conversación. El servicio de POWIP decide cuándo enviarla y qué
            texto usar según el horario; esta pantalla no envía nada.
          </p>
          <div className="space-y-2">
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
            <p className="text-center text-xs text-muted-foreground">
              Muestra con datos de ejemplo («Lucía», «powip.lat/r/EJEMPLO»). No es un mensaje real.
            </p>
          </div>
        </div>
        <div className="shrink-0 space-y-2 border-t px-4 py-3 sm:px-6">
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={onRequestClose}>
              Cancelar
            </Button>
            <BlockedActionButton
              type={blocked ? "button" : "submit"}
              blocked={blocked}
              blockedReasonId={AUTO_REPLY_BLOCKED_ID}
            >
              Guardar
            </BlockedActionButton>
          </div>
          {blocked && (
            <p id={AUTO_REPLY_BLOCKED_ID} className="text-xs text-muted-foreground">
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
          className="flex max-h-[calc(100dvh-2rem)] w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-xl"
        >
          <DialogHeader className="flex-row items-start justify-between gap-3 border-b px-4 py-3 text-left sm:px-6">
            <div className="min-w-0 space-y-1">
              <DialogTitle>Respuesta automática</DialogTitle>
              <DialogDescription>
                Mensaje que recibe el comprador cuando escribe al número de la tienda.
              </DialogDescription>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              aria-label="Cerrar ventana"
              onClick={requestClose}
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </Button>
          </DialogHeader>
          {formSettings === undefined ? (
            <div className="px-4 py-4 sm:px-6">
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
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Descartar los cambios de la respuesta automática?</AlertDialogTitle>
            <AlertDialogDescription>Los cambios no guardados se perderán.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Seguir editando</AlertDialogCancel>
            <AlertDialogAction onClick={onClose}>Descartar cambios</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
