"use client";

import { Loader2 } from "lucide-react";
import type { BaseSyntheticEvent } from "react";
import type { UseFormReturn } from "react-hook-form";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import type { CreateOlvaSenderProfileFormValues } from "@/features/olva/olva-sender-profile/schemas/olva-sender-profile.schema";
import { OlvaSenderProfileFields } from "./olva-sender-profile-fields";

interface CreateOlvaSenderProfileFormProps {
  form: UseFormReturn<CreateOlvaSenderProfileFormValues>;
  onSubmit: (event?: BaseSyntheticEvent) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
  /** The profile will be the default no matter what (it is the first one), so the switch is locked on. */
  isDefaultLocked?: boolean;
}

/** Presentational: it renders whatever form it is given, so stories and tests can drive it. */
export function CreateOlvaSenderProfileForm({
  form,
  onSubmit,
  onCancel,
  isSubmitting = false,
  isDefaultLocked = false,
}: CreateOlvaSenderProfileFormProps) {
  return (
    <Form {...form}>
      <form onSubmit={onSubmit} noValidate className="grid gap-6" aria-busy={isSubmitting}>
        <OlvaSenderProfileFields disabled={isSubmitting} />

        <FormField
          control={form.control}
          name="isDefault"
          render={({ field }) => (
            <FormItem className="flex items-center justify-between gap-4 rounded-lg border p-3">
              <div className="grid gap-1">
                <FormLabel>Remitente predeterminado</FormLabel>
                <FormDescription>
                  {isDefaultLocked
                    ? "Será tu remitente predeterminado por ser el primero."
                    : "Se usará por defecto al generar guías con Olva."}
                </FormDescription>
              </div>
              <FormControl>
                <Switch
                  checked={isDefaultLocked || field.value}
                  onCheckedChange={field.onChange}
                  disabled={isSubmitting || isDefaultLocked}
                />
              </FormControl>
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onCancel} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 aria-hidden="true" className="mr-2 h-4 w-4 animate-spin" />
                Verificando RUC...
              </>
            ) : (
              "Crear remitente"
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}
