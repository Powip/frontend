"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CancelledError } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
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
import { usePayoutSettings } from "@/features/partners/hooks/use-payout-settings";
import { useUpdatePayoutSettings } from "@/features/partners/hooks/use-update-payout-settings";
import { getHttpStatus } from "@/features/partners/mappers/to-partner-identity-from-error";
import type { PayoutSettings } from "@/features/partners/models/payout-settings";
import {
  PAYOUT_METHOD_OPTIONS,
  type PayoutSettingsCommand,
  payoutSettingsCommandSchema,
  type UpdatePayoutSettingsFormValues,
  updatePayoutSettingsSchema,
} from "@/features/partners/schemas/update-payout-settings.schema";

interface EditPayoutSettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  currentSettings: PayoutSettings | null | undefined;
}

export function EditPayoutSettingsDialog({
  isOpen,
  onClose,
  currentSettings,
}: EditPayoutSettingsDialogProps) {
  const updateSettings = useUpdatePayoutSettings();
  const settingsRead = usePayoutSettings();
  const [attempt, setAttempt] = useState<Readonly<PayoutSettingsCommand> | null>(null);
  const attempted = useRef<Readonly<PayoutSettingsCommand> | null>(null);
  const baseline = useRef<PayoutSettings | null | undefined>(undefined);
  const baselineGeneration = useRef(-1);
  const owner = `${settingsRead.session.userId ?? "anonymous"}:${settingsRead.session.epoch}`;
  const previousOwner = useRef(owner);
  const presentation = useRef({ isOpen, generation: 0 });
  if (presentation.current.isOpen !== isOpen) {
    presentation.current = { isOpen, generation: presentation.current.generation + 1 };
  }
  const [isReconciling, setIsReconciling] = useState(false);
  const [reconciliationFailed, setReconciliationFailed] = useState(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const form = useForm<UpdatePayoutSettingsFormValues>({
    resolver: zodResolver(updatePayoutSettingsSchema),
    defaultValues: { method: "yape", accountNumber: "", accountHolder: "", reason: "" },
  });

  useEffect(() => {
    if (previousOwner.current !== owner) {
      previousOwner.current = owner;
      attempted.current = null;
      setAttempt(null);
      baseline.current = undefined;
      baselineGeneration.current = -1;
      setIsReconciling(false);
      setReconciliationFailed(false);
      form.reset({ method: "yape", accountNumber: "", accountHolder: "", reason: "" });
    }
    if (!isOpen) return;
    if (currentSettings === undefined || settingsRead.session.denied) {
      form.reset({ method: "yape", accountNumber: "", accountHolder: "", reason: "" });
      return;
    }
    if (attempted.current) {
      form.reset({
        method: attempted.current.method,
        accountNumber: attempted.current.accountNumber,
        accountHolder: attempted.current.accountHolder,
        reason: attempted.current.reason,
      });
      return;
    }
    if (
      baselineGeneration.current === presentation.current.generation &&
      baseline.current !== undefined
    )
      return;
    baseline.current = currentSettings;
    baselineGeneration.current = presentation.current.generation;
    form.reset({
      method: currentSettings?.method ?? "yape",
      accountNumber: currentSettings?.accountNumber ?? "",
      accountHolder: currentSettings?.accountHolder ?? "",
      reason: "",
    });
  }, [isOpen, currentSettings, form, owner, settingsRead.session.denied]);

  const unavailable = currentSettings === undefined || Boolean(settingsRead.session.denied);
  const errorStatus = getHttpStatus(updateSettings.error);
  const failedAttempt = Boolean(attempt && updateSettings.isError);
  const unknownResult =
    failedAttempt &&
    !(updateSettings.error instanceof CancelledError) &&
    (errorStatus === null || errorStatus >= 500);
  const busy = updateSettings.isPending || isReconciling;

  function send(command: Readonly<PayoutSettingsCommand>) {
    const generation = presentation.current.generation;
    const dispatchedOwner = owner;
    attempted.current = command;
    setAttempt(command);
    setReconciliationFailed(false);
    updateSettings.mutate(command, {
      onSuccess: () => {
        if (
          !mounted.current ||
          previousOwner.current !== dispatchedOwner ||
          !presentation.current.isOpen ||
          presentation.current.generation !== generation ||
          attempted.current !== command
        )
          return;
        try {
          settingsRead.session.assertCurrent(new AbortController().signal);
        } catch {
          return;
        }
        attempted.current = null;
        setAttempt(null);
        onClose();
      },
    });
  }

  function handleSubmit(values: UpdatePayoutSettingsFormValues) {
    if (unavailable || busy || attempted.current || baseline.current === undefined) return;
    send(
      Object.freeze(
        payoutSettingsCommandSchema.parse({
          ...values,
          expectedVersion: baseline.current?.version ?? null,
        }),
      ),
    );
  }

  async function reconcile() {
    if (unavailable || busy) return;
    const generation = presentation.current.generation;
    const dispatchedOwner = owner;
    setIsReconciling(true);
    setReconciliationFailed(false);
    try {
      const result = await settingsRead.refetch({ throwOnError: true });
      settingsRead.session.assertCurrent(new AbortController().signal);
      if (
        !mounted.current ||
        previousOwner.current !== dispatchedOwner ||
        !presentation.current.isOpen ||
        presentation.current.generation !== generation ||
        result.error ||
        result.data === undefined
      )
        return;
      baseline.current = result.data;
      baselineGeneration.current = generation;
      attempted.current = null;
      setAttempt(null);
      form.reset({
        method: result.data?.method ?? "yape",
        accountNumber: result.data?.accountNumber ?? "",
        accountHolder: result.data?.accountHolder ?? "",
        reason: "",
      });
    } catch (error) {
      if (
        mounted.current &&
        previousOwner.current === dispatchedOwner &&
        presentation.current.generation === generation &&
        !(error instanceof CancelledError)
      )
        setReconciliationFailed(true);
    } finally {
      if (
        mounted.current &&
        previousOwner.current === dispatchedOwner &&
        presentation.current.generation === generation
      )
        setIsReconciling(false);
    }
  }

  function handleClose() {
    if (busy) {
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
            <fieldset disabled={busy || unavailable || attempt !== null} className="space-y-4">
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
                      <Input autoComplete="off" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="accountHolder"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Titular</FormLabel>
                    <FormControl>
                      <Input autoComplete="off" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="reason"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Motivo del cambio</FormLabel>
                    <FormControl>
                      <Input autoComplete="off" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </fieldset>
            <p className="text-sm text-muted-foreground">
              Guardar estos datos no verifica la cuenta ni ejecuta una transferencia.
            </p>

            {failedAttempt && !unavailable ? (
              <div role="alert" className="space-y-2 text-sm">
                <p>
                  {unknownResult
                    ? "No pudimos confirmar el resultado. La solicitud podría haberse guardado. Reintentá la misma solicitud o revisá los datos guardados antes de hacer otro cambio."
                    : "La solicitud fue rechazada. Revisá los datos guardados antes de enviar otro cambio."}
                </p>
                {unknownResult ? (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busy}
                    onClick={() => {
                      if (attempted.current) send(attempted.current);
                    }}
                  >
                    Reintentar misma solicitud
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() => {
                    void reconcile();
                  }}
                >
                  Revisar datos guardados
                </Button>
                {reconciliationFailed ? (
                  <p>
                    No pudimos leer los datos actuales. Conservamos la solicitud original para
                    reintentar.
                  </p>
                ) : null}
              </div>
            ) : null}

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={handleClose} disabled={busy}>
                Cancelar
              </Button>
              <Button type="submit" disabled={busy || unavailable || attempt !== null}>
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
