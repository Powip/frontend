"use client";

import { useEffect } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import type { OrderDetail } from "@/components/modals/GuideDetailsModal";
import {
  OLVA_HOME_DELIVERY_MIN_REFERENCE_LENGTH,
  OLVA_SHIPMENT_PIN_LENGTH,
} from "@/features/olva/olva-shipment/constants/olva-shipment.constants";
import { OLVA_DELIVERY_TYPES } from "@/features/olva/shared/constants/olva-enums.constants";
import { SEND_TO_OLVA_DELIVERY_TYPE_LABELS } from "../constants/send-to-olva.constants";
import { useSelectedOlvaHeadquarter } from "../hooks/use-selected-olva-headquarter";
import { deriveOlvaLotPayer } from "../utils/derive-olva-lot-payer";
import {
  getDefaultOlvaHomePaymentMethod,
  getOlvaOnlinePaymentMethods,
  isOlvaHomeDeliveryAvailable,
} from "../utils/olva-payment-methods";
import { planOlvaDeliveryTypeSwitch } from "../utils/plan-olva-delivery-type-switch";
import type { SendToOlvaFormValues } from "./fields/olva-form-types";
import { OlvaSelectField } from "./fields/olva-select-field";
import { OlvaTextField } from "./fields/olva-text-field";
import { OlvaAgencyPicker } from "./OlvaAgencyPicker";
import { OlvaUbigeoPicker } from "./OlvaUbigeoPicker";

interface OlvaDestinationFieldsProps {
  index: number;
  customer: OrderDetail["customer"];
}

const getDeliveryOptions = () =>
  Object.values(OLVA_DELIVERY_TYPES)
    .filter((value) => value !== OLVA_DELIVERY_TYPES.HOME_DELIVERY || isOlvaHomeDeliveryAvailable())
    .map((value) => ({ value, label: SEND_TO_OLVA_DELIVERY_TYPE_LABELS[value] }));

const onlyDigits = (value: string) => value.replace(/\D/g, "");

/**
 * Where it goes, and what that needs:
 * - store pickup: the agency where the customer collects, and an optional pickup PIN. Who pays
 *   is the lot's (see `OlvaSenderSection`).
 * - home delivery: the district (ubigeo), street address and reference. It is always paid
 *   online, so it carries its own payment method instead of the lot's.
 */
export function OlvaDestinationFields({ index, customer }: OlvaDestinationFieldsProps) {
  const { control, setValue, getValues, clearErrors } = useFormContext<SendToOlvaFormValues>();
  const { headquarter } = useSelectedOlvaHeadquarter();
  const deliveryType = useWatch({ control, name: `items.${index}.deliveryType` });
  const paymentMethod = useWatch({ control, name: `items.${index}.paymentMethod` });
  const isHome = deliveryType === OLVA_DELIVERY_TYPES.HOME_DELIVERY;
  const onlineMethods = getOlvaOnlinePaymentMethods(headquarter);
  const defaultHomeMethod = getDefaultOlvaHomePaymentMethod(headquarter);

  // With a single usable method there is nothing to choose: start on it
  useEffect(() => {
    if (isHome && !paymentMethod && defaultHomeMethod) {
      setValue(`items.${index}.paymentMethod`, defaultHomeMethod);
    }
  }, [isHome, paymentMethod, defaultHomeMethod, index, setValue]);

  /** What the other delivery type used is reset, so a hidden field can never block or pollute the submit. */
  const handleDeliveryTypeChange = (next: string) => {
    const otherRows = getValues("items").filter((_, rowIndex) => rowIndex !== index);
    const lotPayer = deriveOlvaLotPayer(otherRows);
    const plan = planOlvaDeliveryTypeSwitch({
      next,
      lotPayer: { whoPays: lotPayer?.whoPays, paymentMethod: lotPayer?.paymentMethod },
      homePaymentMethod: defaultHomeMethod,
      currentAddress: getValues(`items.${index}.destination.address`),
      customerAddress: customer?.address ?? undefined,
    });

    // The planner speaks in paths relative to the row, which the typed API cannot follow
    const set = setValue as (name: string, value: unknown, options?: object) => void;
    const clear = clearErrors as (name: string[]) => void;

    for (const reset of plan.resets) {
      set(`items.${index}.${reset.field}`, reset.value, { shouldDirty: true });
    }
    clear(plan.clearErrors.map((field) => `items.${index}.${field}`));
  };

  return (
    <div className="grid gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <OlvaSelectField
          name={`items.${index}.deliveryType`}
          label="Tipo de entrega"
          options={getDeliveryOptions()}
          onValueChange={handleDeliveryTypeChange}
        />
        {isHome ? (
          <OlvaSelectField
            name={`items.${index}.paymentMethod`}
            label="Pago del envío (en línea)"
            placeholder={onlineMethods.length > 0 ? "Elige un método" : "Sin métodos disponibles"}
            disabled={onlineMethods.length === 0}
            options={onlineMethods.map((method) => ({ value: method.code, label: method.title }))}
          />
        ) : (
          <OlvaTextField
            name={`items.${index}.pin`}
            label="PIN de recojo (opcional)"
            hint="Se genera automáticamente si lo dejas vacío. Lo verás en el resultado después de enviar."
            inputMode="numeric"
            maxLength={OLVA_SHIPMENT_PIN_LENGTH}
            transform={onlyDigits}
            description={`${OLVA_SHIPMENT_PIN_LENGTH} dígitos`}
          />
        )}
      </div>

      {isHome ? (
        <>
          <p className="text-muted-foreground text-xs">
            La entrega a domicilio siempre se paga en línea, aunque el resto del lote pague en
            destino o en tienda.
            {headquarter && onlineMethods.length === 0
              ? " La sede de origen no tiene un método de pago en línea disponible."
              : ""}
          </p>
          <OlvaUbigeoPicker index={index} customer={customer} />
          <div className="grid gap-3 sm:grid-cols-2">
            <OlvaTextField
              name={`items.${index}.destination.address`}
              label="Dirección de entrega"
              required
            />
            <OlvaTextField
              name={`items.${index}.destination.reference`}
              label="Referencia"
              required
              description={`Mínimo ${OLVA_HOME_DELIVERY_MIN_REFERENCE_LENGTH} caracteres`}
            />
          </div>
        </>
      ) : (
        <OlvaAgencyPicker index={index} customer={customer} />
      )}
    </div>
  );
}
