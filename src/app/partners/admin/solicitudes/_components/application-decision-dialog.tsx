"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { PartnersRequestErrorAlert } from "@/components/partners/partners-request-error-alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import type { ApplicationDecisionAction } from "@/features/partners/models/application-decision";
import type { PartnerApplication } from "@/features/partners/models/partner-application";
import type { PartnersRequestError } from "@/features/partners/models/partners-request-error";
import {
  type ApplicationDecisionFormValues,
  applicationDecisionSchema,
} from "@/features/partners/schemas/application-decision.schema";

const CONTENT: Record<
  ApplicationDecisionAction,
  { title: string; confirm: string; pending: string; placeholder: string }
> = {
  approve: {
    title: "Aprobar solicitud",
    confirm: "Aprobar",
    pending: "Aprobando...",
    placeholder: "Ej. Validación completada",
  },
  reject: {
    title: "Rechazar solicitud",
    confirm: "Rechazar",
    pending: "Rechazando...",
    placeholder: "Ej. No cumple los requisitos actuales del programa",
  },
};

interface ApplicationDecisionDialogProps {
  application: PartnerApplication | null;
  action: ApplicationDecisionAction;
  isPending: boolean;
  error: PartnersRequestError | null;
  remainingMs: number;
  onConfirm: (reason: string) => void;
  onClose: () => void;
}

export function ApplicationDecisionDialog({
  application,
  action,
  isPending,
  error,
  remainingMs,
  onConfirm,
  onClose,
}: ApplicationDecisionDialogProps) {
  const content = CONTENT[action];
  const isOpen = application !== null;

  const form = useForm<ApplicationDecisionFormValues>({
    resolver: zodResolver(applicationDecisionSchema),
    defaultValues: { reason: "" },
  });

  useEffect(() => {
    if (!isOpen) return;
    form.reset({ reason: "" });
  }, [isOpen, form]);

  function handleSubmit(values: ApplicationDecisionFormValues) {
    if (isPending || remainingMs > 0) return;
    onConfirm(values.reason);
  }

  function handleClose() {
    if (isPending) return;
    onClose();
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{content.title}</DialogTitle>
          <DialogDescription>
            {application &&
              (action === "approve"
                ? `Vamos a vincular la cuenta Powip registrada con ${application.email}. Esa cuenta debe existir y estar activa; no necesita empresa.`
                : `${application.displayName} (${application.email}) no va a poder acceder al portal de partners con esta solicitud.`)}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Motivo</FormLabel>
                  <FormControl>
                    <Textarea placeholder={content.placeholder} disabled={isPending} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {error && (
              <PartnersRequestErrorAlert
                error={error}
                remainingMs={remainingMs}
                fallbackMessage="No pudimos completar la acción. Intentá de nuevo."
              />
            )}

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={handleClose} disabled={isPending}>
                Cancelar
              </Button>
              <Button
                type="submit"
                variant={action === "reject" ? "destructive" : "default"}
                disabled={isPending || remainingMs > 0}
              >
                {isPending ? (
                  <>
                    <Loader2 aria-hidden="true" className="mr-2 h-4 w-4 animate-spin" />
                    {content.pending}
                  </>
                ) : (
                  content.confirm
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
