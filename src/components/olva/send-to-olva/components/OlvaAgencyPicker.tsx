"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useFormContext } from "react-hook-form";
import type { OrderDetail } from "@/components/modals/GuideDetailsModal";
import { Combobox } from "@/components/ui/combobox";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { olvaAgencyQueries } from "@/features/olva/olva-agency/queries/olva-agency.queries";
import { useOlvaAgencyCascade } from "../hooks/use-olva-agency-cascade";
import type { SendToOlvaFormValues } from "./fields/olva-form-types";
import { PlaceSelect, toPlaceOptions } from "./PlaceSelect";

interface OlvaAgencyPickerProps {
  index: number;
  customer: OrderDetail["customer"];
}

/**
 * Picks the pickup agency (store pickup only) by narrowing down the place. The
 * department/province/district are screen state only (they are not sent); the form keeps just
 * the agency code. A home delivery has no agency: see `OlvaUbigeoPicker`.
 */
export function OlvaAgencyPicker({ index, customer }: OlvaAgencyPickerProps) {
  const { control } = useFormContext<SendToOlvaFormValues>();
  const queryClient = useQueryClient();
  const cascade = useOlvaAgencyCascade({
    department: [customer?.city, customer?.province],
    province: [customer?.province, customer?.city],
    district: [customer?.district],
  });

  const agencies = cascade.agencies.data ?? [];

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <PlaceSelect
        label="Departamento"
        value={cascade.department}
        options={toPlaceOptions(cascade.departments.data)}
        onChange={cascade.chooseDepartment}
      />
      <PlaceSelect
        label="Provincia"
        value={cascade.province}
        options={toPlaceOptions(cascade.provinces.data)}
        onChange={cascade.chooseProvince}
        disabled={!cascade.department}
      />
      <PlaceSelect
        label="Distrito"
        value={cascade.district}
        options={toPlaceOptions(cascade.districts.data)}
        onChange={cascade.chooseDistrict}
        disabled={!cascade.province}
      />

      <FormField
        control={control}
        name={`items.${index}.destination.agencyCode`}
        render={({ field }) => (
          <FormItem className="sm:col-span-3">
            <FormLabel>Agencia de destino</FormLabel>
            <FormControl>
              <Combobox
                value={typeof field.value === "string" ? field.value : ""}
                options={agencies.map((agency) => ({
                  value: agency.code,
                  label: `${agency.name} — ${agency.address}`,
                }))}
                placeholder={
                  cascade.province ? "Elige una agencia" : "Elige departamento y provincia"
                }
                searchPlaceholder="Buscar agencia"
                emptyMessage="Olva no tiene agencias en esa zona"
                disabled={!cascade.province}
                isLoading={cascade.agencies.isFetching}
                onValueChange={(code) => {
                  const agency = agencies.find((item) => item.code === code);

                  // The quote needs this agency's ubigeo: seed the detail cache, no extra request
                  if (agency) {
                    queryClient.setQueryData(olvaAgencyQueries.detail(code).queryKey, agency);
                  }
                  field.onChange(code);
                }}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}
