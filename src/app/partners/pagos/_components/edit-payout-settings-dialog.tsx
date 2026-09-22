"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useUpdatePayoutSettings } from "@/features/partners/hooks/use-update-payout-settings";
import type { PayoutSettings } from "@/features/partners/models/payout-settings";
import {
  PAYOUT_METHOD_OPTIONS,
  updatePayoutSettingsSchema,
  type UpdatePayoutSettingsFormValues,
} from "@/features/partners/schemas/update-payout-settings.schema";

interface EditPayoutSettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  currentSettings: PayoutSettings | undefined;
}

export function EditPayoutSettingsDialog({
  isOpen,
  onClose,
  currentSettings,
}: EditPayoutSettingsDialogProps) {
  const updateSettings = useUpdatePayoutSettings();

  const form = useForm<UpdatePayoutSettingsFormValues>({
    resolver: zodResolver(updatePayoutSettingsSchema),
    defaultValues: { method: "yape", accountNumber: "" },
  });

  useEffect(() => {
    if (!isOpen || !currentSettings) {
      return;
    }
    form.reset({
      method: currentSettings.method,
      accountNumber: currentSettings.accountNumber,
    });
  }, [isOpen, currentSettings, form]);

  function handleSubmit(values: UpdatePayoutSettingsFormValues) {
    updateSettings.mutate(values, {
      onSuccess: () => onClose(),
    });
  }

  function handleClose() {
    if (updateSettings.isPending) {
      return;
    }
    onClose();
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Datos de cobro</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="method"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Método</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Selecciona un método" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {PAYOUT_METHOD_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
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
              name="accountNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Número / cuenta</FormLabel>
                  <FormControl>
                    <Input placeholder="987 654 321" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={handleClose}
                disabled={updateSettings.isPending}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={updateSettings.isPending}>
                {updateSettings.isPending ? (
                  <>
                    <Loader2 aria-hidden="true" className="mr-2 h-4 w-4 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  "Guardar"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
