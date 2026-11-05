"use client";

import { useCallback } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import type { OrderDetail } from "@/components/modals/GuideDetailsModal";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FormField, FormItem, FormMessage } from "@/components/ui/form";
import { useOlvaUbigeoCascade } from "../hooks/use-olva-ubigeo-cascade";
import type { SendToOlvaFormValues } from "./fields/olva-form-types";
import { PlaceSelect, toPlaceOptions } from "./PlaceSelect";

interface OlvaUbigeoPickerProps {
  index: number;
  customer: OrderDetail["customer"];
}

/**
 * Picks the district a home delivery goes to. The department/province/district are screen state;
 * the form keeps just the 6-digit ubigeo of the district (what the backend resolves in Olva).
 */
export function OlvaUbigeoPicker({ index, customer }: OlvaUbigeoPickerProps) {
  const { control, setValue, clearErrors } = useFormContext<SendToOlvaFormValues>();
  const name = `items.${index}.destination.ubigeoCode` as const;
  const ubigeoCode = useWatch({ control, name }) ?? "";

  const handleUbigeoChange = useCallback(
    (code: string) => {
      setValue(name, code, { shouldDirty: true });
      if (code) clearErrors(name);
    },
    [name, setValue, clearErrors],
  );

  const cascade = useOlvaUbigeoCascade({
    guess: {
      department: [customer?.city, customer?.province],
      province: [customer?.province, customer?.city],
      district: [customer?.district],
    },
    ubigeoCode,
    onUbigeoChange: handleUbigeoChange,
  });

  if (cascade.isError) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          No se pudo cargar el catálogo de distritos de Olva. Cierra y vuelve a abrir este panel.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <PlaceSelect
        label="Departamento"
        value={cascade.department}
        options={toPlaceOptions(cascade.departments)}
        onChange={cascade.chooseDepartment}
        isLoading={cascade.isLoading}
      />
      <PlaceSelect
        label="Provincia"
        value={cascade.province}
        options={toPlaceOptions(cascade.provinces)}
        onChange={cascade.chooseProvince}
        disabled={!cascade.department}
      />
      <PlaceSelect
        label="Distrito de entrega"
        value={cascade.district}
        options={toPlaceOptions(cascade.districts)}
        onChange={cascade.chooseDistrict}
        disabled={!cascade.province}
      />
      <FormField
        control={control}
        name={name}
        render={() => (
          <FormItem className="sm:col-span-3">
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}
