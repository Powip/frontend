"use client";

import { useFormContext, useWatch } from "react-hook-form";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  OLVA_SENDER_DOCUMENT_LENGTHS,
  OLVA_SENDER_DOCUMENT_TYPES,
  OLVA_SENDER_EMAIL_MAX_LENGTH,
  OLVA_SENDER_LABEL_MAX_LENGTH,
  OLVA_SENDER_NAME_MAX_LENGTH,
  OLVA_SENDER_PHONE_MAX_LENGTH,
  type OlvaSenderDocumentType,
} from "@/features/olva/olva-sender-profile/constants/olva-sender-profile.constants";
import type { CreateOlvaSenderProfileFormValues } from "@/features/olva/olva-sender-profile/schemas/olva-sender-profile.schema";

interface OlvaSenderProfileFieldsProps {
  disabled?: boolean;
}

const onlyDigits = (value: string) => value.replace(/\D/g, "");

const DOCUMENT_OPTIONS: { value: OlvaSenderDocumentType; label: string; placeholder: string }[] = [
  { value: OLVA_SENDER_DOCUMENT_TYPES.RUC, label: "Empresa (RUC)", placeholder: "20123456789" },
  { value: OLVA_SENDER_DOCUMENT_TYPES.DNI, label: "Persona (DNI)", placeholder: "12345678" },
];

/**
 * The data inputs of a sender profile. They read the form from context, so any form that
 * wraps them in <Form> can reuse them (an edit form would only have to lock the document).
 */
export function OlvaSenderProfileFields({ disabled = false }: OlvaSenderProfileFieldsProps) {
  const { control, getValues, setValue, formState } =
    useFormContext<CreateOlvaSenderProfileFormValues>();
  const documentType =
    useWatch({ control, name: "documentType" }) ?? OLVA_SENDER_DOCUMENT_TYPES.RUC;
  const documentLength = OLVA_SENDER_DOCUMENT_LENGTHS[documentType];
  const documentLabel = documentType === OLVA_SENDER_DOCUMENT_TYPES.DNI ? "DNI" : "RUC";

  // The number keeps what fits the new document; it is re-checked only once the user submitted
  const changeDocumentType = (next: OlvaSenderDocumentType, onChange: (value: string) => void) => {
    onChange(next);
    setValue(
      "documentNumber",
      getValues("documentNumber").slice(0, OLVA_SENDER_DOCUMENT_LENGTHS[next]),
      {
        shouldValidate: formState.isSubmitted,
      },
    );
  };

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
        name="documentType"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Envía como</FormLabel>
            <FormControl>
              <RadioGroup
                value={field.value}
                onValueChange={(value) =>
                  changeDocumentType(value as OlvaSenderDocumentType, field.onChange)
                }
                disabled={disabled}
                className="flex flex-wrap gap-4"
              >
                {DOCUMENT_OPTIONS.map((option) => (
                  <div key={option.value} className="flex items-center gap-2">
                    <RadioGroupItem
                      value={option.value}
                      id={`olva-sender-document-${option.value}`}
                    />
                    <Label htmlFor={`olva-sender-document-${option.value}`} className="font-normal">
                      {option.label}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={control}
        name="documentNumber"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{documentLabel}</FormLabel>
            <FormControl>
              <Input
                {...field}
                onChange={(event) =>
                  field.onChange(onlyDigits(event.target.value).slice(0, documentLength))
                }
                disabled={disabled}
                inputMode="numeric"
                maxLength={documentLength}
                placeholder={
                  DOCUMENT_OPTIONS.find((option) => option.value === documentType)?.placeholder
                }
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
