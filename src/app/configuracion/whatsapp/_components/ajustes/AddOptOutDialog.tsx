"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useId, useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { BlockedActionButton } from "@/components/whatsapp/BlockedActionButton";
import { WaDialogClose } from "@/components/whatsapp/ui/WaDialogClose";
import { WaInput } from "@/components/whatsapp/ui/WaInput";
import {
  waButton,
  waDialogBody,
  waDialogContent,
  waDialogFooter,
  waDialogHeader,
  waDialogTitle,
  waField,
  waHint,
  waInput,
  waLabel,
  waSelectTrigger,
  waTextarea,
} from "@/components/whatsapp/ui/wa-classes";
import {
  type AddOptOutValues,
  addOptOutSchema,
} from "@/features/whatsapp/schemas/settings-tab.schema";
import {
  formatPeruWhatsAppNumber,
  normalizeOptOutPhone,
} from "@/features/whatsapp/utils/opt-out-phone.util";
import { cn } from "@/lib/utils";
import type { SettingsMutations } from "./settings-types";

interface AddOptOutDialogProps {
  stores: { id: string; name: string }[];
  defaultStoreId: string | null;
  blockedReason: string | null;
  addOptOut: SettingsMutations["addOptOut"];
  onClose: () => void;
}

export function AddOptOutDialog({
  stores,
  defaultStoreId,
  blockedReason,
  addOptOut,
  onClose,
}: AddOptOutDialogProps) {
  const reasonId = useId();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [status, setStatus] = useState<
    { kind: "idle" } | { kind: "pending" } | { kind: "error"; message: string }
  >({ kind: "idle" });
  const defaultValues: AddOptOutValues = {
    phone: "",
    customerName: "",
    storeId: defaultStoreId ?? "",
    note: "",
  };
  const form = useForm<AddOptOutValues>({
    resolver: zodResolver(addOptOutSchema),
    defaultValues,
    mode: "onTouched",
  });
  const phone = useWatch({ control: form.control, name: "phone" });
  const normalized = normalizeOptOutPhone(phone ?? "");
  const blocked = !!blockedReason || !addOptOut || status.kind === "pending";

  const hasChanges = () => {
    const values = form.getValues();
    return (Object.keys(defaultValues) as (keyof AddOptOutValues)[]).some(
      (key) => values[key] !== defaultValues[key],
    );
  };

  const requestClose = () => {
    if (hasChanges()) {
      setConfirmOpen(true);
      return;
    }
    onClose();
  };

  const submit = form.handleSubmit(async (values) => {
    if (blocked || !addOptOut) return;
    const normalizedPhone = normalizeOptOutPhone(values.phone);
    if (!normalizedPhone) return;
    setStatus({ kind: "pending" });
    try {
      await addOptOut({
        phone: normalizedPhone,
        customerName: values.customerName.trim() || null,
        storeId: values.storeId,
        note: values.note.trim() || null,
      });
      onClose();
    } catch (caught) {
      setStatus({
        kind: "error",
        message: caught instanceof Error && caught.message ? caught.message : "No se pudo agregar.",
      });
    }
  });

  return (
    <>
      <Dialog open onOpenChange={(open) => !open && requestClose()}>
        <DialogContent
          showCloseButton={false}
          className={cn(
            waDialogContent,
            "flex max-h-[calc(100dvh-2rem)] flex-col sm:max-w-[480px]",
          )}
        >
          <DialogHeader className={waDialogHeader}>
            <DialogTitle className={waDialogTitle}>Agregar número a bajas</DialogTitle>
            <WaDialogClose onClick={requestClose} />
          </DialogHeader>
          <Form {...form}>
            <form
              noValidate
              className={cn(waDialogBody, "flex min-h-0 flex-col gap-3.5 overflow-y-auto")}
              onSubmit={submit}
            >
              <DialogDescription className="m-0 text-sm text-wa-muted">
                Este número dejará de recibir avisos automáticos y envíos programados de la tienda.
              </DialogDescription>
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem className={waField}>
                    <FormLabel className={waLabel}>Teléfono</FormLabel>
                    <FormControl>
                      <WaInput
                        {...field}
                        inputMode="tel"
                        autoComplete="off"
                        placeholder="987 654 321"
                        className={cn(waInput, "wa-num")}
                      />
                    </FormControl>
                    <FormDescription className={waHint}>
                      {normalized
                        ? `Se guardará como ${formatPeruWhatsAppNumber(normalized)}`
                        : "Celular de Perú: 9 dígitos que empiezan en 9, con o sin +51."}
                    </FormDescription>
                    <FormMessage className="text-xs text-wa-red" />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="customerName"
                render={({ field }) => (
                  <FormItem className={waField}>
                    <FormLabel className={waLabel}>Nombre (opcional)</FormLabel>
                    <FormControl>
                      <WaInput {...field} autoComplete="off" className={waInput} />
                    </FormControl>
                    <FormMessage className="text-xs text-wa-red" />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="storeId"
                render={({ field }) => (
                  <FormItem className={waField}>
                    <FormLabel className={waLabel}>Tienda</FormLabel>
                    <Select
                      value={field.value || undefined}
                      onValueChange={(value) => {
                        if (value && value !== field.value) field.onChange(value);
                      }}
                    >
                      <FormControl>
                        <SelectTrigger className={waSelectTrigger} onBlur={field.onBlur}>
                          <SelectValue placeholder="Elige la tienda" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {stores.map((store) => (
                          <SelectItem key={store.id} value={store.id}>
                            {store.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription className={waHint}>
                      Si la baja aplica a todas las tiendas todavía no está definido.
                    </FormDescription>
                    <FormMessage className="text-xs text-wa-red" />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="note"
                render={({ field }) => (
                  <FormItem className={waField}>
                    <FormLabel className={waLabel}>Nota (opcional)</FormLabel>
                    <FormControl>
                      <Textarea {...field} rows={2} className={cn(waTextarea, "min-h-[70px]")} />
                    </FormControl>
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
                <Button type="button" className={waButton()} onClick={requestClose}>
                  Cancelar
                </Button>
                <BlockedActionButton
                  className={waButton({ variant: "primary" })}
                  type={blocked ? "button" : "submit"}
                  blocked={blocked}
                  blockedReasonId={reasonId}
                >
                  Agregar a bajas
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
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className={cn(waDialogContent, "sm:max-w-[440px]")}>
          <AlertDialogHeader className={waDialogHeader}>
            <AlertDialogTitle className={waDialogTitle}>
              ¿Descartar el número que estabas agregando?
            </AlertDialogTitle>
          </AlertDialogHeader>
          <div className={waDialogBody}>
            <AlertDialogDescription className="m-0 text-sm text-wa-muted">
              Lo que escribiste se perderá. No se guardó nada.
            </AlertDialogDescription>
          </div>
          <AlertDialogFooter className={waDialogFooter}>
            <AlertDialogCancel className={waButton()}>Seguir editando</AlertDialogCancel>
            <AlertDialogAction className={waButton({ variant: "solid-danger" })} onClick={onClose}>
              Descartar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
