"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Send, X } from "lucide-react";
import { useMemo, useState } from "react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Form } from "@/components/ui/form";
import {
  WHATSAPP_AB_VARIANTS,
  WHATSAPP_TEMPLATE_HEADER_TYPES,
  WHATSAPP_TEMPLATE_STATUSES,
  type WhatsAppAbVariant,
} from "@/features/whatsapp/enums/whatsapp.enums";
import { toTemplateEditorValues } from "@/features/whatsapp/mappers/to-template-editor-values.mapper";
import type { WhatsAppTemplate } from "@/features/whatsapp/models/template.model";
import { createTemplateEditorDefaultValues } from "@/features/whatsapp/schemas/template-editor.defaults";
import {
  type TemplateEditorValues,
  templateEditorSchema,
} from "@/features/whatsapp/schemas/template-editor.schema";
import {
  findPromotionalTerms,
  shouldWarnAboutPromotionalLanguage,
} from "@/features/whatsapp/utils/promotional-language.util";
import { cn } from "@/lib/utils";
import { TemplateEditorFields } from "./TemplateEditorFields";
import { TemplateEditorPreview } from "./TemplateEditorPreview";
import { TemplatePromotionalWarning } from "./TemplatePromotionalWarning";
import { TemplateStatusNotice } from "./TemplateStatusNotice";

export type TemplateEditorMode =
  | { kind: "new" }
  | { kind: "edit"; template: WhatsAppTemplate }
  | { kind: "duplicate"; template: WhatsAppTemplate };

interface TemplateEditorDialogProps {
  open: boolean;
  mode: TemplateEditorMode;
  businessName: string;
  canManage: boolean;
  canPersist: boolean;
  onClose: () => void;
  onSaveDraft?: (values: TemplateEditorValues) => void;
  onSubmitForReview?: (values: TemplateEditorValues) => void;
}

const PENDING_PERSISTENCE_ID = "template-editor-pending-persistence";

function getTitle(mode: TemplateEditorMode, readOnly: boolean): string {
  if (mode.kind === "new") return "Nueva plantilla";
  if (mode.kind === "duplicate") return "Duplicar plantilla";
  return readOnly ? "Ver plantilla" : "Editar plantilla";
}

export function TemplateEditorDialog({
  open,
  mode,
  businessName,
  canManage,
  canPersist,
  onClose,
  onSaveDraft,
  onSubmitForReview,
}: TemplateEditorDialogProps) {
  const sourceTemplate = mode.kind === "new" ? null : mode.template;
  const inReview =
    mode.kind === "edit" && mode.template.status === WHATSAPP_TEMPLATE_STATUSES.PENDING;
  const readOnly = !canManage || inReview;
  const resubmits =
    mode.kind === "edit" &&
    (mode.template.status === WHATSAPP_TEMPLATE_STATUSES.APPROVED ||
      mode.template.status === WHATSAPP_TEMPLATE_STATUSES.PAUSED);

  const defaultValues = useMemo(
    () =>
      mode.kind === "new"
        ? createTemplateEditorDefaultValues()
        : toTemplateEditorValues(mode.template, mode.kind),
    [mode],
  );

  const form = useForm<TemplateEditorValues>({
    resolver: zodResolver(templateEditorSchema),
    defaultValues,
    mode: "onTouched",
  });
  const watched = useWatch({ control: form.control }) as TemplateEditorValues;
  const [previewVariant, setPreviewVariant] = useState<WhatsAppAbVariant>(WHATSAPP_AB_VARIANTS.A);
  const [confirmDiscardOpen, setConfirmDiscardOpen] = useState(false);

  const promotionalTexts = [
    watched.body,
    watched.abEnabled ? watched.bodyB : null,
    watched.headerType === WHATSAPP_TEMPLATE_HEADER_TYPES.TEXT ? watched.headerText : null,
  ];
  const promotionalTerms = shouldWarnAboutPromotionalLanguage(watched.category, promotionalTexts)
    ? [...new Set(promotionalTexts.flatMap((text) => (text ? findPromotionalTerms(text) : [])))]
    : [];

  const { isDirty } = form.formState;

  const requestClose = () => {
    if (!readOnly && isDirty) {
      setConfirmDiscardOpen(true);
      return;
    }
    onClose();
  };

  const saveEnabled = canPersist && !!onSaveDraft;
  const submitEnabled = canPersist && !!onSubmitForReview;

  const runIfEnabled = (enabled: boolean, handler?: (values: TemplateEditorValues) => void) => {
    if (!enabled || !handler) return;
    void form.handleSubmit(handler)();
  };

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) requestClose();
        }}
      >
        <DialogContent
          showCloseButton={false}
          className="flex max-h-[calc(100dvh-2rem)] w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl"
        >
          <DialogHeader className="flex-row items-start justify-between gap-3 border-b px-4 py-3 text-left sm:px-6 sm:py-4">
            <div className="min-w-0 space-y-1">
              <DialogTitle>{getTitle(mode, readOnly)}</DialogTitle>
              <DialogDescription>
                Meta revisa cada plantilla antes de que puedas usarla. Normalmente tarda de unos
                minutos a 24 horas.
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

          <Form {...form}>
            <form
              noValidate
              className="flex min-h-0 flex-1 flex-col"
              onSubmit={(event) => event.preventDefault()}
            >
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6">
                <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.9fr)]">
                  <div className="min-w-0 space-y-5">
                    {sourceTemplate && (
                      <TemplateStatusNotice
                        template={sourceTemplate}
                        isDuplicate={mode.kind === "duplicate"}
                        businessName={businessName}
                      />
                    )}
                    {!canManage && (
                      <p className="rounded-lg border bg-muted/40 p-3 text-sm">
                        Solo un administrador puede crear o editar plantillas.
                      </p>
                    )}
                    <TemplateEditorFields readOnly={readOnly} />
                    {promotionalTerms.length > 0 && (
                      <TemplatePromotionalWarning terms={promotionalTerms} />
                    )}
                  </div>
                  <div className="min-w-0 lg:sticky lg:top-0 lg:self-start">
                    <TemplateEditorPreview
                      values={watched}
                      businessName={businessName}
                      variant={previewVariant}
                      onVariantChange={setPreviewVariant}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-3 border-t px-4 py-3 sm:px-6">
                {!readOnly && !canPersist && (
                  <p id={PENDING_PERSISTENCE_ID} className="text-sm text-muted-foreground">
                    Guardar y enviar a revisión de Meta estarán disponibles cuando se conecte el
                    servicio de plantillas. Puedes completar y revisar el mensaje, pero todavía no
                    se guarda nada.
                  </p>
                )}
                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <Button type="button" variant="outline" onClick={requestClose}>
                    {readOnly ? "Cerrar" : "Cancelar"}
                  </Button>
                  {!readOnly && (
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        aria-disabled={!saveEnabled}
                        aria-describedby={saveEnabled ? undefined : PENDING_PERSISTENCE_ID}
                        className={cn(!saveEnabled && "cursor-not-allowed opacity-50")}
                        onClick={() => runIfEnabled(saveEnabled, onSaveDraft)}
                      >
                        Guardar borrador
                      </Button>
                      <Button
                        type="button"
                        aria-disabled={!submitEnabled}
                        aria-describedby={submitEnabled ? undefined : PENDING_PERSISTENCE_ID}
                        className={cn(!submitEnabled && "cursor-not-allowed opacity-50")}
                        onClick={() => runIfEnabled(submitEnabled, onSubmitForReview)}
                      >
                        <Send className="h-4 w-4" aria-hidden="true" />
                        {resubmits ? "Guardar y reenviar a revisión" : "Enviar a revisión de Meta"}
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDiscardOpen} onOpenChange={setConfirmDiscardOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Descartar los cambios?</AlertDialogTitle>
            <AlertDialogDescription>
              Los cambios de esta plantilla no se guardaron y se perderán al cerrar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Seguir editando</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmDiscardOpen(false);
                onClose();
              }}
            >
              Descartar cambios
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
