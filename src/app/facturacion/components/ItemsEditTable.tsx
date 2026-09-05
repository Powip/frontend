"use client";

import { Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import {
  type Control,
  useController,
  useFieldArray,
  useFormContext,
  useWatch,
} from "react-hook-form";

import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { IGV_RATE } from "@/features/sunat/shared/constants/sunat.constants";
import {
  SUNAT_TAX_AFFECTATION_TYPES,
  UNIT_CODES,
} from "@/features/sunat/sunat-document/enums/sunat-document.enums";
import type { CreateSunatDocumentsFormValues } from "@/features/sunat/sunat-document/schemas/create-sunat-documents.schema";
import {
  calculateSunatDocumentTotals,
  roundCurrency,
} from "@/features/sunat/sunat-document/utils/calculate-sunat-document-totals";

/**
 * `unitPrice` is deliberately stored at full (unrounded) precision when it
 * comes from a gross → net conversion.
 *
 * Example:
 *
 *   gross unit price = 100
 *   net unit price   = 100 / 1.18
 *                    = 84.745762...
 *
 * We must NOT store 84.75 as the unit price because multiplying that rounded
 * value back by the quantity can introduce a cent discrepancy.
 *
 * The input therefore displays 2 decimal places when it is not being edited,
 * while the underlying form value keeps its full precision.
 */
function PriceInput({
  name,
  control,
}: {
  name: `documents.0.items.${number}.unitPrice`;
  control: Control<CreateSunatDocumentsFormValues>;
}) {
  const { field } = useController({ name, control });

  const [displayValue, setDisplayValue] = useState(() => formatPrice(field.value));

  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (!isFocused) {
      setDisplayValue(formatPrice(field.value));
    }
  }, [field.value, isFocused]);

  return (
    <Input
      type="number"
      min={0}
      step="0.01"
      value={displayValue}
      onFocus={() => setIsFocused(true)}
      onChange={(event) => {
        const raw = event.target.value;

        setDisplayValue(raw);

        const parsed = Number(raw);

        field.onChange(raw === "" || Number.isNaN(parsed) ? 0 : parsed);
      }}
      onBlur={() => {
        setIsFocused(false);
        field.onBlur();
        setDisplayValue(formatPrice(field.value));
      }}
      className="h-8 text-xs"
    />
  );
}

function formatPrice(value: unknown): string {
  const num = Number(value) || 0;

  return roundCurrency(num).toFixed(2);
}

export function ItemsEditTable() {
  const { control, register, setValue, getValues } =
    useFormContext<CreateSunatDocumentsFormValues>();

  const { fields, append, remove } = useFieldArray({
    control,
    name: "documents.0.items",
  });

  const items = useWatch({
    control,
    name: "documents.0.items",
  });

  useEffect(() => {
    if (!items || items.length === 0) {
      return;
    }

    /*
     * Keep subtotal at full precision.
     *
     * This is important for prices that were converted from gross → net.
     * If we round subtotal here, the later IGV calculation can be off by
     * S/ 0.01.
     */
    const recalculatedItems = items.map((item) => {
      const quantity = Number(item.quantity) || 0;
      const unitPrice = Number(item.unitPrice) || 0;
      const discountAmount = Number(item.discountAmount) || 0;

      const subtotal = Math.max(0, quantity * unitPrice);

      return {
        ...item,
        quantity,
        unitPrice,
        discountAmount,
        subtotal,
      };
    });

    recalculatedItems.forEach((item, index) => {
      if (items[index]?.subtotal !== item.subtotal) {
        setValue(`documents.0.items.${index}.subtotal`, item.subtotal, {
          shouldDirty: true,
          shouldValidate: true,
        });
      }
    });

    /*
     * Totals are calculated from the full-precision item amounts.
     * `calculateSunatDocumentTotals` is responsible for currency rounding.
     */
    const totals = calculateSunatDocumentTotals(recalculatedItems);
    const currentTotals = getValues("documents.0.totals");

    (Object.keys(totals) as (keyof typeof totals)[]).forEach((key) => {
      if (currentTotals?.[key] !== totals[key]) {
        setValue(`documents.0.totals.${key}`, totals[key], {
          shouldDirty: true,
          shouldValidate: true,
        });
      }
    });
  }, [items, setValue, getValues]);

  function addItem() {
    append({
      sku: "PROD001",
      productName: "Nuevo ítem",
      quantity: 1,
      unitPrice: 0,
      subtotal: 0,
      discountAmount: 0,
      unitCode: UNIT_CODES.UNIT,
      taxType: SUNAT_TAX_AFFECTATION_TYPES.GRAVADO,
    });
  }

  return (
    <div className="space-y-2">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Descripción</TableHead>

              <TableHead className="w-20">Cant.</TableHead>

              <TableHead className="w-28">
                P. Unit. <span className="font-normal text-muted-foreground">(sin IGV)</span>
              </TableHead>

              <TableHead className="w-24">Descuento</TableHead>

              <TableHead className="w-28 text-right">
                Importe <span className="font-normal text-muted-foreground">(con IGV)</span>
              </TableHead>

              <TableHead className="w-8" />
            </TableRow>
          </TableHeader>

          <TableBody>
            {fields.map((field, index) => {
              const item = items?.[index] ?? field;

              /*
               * IMPORTANT:
               *
               * Do not use `item.subtotal` here because it may already have
               * been rounded elsewhere.
               *
               * Reconstruct the raw net line amount from the full-precision
               * unit price.
               */
              const quantity = Number(item.quantity) || 0;
              const unitPrice = Number(item.unitPrice) || 0;

              const rawSubtotal = Math.max(0, quantity * unitPrice);

              const rawDiscount = Math.max(0, Number(item.discountAmount) || 0);

              /*
               * Discount is applied before IGV.
               */
              const taxableBase = Math.max(0, rawSubtotal - rawDiscount);

              /*
               * Calculate IGV from the FULL-PRECISION taxable base.
               *
               * Do not round taxableBase before calculating IGV.
               *
               * Example:
               *
               *   taxableBase = 84.745762...
               *   IGV         = 15.254237...
               *   rounded IGV = 15.25
               *
               * Instead of:
               *
               *   rounded base = 84.75
               *   IGV          = 15.26
               */
              const lineTax =
                item.taxType === SUNAT_TAX_AFFECTATION_TYPES.GRAVADO
                  ? roundCurrency(taxableBase * IGV_RATE)
                  : 0;

              /*
               * Display the net line amount rounded to currency precision,
               * then add the already-rounded tax.
               *
               * This keeps the displayed importe consistent with the
               * document total calculation.
               */
              const lineImporte = roundCurrency(roundCurrency(taxableBase) + lineTax);

              return (
                <TableRow key={field.id}>
                  <TableCell>
                    <Input
                      {...register(`documents.0.items.${index}.productName`)}
                      className="h-8 text-xs"
                    />
                  </TableCell>

                  <TableCell>
                    <Input
                      type="number"
                      min={1}
                      {...register(`documents.0.items.${index}.quantity`, {
                        valueAsNumber: true,
                        setValueAs: (v) => (v === "" || Number.isNaN(v) ? 0 : Number(v)),
                      })}
                      className="h-8 text-xs"
                    />
                  </TableCell>

                  <TableCell>
                    <PriceInput name={`documents.0.items.${index}.unitPrice`} control={control} />
                  </TableCell>

                  <TableCell>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      {...register(`documents.0.items.${index}.discountAmount`, {
                        valueAsNumber: true,
                        setValueAs: (v) => (v === "" || Number.isNaN(v) ? 0 : Number(v)),
                      })}
                      className="h-8 text-xs"
                    />
                  </TableCell>

                  <TableCell className="text-right text-xs font-medium">
                    S/ {lineImporte.toFixed(2)}
                  </TableCell>

                  <TableCell>
                    <button
                      type="button"
                      onClick={() => remove(index)}
                      disabled={fields.length <= 1}
                      className="text-red-500 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                      title="Quitar ítem"
                      aria-label={`Quitar ${item.productName}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <button
        type="button"
        onClick={addItem}
        className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
      >
        <Plus className="h-3.5 w-3.5" />
        Agregar ítem
      </button>
    </div>
  );
}
