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
import type { WhatsAppOptOut } from "@/features/whatsapp/models/settings-tab.model";
import {
  type ReactivateOptOutValues,
  reactivateOptOutSchema,
} from "@/features/whatsapp/schemas/settings-tab.schema";
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reactivar avisos</DialogTitle>
          <DialogDescription>
            {`${who} volverá a recibir avisos de ${optOut.storeName ?? "la tienda"}. Solo se reactiva si el comprador lo pidió; quedará registrado quién lo hizo, cuándo y por qué.`}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form noValidate className="space-y-4" onSubmit={submit}>
            <FormField
              control={form.control}
              name="customerRequested"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start gap-2 space-y-0">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={(checked) => field.onChange(checked === true)}
                    />
                  </FormControl>
                  <div className="space-y-1">
                    <FormLabel className="font-normal">
                      El comprador pidió volver a recibir avisos
                    </FormLabel>
                    <FormMessage />
                  </div>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="note"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cómo lo pidió</FormLabel>
                  <FormControl>
                    <Textarea {...field} rows={2} />
                  </FormControl>
                  <FormDescription>Queda en el registro de cambios.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            {status.kind === "error" && (
              <p role="alert" className="text-sm text-red-700 dark:text-red-300">
                {status.message}
              </p>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <BlockedActionButton
                type={blocked ? "button" : "submit"}
                blocked={blocked}
                blockedReasonId={reasonId}
              >
                Reactivar
              </BlockedActionButton>
            </DialogFooter>
            {blockedReason && (
              <p id={reasonId} className="text-xs text-muted-foreground">
                {blockedReason}
              </p>
            )}
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
