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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { BlockedActionButton } from "@/components/whatsapp/BlockedActionButton";
import {
  type AddOptOutValues,
  addOptOutSchema,
} from "@/features/whatsapp/schemas/settings-tab.schema";
import {
  formatPeruWhatsAppNumber,
  normalizeOptOutPhone,
} from "@/features/whatsapp/utils/opt-out-phone.util";
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
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Agregar número a bajas</DialogTitle>
            <DialogDescription>
              Este número dejará de recibir avisos automáticos y envíos programados de la tienda.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form noValidate className="space-y-4" onSubmit={submit}>
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Teléfono</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        inputMode="tel"
                        autoComplete="off"
                        placeholder="987 654 321"
                      />
                    </FormControl>
                    <FormDescription>
                      {normalized
                        ? `Se guardará como ${formatPeruWhatsAppNumber(normalized)}`
                        : "Celular de Perú: 9 dígitos que empiezan en 9, con o sin +51."}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="customerName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre (opcional)</FormLabel>
                    <FormControl>
                      <Input {...field} autoComplete="off" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="storeId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tienda</FormLabel>
                    <Select
                      value={field.value || undefined}
                      onValueChange={(value) => {
                        if (value && value !== field.value) field.onChange(value);
                      }}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full" onBlur={field.onBlur}>
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
                    <FormDescription>
                      Si la baja aplica a todas las tiendas todavía no está definido.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="note"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nota (opcional)</FormLabel>
                    <FormControl>
                      <Textarea {...field} rows={2} />
                    </FormControl>
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
                <Button type="button" variant="outline" onClick={requestClose}>
                  Cancelar
                </Button>
                <BlockedActionButton
                  type={blocked ? "button" : "submit"}
                  blocked={blocked}
                  blockedReasonId={reasonId}
                >
                  Agregar a bajas
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
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Descartar el número que estabas agregando?</AlertDialogTitle>
            <AlertDialogDescription>
              Lo que escribiste se perderá. No se guardó nada.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Seguir editando</AlertDialogCancel>
            <AlertDialogAction onClick={onClose}>Descartar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
