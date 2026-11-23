"use client";

import React, { useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { extractLatLngFromGoogleMapsUrl } from "@/lib/googleMapsCoords";
import { saveAliclikDestinationCoordinates } from "@/services/orderDeliveryService";

export interface AliclikMissingCoordsFormProps {
  /** Prefijo para los ids de los inputs (un formulario por pedido en la guía). */
  idPrefix: string;
  orderId: string;
  companyId: string;
  /** Cliente del pedido si se conoce; si no, se toma el de la venta. */
  clientId?: string;
  /** Deshabilita el formulario mientras el padre vuelve a cotizar. */
  disabled?: boolean;
  /** Se llama después de guardar las coordenadas, para volver a cotizar solo este pedido. */
  onSaved: () => Promise<void> | void;
}

/**
 * Formulario que aparece cuando Aliclik no puede cotizar porque el pedido no tiene coordenadas.
 * Acepta un link de Google Maps (llena lat/lng) o lat/lng a mano. Guarda en el pedido o en el
 * cliente con el flujo existente y luego pide al padre que vuelva a cotizar.
 */
export default function AliclikMissingCoordsForm({
  idPrefix,
  orderId,
  companyId,
  clientId,
  disabled,
  onSaved,
}: AliclikMissingCoordsFormProps) {
  const [mapsLink, setMapsLink] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [saving, setSaving] = useState(false);

  const latNum = parseFloat(lat);
  const lngNum = parseFloat(lng);
  const valid =
    lat.trim() !== "" &&
    lng.trim() !== "" &&
    !Number.isNaN(latNum) &&
    !Number.isNaN(lngNum) &&
    latNum !== 0 &&
    lngNum !== 0;
  const mapsLinkCoords = mapsLink.trim() ? extractLatLngFromGoogleMapsUrl(mapsLink) : null;

  const handleMapsLinkChange = (value: string) => {
    setMapsLink(value);
    const coords = value.trim() ? extractLatLngFromGoogleMapsUrl(value) : null;
    if (coords) {
      setLat(String(coords.lat));
      setLng(String(coords.lng));
    }
  };

  const handleSave = async () => {
    if (!companyId || !valid) return;
    setSaving(true);
    try {
      await saveAliclikDestinationCoordinates(orderId, companyId, clientId, latNum, lngNum);
    } catch {
      toast.error(
        "No se pudieron guardar las coordenadas de entrega del cliente. Revisa los datos del pedido y vuelve a intentar.",
      );
      setSaving(false);
      return;
    }
    setMapsLink("");
    setLat("");
    setLng("");
    try {
      await onSaved();
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    "h-8 text-sm bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 dark:text-slate-100";
  const labelClass = "text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase";

  return (
    <div
      className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg"
      data-testid={`${idPrefix}-missing-coords`}
    >
      <p className="text-xs font-bold text-amber-800 dark:text-amber-400 mb-1 flex items-center gap-1.5">
        <AlertCircle className="h-3.5 w-3.5 shrink-0" />
        Faltan las coordenadas de entrega. Aliclik no cotiza sin ellas.
      </p>
      <p className="text-[11px] text-amber-700 dark:text-amber-500 mb-2">
        Pega el link de Google Maps de la ubicación o escribe la latitud y longitud. Luego pulsa
        «Guardar y volver a cotizar».
      </p>
      <div className="space-y-1 mb-2">
        <Label htmlFor={`${idPrefix}-maps-link`} className={labelClass}>
          Link de Google Maps
        </Label>
        <Input
          id={`${idPrefix}-maps-link`}
          type="url"
          placeholder="https://www.google.com/maps/place/...@-12.04,-77.04,17z"
          value={mapsLink}
          onChange={(e) => handleMapsLinkChange(e.target.value)}
          className={inputClass}
        />
        {mapsLink.trim() && !mapsLinkCoords && (
          <p className="text-[10px] text-red-500">
            No se pudieron leer coordenadas de este link. Abre el link en el navegador y copia el
            link largo, o escribe la latitud y longitud.
          </p>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label htmlFor={`${idPrefix}-lat`} className={labelClass}>
            Latitud <span className="text-red-500">*</span>
          </Label>
          <Input
            id={`${idPrefix}-lat`}
            type="text"
            inputMode="decimal"
            placeholder="-12.046374"
            value={lat}
            onChange={(e) => setLat(e.target.value)}
            className={cn(inputClass, lat.trim() && Number.isNaN(latNum) ? "border-red-400" : "")}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${idPrefix}-lng`} className={labelClass}>
            Longitud <span className="text-red-500">*</span>
          </Label>
          <Input
            id={`${idPrefix}-lng`}
            type="text"
            inputMode="decimal"
            placeholder="-77.042793"
            value={lng}
            onChange={(e) => setLng(e.target.value)}
            className={cn(inputClass, lng.trim() && Number.isNaN(lngNum) ? "border-red-400" : "")}
          />
        </div>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="mt-2"
        disabled={!valid || saving || disabled}
        onClick={handleSave}
      >
        {saving && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
        Guardar y volver a cotizar
      </Button>
    </div>
  );
}
