"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useId, useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { BlockedActionButton } from "@/components/whatsapp/BlockedActionButton";
import { WaDialogClose } from "@/components/whatsapp/ui/WaDialogClose";
import {
  waButton,
  waCheckbox,
  waDialogBody,
  waDialogContent,
  waDialogFooter,
  waDialogHeader,
  waDialogTitle,
  waField,
  waHint,
  waLabel,
  waTextarea,
} from "@/components/whatsapp/ui/wa-classes";
import type { WhatsAppOptOut } from "@/features/whatsapp/models/settings-tab.model";
import {
  type ReactivateOptOutValues,
  reactivateOptOutSchema,
} from "@/features/whatsapp/schemas/settings-tab.schema";
import { cn } from "@/lib/utils";
import type { SettingsMutations } from "./settings-types";

interface ReactivateOptOutDialogProps {
  optOut: WhatsAppOptOut;
  blockedReason: string | null;
  reactivate: SettingsMutations["reactivateOptOut"];
  onClose: () => void;
}

export function ReactivateOptOutDialog({
  optOut,
  blockedReason,
  reactivate,
  onClose,
}: ReactivateOptOutDialogProps) {
  const reasonId = useId();
  const [status, setStatus] = useState<
    { kind: "idle" } | { kind: "pending" } | { kind: "error"; message: string }
  >({ kind: "idle" });
  const form = useForm<ReactivateOptOutValues>({
    resolver: zodResolver(reactivateOptOutSchema),
    defaultValues: { customerRequested: false, note: "" },
    mode: "onTouched",
  });
  const blocked = !!blockedReason || !reactivate || status.kind === "pending";
  const who = optOut.customerName ? `${optOut.customerName} (${optOut.phone})` : optOut.phone;

  const submit = form.handleSubmit(async (values) => {
    if (blocked || !reactivate) return;
    setStatus({ kind: "pending" });
    try {
      await reactivate({ optOutId: optOut.id, note: values.note.trim() });
      onClose();
    } catch (caught) {
      setStatus({
        kind: "error",
        message:
          caught instanceof Error && caught.message ? caught.message : "No se pudo reactivar.",
      });
    }
  });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        showCloseButton={false}
        className={cn(waDialogContent, "flex max-h-[calc(100dvh-2rem)] flex-col sm:max-w-[480px]")}
      >
        <DialogHeader className={waDialogHeader}>
          <DialogTitle className={waDialogTitle}>Reactivar avisos</DialogTitle>
          <WaDialogClose />
        </DialogHeader>
        <Form {...form}>
          <form
            noValidate
            className={cn(waDialogBody, "flex min-h-0 flex-col gap-3.5 overflow-y-auto")}
            onSubmit={submit}
          >
            <DialogDescription className="m-0 text-sm text-wa-muted">
              {`${who} volverá a recibir avisos de ${optOut.storeName ?? "la tienda"}. Solo se reactiva si el comprador lo pidió; quedará registrado quién lo hizo, cuándo y por qué.`}
            </DialogDescription>
            <FormField
              control={form.control}
              name="customerRequested"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start gap-2 space-y-0">
                  <FormControl>
                    <Checkbox
                      className={cn(waCheckbox, "mt-0.5")}
                      checked={field.value}
                      onCheckedChange={(checked) => field.onChange(checked === true)}
                    />
                  </FormControl>
                  <div className="space-y-1">
                    <FormLabel className="text-[13px] font-normal text-wa-fg">
                      El comprador pidió volver a recibir avisos
                    </FormLabel>
                    <FormMessage className="text-xs text-wa-red" />
                  </div>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="note"
              render={({ field }) => (
                <FormItem className={waField}>
                  <FormLabel className={waLabel}>Cómo lo pidió</FormLabel>
                  <FormControl>
                    <Textarea {...field} rows={2} className={cn(waTextarea, "min-h-[70px]")} />
                  </FormControl>
                  <FormDescription className={waHint}>
                    Queda en el registro de cambios.
                  </FormDescription>
                  <FormMessage className="text-xs text-wa-red" />
                </FormItem>
              )}
            />
            {status.kind === "error" && (
              <p role="alert" className="m-0 text-[13px] text-wa-red">
                {status.message}
              </p>
            )}
            <DialogFooter className={cn(waDialogFooter, "-mx-[22px] -mb-[22px] mt-1.5")}>
              <Button type="button" className={waButton()} onClick={onClose}>
                Cancelar
              </Button>
              <BlockedActionButton
                className={waButton({ variant: "primary" })}
                type={blocked ? "button" : "submit"}
                blocked={blocked}
                blockedReasonId={reasonId}
              >
                Reactivar
              </BlockedActionButton>
            </DialogFooter>
            {blockedReason && (
              <p id={reasonId} className="m-0 text-xs text-wa-muted">
                {blockedReason}
              </p>
            )}
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
