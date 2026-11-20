"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { ShalomAgencyField } from "@/components/shalom/ShalomAgencyField";
import { hasAgencyLocation, type AgencyLocation } from "@/components/shalom/shalomAgencyLocation";
import { commercialLeadError } from "@/services/commercialLeadsService";
import { saveOrderShalomAgency } from "@/services/orderDeliveryService";
import type { ShalomAgencyOption } from "@/services/shalomService";

/** Datos que la pantalla del pedido da a la tarjeta para ofrecer la agencia Shalom. */
export interface CcShalomAgencyOptions {
  /** Departamento, provincia y distrito del pedido. */
  location: AgencyLocation;
  /** Agencia ya guardada en el pedido, si hay. */
  current?: string | null;
  /** El pedido tiene dirección propia: sin ella el backend no guarda la agencia. */
  editable: boolean;
}

interface Props extends CcShalomAgencyOptions {
  orderId: string;
  disabled?: boolean;
  onSaved: () => void;
}

/** Selector OPCIONAL de agencia Shalom de la tarjeta Gestión CC. Elegir una la guarda en el pedido. */
export function CcShalomAgencyPicker({ orderId, location, current, editable, disabled, onSaved }: Props) {
  const [apiName, setApiName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const shown = saved ?? current?.trim() ?? "";

  if (!hasAgencyLocation(location) || !editable) {
    return (
      <div className="space-y-1">
        <Label className="text-sm font-bold">Agencia Shalom (opcional)</Label>
        <p className="text-muted-foreground">
          {!hasAgencyLocation(location)
            ? "Primero completa la ciudad del pedido (departamento, provincia y distrito) para elegir una agencia."
            : "Este pedido no tiene dirección propia: no se puede guardar una agencia."}
        </p>
        {shown ? <p>Agencia actual: <span className="font-medium">{shown}</span></p> : null}
      </div>
    );
  }

  async function choose(agency: ShalomAgencyOption) {
    const label = `Shalom — ${agency.nombre_agencia}`.slice(0, 150);
    setSaving(true);
    try {
      await saveOrderShalomAgency(orderId, label);
      setApiName(agency.api_name);
      setSaved(label);
      toast.success("Agencia Shalom guardada en el pedido.");
      onSaved();
    } catch (error) {
      toast.error(commercialLeadError(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-1">
      <ShalomAgencyField
        label="Agencia Shalom (opcional)"
        selectedAgency={apiName}
        onSelect={(agency) => void choose(agency)}
        onClear={() => setApiName("")}
        location={location}
        disabled={disabled || saving}
      />
      {shown ? <p>Agencia actual: <span className="font-medium">{shown}</span></p> : null}
    </div>
  );
}
