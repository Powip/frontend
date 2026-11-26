"use client";

import { Loader2, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { useOlvaPerson } from "@/features/olva/olva-person/hooks/use-olva-person";
import type { OlvaPersonLookup } from "@/features/olva/olva-person/models/olva-person-lookup";
import { isValidOlvaDocumentNumber } from "@/features/olva/olva-person/utils/is-valid-olva-document-number";
import {
  OLVA_IDENTITY_DOCUMENT_TYPES,
  OLVA_PERSON_ROLES,
  type OlvaIdentityDocumentType,
} from "@/features/olva/shared/constants/olva-enums.constants";
import { isOlvaNotFoundError } from "@/features/olva/shared/utils/olva-error.util";
import type { SendToOlvaFormValues } from "./fields/olva-form-types";
import { OlvaSelectField } from "./fields/olva-select-field";
import { OlvaTextField } from "./fields/olva-text-field";

interface OlvaRecipientFieldsProps {
  index: number;
}

const DOCUMENT_OPTIONS = [
  { value: OLVA_IDENTITY_DOCUMENT_TYPES.DNI, label: "DNI" },
  { value: OLVA_IDENTITY_DOCUMENT_TYPES.RUC, label: "RUC" },
];

const onlyDigits = (value: string) => value.replace(/\D/g, "");

/** Who receives the order. "Buscar en Olva" fills the name from their DNI/RUC when it is known. */
export function OlvaRecipientFields({ index }: OlvaRecipientFieldsProps) {
  const { control, setValue } = useFormContext<SendToOlvaFormValues>();
  const base = `items.${index}.recipient` as const;
  const documentType = useWatch({ control, name: `${base}.documentType` });
  const documentNumber = useWatch({ control, name: `${base}.documentNumber` });
  const [lookup, setLookup] = useState<OlvaPersonLookup | null>(null);
  const person = useOlvaPerson(lookup);

  const type: OlvaIdentityDocumentType = documentType ?? OLVA_IDENTITY_DOCUMENT_TYPES.DNI;
  const number = typeof documentNumber === "string" ? documentNumber : "";
  const canLookup = isValidOlvaDocumentNumber(type, number);

  // The user asked for this lookup, so what Olva knows replaces what is in the form
  useEffect(() => {
    const found = person.data;

    if (!found) return;
    if (found.fullName) setValue(`${base}.fullName`, found.fullName, { shouldValidate: true });
    if (found.phone) setValue(`${base}.phone`, found.phone, { shouldValidate: true });
  }, [person.data, base, setValue]);

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <OlvaSelectField name={`${base}.documentType`} label="Documento" options={DOCUMENT_OPTIONS} />
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <OlvaTextField
            name={`${base}.documentNumber`}
            label="Número"
            inputMode="numeric"
            transform={onlyDigits}
          />
        </div>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Buscar en Olva"
          title="Buscar en Olva"
          disabled={!canLookup || person.isFetching}
          onClick={() =>
            setLookup({
              documentType: type,
              documentNumber: number,
              role: OLVA_PERSON_ROLES.RECIPIENT,
            })
          }
        >
          {person.isFetching ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Search className="size-4" />
          )}
        </Button>
      </div>
      <OlvaTextField name={`${base}.fullName`} label="Nombre completo" />
      <OlvaTextField
        name={`${base}.phone`}
        label="Teléfono"
        inputMode="tel"
        transform={onlyDigits}
      />
      {person.isError && isOlvaNotFoundError(person.error) ? (
        <p className="text-muted-foreground text-xs sm:col-span-2 lg:col-span-4">
          Olva no tiene registrado ese documento: completa el nombre a mano.
        </p>
      ) : null}
    </div>
  );
}
