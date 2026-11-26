"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { findOlvaPaymentModality } from "@/features/olva/olva-catalog/utils/find-olva-payment-modality";
import { getOlvaAvailableWhoPays } from "@/features/olva/olva-catalog/utils/get-olva-available-who-pays";
import { useOlvaSenderProfiles } from "@/features/olva/olva-sender-profile/hooks/use-olva-sender-profiles";
import {
  OLVA_PAYMENT_METHODS,
  OLVA_WHO_PAYS_OPTIONS,
  type OlvaPaymentMethod,
  type OlvaWhoPays,
} from "@/features/olva/shared/constants/olva-enums.constants";
import { useOlvaLotSettings } from "../hooks/use-olva-lot-settings";
import { useSelectedOlvaHeadquarter } from "../hooks/use-selected-olva-headquarter";
import { deriveOlvaLotPayer } from "../utils/derive-olva-lot-payer";
import {
  filterAvailableOlvaModalities,
  filterAvailableOlvaPaymentMethods,
} from "../utils/olva-payment-methods";
import type { SendToOlvaFormValues } from "./fields/olva-form-types";
import { OlvaSelectField } from "./fields/olva-select-field";

const OLVA_SETTINGS_HREF = "/configuracion/integraciones/olva";
const DEFAULT_SENDER_LABEL = "Remitente predeterminado";

const isWhoPays = (value: string): value is OlvaWhoPays =>
  Object.values(OLVA_WHO_PAYS_OPTIONS).includes(value as OlvaWhoPays);

const isPaymentMethod = (value: string): value is OlvaPaymentMethod =>
  Object.values(OLVA_PAYMENT_METHODS).includes(value as OlvaPaymentMethod);

/**
 * What is shared by the whole lot: who sends it, where it leaves from and how the store pickups
 * are paid. Home deliveries are always paid online with a method of their own (in their row), so
 * the payer here only governs pickups and is bound to the first pickup row.
 */
export function OlvaSenderSection() {
  const { control } = useFormContext<SendToOlvaFormValues>();
  const profiles = useOlvaSenderProfiles();
  const { headquarters, headquarterId, headquarter } = useSelectedOlvaHeadquarter();
  const { applyOrigin, applyWhoPays, applyPaymentMethod } = useOlvaLotSettings();
  const items = useWatch({ control, name: "items" });
  const lotPayer = deriveOlvaLotPayer(items ?? []);
  const whoPays = lotPayer?.whoPays;
  const onlyHeadquarter = headquarters.data?.length === 1 ? headquarters.data[0] : undefined;

  const modalities = headquarter
    ? filterAvailableOlvaModalities(getOlvaAvailableWhoPays(headquarter))
    : [];
  const onlyModality = modalities.length === 1 ? modalities[0] : undefined;
  const hasLotPayer = Boolean(lotPayer);

  // With a single origin there is nothing to choose
  useEffect(() => {
    if (onlyHeadquarter && !headquarterId) applyOrigin(onlyHeadquarter.id);
  }, [onlyHeadquarter, headquarterId, applyOrigin]);

  // With a single way to pay (today: at the destination) there is nothing to choose either
  useEffect(() => {
    if (hasLotPayer && !whoPays && onlyModality && isWhoPays(onlyModality.code)) {
      applyWhoPays(onlyModality.code);
    }
  }, [hasLotPayer, whoPays, onlyModality, applyWhoPays]);

  if (profiles.isPending || headquarters.isPending) return <Skeleton className="h-32 w-full" />;

  if (profiles.isError || headquarters.isError) {
    return (
      <Alert variant="destructive">
        <AlertTitle>No se pudo cargar la configuración de Olva</AlertTitle>
        <AlertDescription>
          Cierra y vuelve a abrir este panel para intentarlo de nuevo.
        </AlertDescription>
      </Alert>
    );
  }

  if (profiles.data.length === 0) {
    return (
      <Alert>
        <AlertTitle>Aún no tienes un remitente</AlertTitle>
        <AlertDescription>
          Olva necesita un remitente para registrar envíos.{" "}
          <Link href={OLVA_SETTINGS_HREF} className="font-medium underline">
            Crear remitente
          </Link>
        </AlertDescription>
      </Alert>
    );
  }

  const modality =
    headquarter && whoPays ? findOlvaPaymentModality(headquarter, whoPays) : undefined;

  return (
    <Card>
      <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <OlvaSelectField
          name="senderProfileId"
          label="Remitente"
          emptyLabel={DEFAULT_SENDER_LABEL}
          clearToUndefined
          options={profiles.data.map((profile) => ({
            value: profile.id,
            label: `${profile.label}${profile.isDefault ? " (predeterminado)" : ""}`,
          }))}
        />
        <OlvaSelectField
          name="items.0.origin.headquarterId"
          label="Sede de origen"
          placeholder="Elige la sede"
          options={headquarters.data.map((item) => ({
            value: item.id,
            label: item.headquarterName,
          }))}
          onValueChange={applyOrigin}
        />
        {lotPayer ? (
          <OlvaSelectField
            name={`items.${lotPayer.index}.whoPays`}
            label="¿Quién paga el envío?"
            placeholder={headquarterId ? "Elige quién paga" : "Primero elige la sede"}
            disabled={!headquarter}
            options={modalities.map((item) => ({ value: item.code, label: item.title }))}
            onValueChange={(value) => isWhoPays(value) && applyWhoPays(value)}
          />
        ) : (
          <p className="text-muted-foreground text-sm sm:col-span-2">
            Todo el lote es entrega a domicilio: se paga en línea, con el método de cada pedido.
          </p>
        )}
        {lotPayer && modality?.requiresPaymentMethod ? (
          <OlvaSelectField
            name={`items.${lotPayer.index}.paymentMethod`}
            label="Método de pago"
            placeholder="Elige un método"
            options={filterAvailableOlvaPaymentMethods(modality.paymentMethods).map((method) => ({
              value: method.code,
              label: method.title,
            }))}
            onValueChange={(value) => isPaymentMethod(value) && applyPaymentMethod(value)}
          />
        ) : null}
      </CardContent>
    </Card>
  );
}
