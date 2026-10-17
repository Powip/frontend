"use client";
import Image from "next/image";
import axios from "axios";
import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { advertisingOrdersApiBase } from "@/services/advertisingOrdersService";
import { adsOptions } from "@/services/advertisingV22Service";

export function AdvertisingAttributionSelect({
  storeId,
  value,
  onChange,
}: {
  storeId: string | null | undefined;
  value: string;
  onChange: (value: string) => void;
}) {
  const { auth } = useAuth();
  const previousStore = useRef(storeId);
  useEffect(() => {
    if (previousStore.current !== storeId) {
      previousStore.current = storeId;
      onChange("");
    }
  }, [storeId, onChange]);
  const query = useQuery({
    queryKey: ["advertising-attribution-candidates", auth?.user.id, auth?.company?.id, storeId],
    queryFn: async ({ signal }) =>
      (
        await axios.get<{
          storeId: string;
          windowDays: number;
          rows: Array<{
            adId: string;
            accountId: string;
            name: string;
            thumbnailUrl: string | null;
          }>;
        }>(`${advertisingOrdersApiBase()}/order-header/sale/attribution-candidates`, {
          ...adsOptions(auth!.accessToken!, signal),
          params: { storeId },
        })
      ).data,
    enabled: !!auth?.accessToken && !!auth.company?.id && !!storeId,
    retry: false,
    gcTime: 0,
    staleTime: 0,
  });
  const rows =
    !query.data || query.isError || query.data.storeId !== storeId ? [] : query.data.rows;
  const selected = rows.find((row) => row.adId === value);
  return (
    <div className="space-y-2">
      <label htmlFor="sale-ad-attribution" className="text-sm font-medium">
        ¿De qué anuncio vino? <span className="font-normal text-muted-foreground">(opcional)</span>
      </label>
      <select
        id="sale-ad-attribution"
        className="h-10 w-full rounded-md border bg-background px-3 text-sm"
        value={value}
        disabled={!storeId || query.isPending}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">
          {!storeId
            ? "Selecciona primero la tienda"
            : query.isPending
              ? "Cargando anuncios…"
              : "Sin anuncio identificado"}
        </option>
        {rows.map((row) => (
          <option key={row.adId} value={row.adId}>
            {row.name}
          </option>
        ))}
      </select>
      {selected && (
        <div className="flex items-center gap-3 rounded-md border p-2">
          {selected.thumbnailUrl && (
            <Image
              className="size-14 rounded object-cover"
              src={selected.thumbnailUrl}
              alt={`Miniatura de ${selected.name}`}
              width={56}
              height={56}
              unoptimized
            />
          )}
          <span className="text-sm">{selected.name}</span>
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        Solo anuncios de esta tienda con gasto en los últimos 7 días.
      </p>
      {query.isError && (
        <p role="status" className="text-xs text-amber-700">
          No pudimos consultar los anuncios. Puedes registrar la venta sin atribución y revisarla
          después.
        </p>
      )}
    </div>
  );
}
