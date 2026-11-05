"use client";

import { useFormContext } from "react-hook-form";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  OLVA_RUC_LENGTH,
  OLVA_SENDER_EMAIL_MAX_LENGTH,
  OLVA_SENDER_LABEL_MAX_LENGTH,
  OLVA_SENDER_NAME_MAX_LENGTH,
  OLVA_SENDER_PHONE_MAX_LENGTH,
} from "@/features/olva/olva-sender-profile/constants/olva-sender-profile.constants";
import type { CreateOlvaSenderProfileFormValues } from "@/features/olva/olva-sender-profile/schemas/olva-sender-profile.schema";

interface OlvaSenderProfileFieldsProps {
  disabled?: boolean;
}

const onlyDigits = (value: string) => value.replace(/\D/g, "");

/**
 * The data inputs of a sender profile. They read the form from context, so any form that
 * wraps them in <Form> can reuse them (an edit form would only have to lock the RUC).
 */
export function OlvaSenderProfileFields({ disabled = false }: OlvaSenderProfileFieldsProps) {
  const { control } = useFormContext<CreateOlvaSenderProfileFormValues>();

  return (
    <div className="grid gap-4">
      <FormField
        control={control}
        name="label"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Nombre del remitente</FormLabel>
            <FormControl>
              <Input
                {...field}
                disabled={disabled}
                maxLength={OLVA_SENDER_LABEL_MAX_LENGTH}
                placeholder="Ej. Almacén principal"
                autoComplete="off"
              />
            </FormControl>
            <FormDescription>Solo para que lo identifiques en Powip.</FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={control}
        name="ruc"
        render={({ field }) => (
          <FormItem>
            <FormLabel>RUC</FormLabel>
            <FormControl>
              <Input
                {...field}
                onChange={(event) => field.onChange(onlyDigits(event.target.value))}
                disabled={disabled}
                inputMode="numeric"
                maxLength={OLVA_RUC_LENGTH}
                placeholder="20123456789"
                autoComplete="off"
              />
            </FormControl>
            <FormDescription>
              Olva lo verifica al guardar. No se puede cambiar después.
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          control={control}
          name="firstNames"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nombres</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  disabled={disabled}
                  maxLength={OLVA_SENDER_NAME_MAX_LENGTH}
                  autoComplete="given-name"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name="lastName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Apellido</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  disabled={disabled}
                  maxLength={OLVA_SENDER_NAME_MAX_LENGTH}
                  autoComplete="family-name"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <FormField
        control={control}
        name="email"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Correo</FormLabel>
            <FormControl>
              <Input
                {...field}
                type="email"
                disabled={disabled}
                maxLength={OLVA_SENDER_EMAIL_MAX_LENGTH}
                placeholder="remitente@empresa.com"
                autoComplete="email"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={control}
        name="phone"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Teléfono (opcional)</FormLabel>
            <FormControl>
              <Input
                {...field}
                type="tel"
                disabled={disabled}
                maxLength={OLVA_SENDER_PHONE_MAX_LENGTH}
                placeholder="987 654 321"
                autoComplete="tel"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}
