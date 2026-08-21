"use client";

import { Plus, Trash2 } from "lucide-react";
import { useEffect } from "react";
import { useFieldArray, useFormContext, useWatch } from "react-hook-form";

import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import {
  SUNAT_TAX_AFFECTATION_TYPES,
  UNIT_CODES,
} from "@/features/sunat/sunat-document/enums/sunat-document.enums";
import type { CreateSunatDocumentsFormValues } from "@/features/sunat/sunat-document/schemas/create-sunat-documents.schema";
import {
  calculateSunatDocumentTotals,
  roundCurrency,
} from "@/features/sunat/sunat-document/utils/calculate-sunat-document-totals";

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

    const recalculatedItems = items.map((item) => {
      const quantity = Number(item.quantity) || 0;
      const unitPrice = Number(item.unitPrice) || 0;
      const discountAmount = Number(item.discountAmount) || 0;

      const subtotal = roundCurrency(Math.max(0, quantity * unitPrice));

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
              <TableHead className="w-28">P. Unit.</TableHead>
              <TableHead className="w-24">Descuento</TableHead>
              <TableHead className="w-24 text-right">Importe</TableHead>
              <TableHead className="w-8" />
            </TableRow>
          </TableHeader>

          <TableBody>
            {fields.map((field, index) => {
              const item = items?.[index] ?? field;

              const rawSubtotal = Number(item.subtotal) || 0;
              const rawDiscount = Number(item.discountAmount) || 0;
              const lineImporte = Math.max(0, rawSubtotal - rawDiscount);

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
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      {...register(`documents.0.items.${index}.unitPrice`, {
                        valueAsNumber: true,
                        setValueAs: (v) => (v === "" || Number.isNaN(v) ? 0 : Number(v)),
                      })}
                      className="h-8 text-xs"
                    />
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
