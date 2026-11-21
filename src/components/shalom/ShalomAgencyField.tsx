"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { ShalomAgencyOption } from "@/services/shalomService";
import { ShalomAgencySelector } from "@/components/shalom/ShalomAgencySelector";
import {
  AGENCY_SEARCH_MIN_CHARS,
  normalizeAgencyQuery,
  useShalomAgencySearch,
} from "@/components/shalom/useShalomAgencySearch";
import {
  agencyLocationKey,
  filterAgenciesByLocation,
  hasAgencyLocation,
  type AgencyLocation,
} from "@/components/shalom/shalomAgencyLocation";

/** Tope de opciones en el desplegable: el catálogo completo tiene cientos de agencias. */
export const SHALOM_AGENCY_FIELD_MAX_OPTIONS = 100;

const CATALOG_KEY = "catalog";
const SEARCH_KEY = "search";

interface ShalomAgencyFieldProps {
  label: string;
  /** `api_name` de la agencia elegida ("" si no hay). */
  selectedAgency: string;
  onSelect: (agency: ShalomAgencyOption) => void;
  /** La agencia elegida dejó de aplicar porque cambió la ubicación del cliente. */
  onClear?: () => void;
  /** Ubicación del cliente: si la tiene, la lista se limita a las agencias de esa zona. */
  location?: AgencyLocation;
  disabled?: boolean;
  /** Marca el campo como faltante mientras no haya agencia elegida. */
  required?: boolean;
}

/**
 * Buscador de agencias Shalom autónomo. Carga el catálogo al mostrarse y, si el cliente ya tiene
 * ubicación, muestra solo las agencias de su distrito (si no hay, de su provincia; si no, de su
 * departamento), con un control para ver todas. Viendo todas busca mientras se escribe, con la
 * misma espera y caché que el modal «Enviar a Shalom».
 */
export function ShalomAgencyField({
  label,
  selectedAgency,
  onSelect,
  onClear,
  location,
  disabled,
  required,
}: ShalomAgencyFieldProps) {
  const [search, setSearch] = useState("");
  const [catalog, setCatalog] = useState<ShalomAgencyOption[]>([]);
  const [found, setFound] = useState<ShalomAgencyOption[]>([]);
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [showAll, setShowAll] = useState(false);

  const { fetchAgencies, scheduleFetchAgencies } = useShalomAgencySearch(
    {
      onLoading: (key, value) => setLoading((prev) => ({ ...prev, [key]: value })),
      onResult: (key, result) => (key === CATALOG_KEY ? setCatalog(result) : setFound(result)),
    },
    { catalogWhenEmpty: true },
  );

  useEffect(() => {
    void fetchAgencies("", CATALOG_KEY);
  }, [fetchAgencies]);

  const locationKey = agencyLocationKey(location);
  const located = useMemo(
    () => filterAgenciesByLocation(catalog, location),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `locationKey` resume `location`
    [catalog, locationKey],
  );
  const canFilter = hasAgencyLocation(location) && located.level !== "none";
  const filtering = canFilter && !showAll;

  // Cambió la dirección del cliente: se vuelve a filtrar y la agencia elegida se limpia si ya no
  // corresponde a la nueva ubicación.
  const previousLocationKey = useRef(locationKey);
  useEffect(() => {
    if (previousLocationKey.current === locationKey) return;
    previousLocationKey.current = locationKey;
    setShowAll(false);
    setSearch("");
    if (
      selectedAgency &&
      catalog.length > 0 &&
      hasAgencyLocation(location) &&
      !located.agencies.some((agency) => agency.api_name === selectedAgency)
    ) {
      onClear?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo reacciona al cambio de ubicación
  }, [locationKey]);

  const term = normalizeAgencyQuery(search);
  const matchesTerm = (agency: ShalomAgencyOption) =>
    [agency.nombre_agencia, agency.api_name, agency.direccion].some((text) =>
      normalizeAgencyQuery(text).includes(term),
    );
  const localMatches = useMemo(
    () => (filtering && term ? located.agencies.filter(matchesTerm) : located.agencies),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `matchesTerm` solo depende de `term`
    [filtering, term, located],
  );
  // Lo escrito no coincide con ninguna agencia de la zona del cliente (por ejemplo, el cliente vive
  // en un distrito y recoge en otro): se busca en todo el catálogo en vez de mostrar la lista vacía.
  const widened = filtering && !!term && localMatches.length === 0;
  const list = useMemo(() => {
    if (widened) return catalog.filter(matchesTerm);
    if (filtering) return localMatches;
    return search.length >= AGENCY_SEARCH_MIN_CHARS ? found : catalog;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `matchesTerm` solo depende de `term`
  }, [widened, filtering, term, search, localMatches, found, catalog]);

  const visible = useMemo(() => {
    const top = list.slice(0, SHALOM_AGENCY_FIELD_MAX_OPTIONS);
    // La agencia elegida siempre queda entre las opciones, aunque el filtro o el tope la dejen fuera.
    const chosen = selectedAgency
      ? (list.find((a) => a.api_name === selectedAgency) ?? catalog.find((a) => a.api_name === selectedAgency))
      : undefined;
    return chosen && !top.includes(chosen) ? [chosen, ...top] : top;
  }, [list, catalog, selectedAgency]);

  const place =
    located.level === "district"
      ? `del distrito ${location?.district?.trim()}`
      : located.level === "province"
        ? `de la provincia ${location?.province?.trim()}`
        : `del departamento ${location?.department?.trim()}`;
  const zone =
    located.level === "district"
      ? `en el distrito ${location?.district?.trim()}`
      : located.level === "province"
        ? `en la provincia ${location?.province?.trim()}`
        : `en el departamento ${location?.department?.trim()}`;
  const fallbackNote =
    located.level !== "district" && location?.district?.trim()
      ? `No hay agencias en ${location.district.trim()}. `
      : "";

  return (
    <div className="space-y-1">
      <ShalomAgencySelector
        label={label}
        agencyLabel="Agencia"
        searchPlaceholder="Distrito, provincia o nombre de agencia"
        agencies={visible}
        searchValue={search}
        selectedAgency={selectedAgency}
        onSearchChange={(value) => {
          setSearch(value);
          if (!filtering) scheduleFetchAgencies(value, SEARCH_KEY);
        }}
        onAgencyChange={(apiName) => {
          const agency = visible.find((a) => a.api_name === apiName);
          if (agency) onSelect(agency);
        }}
        isLoadingAgencies={!!loading[CATALOG_KEY] || (!filtering && !!loading[SEARCH_KEY])}
        error={required}
        disabled={disabled}
      />
      {canFilter && (
        <div className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
          <span>
            {showAll
              ? "Mostrando todas las agencias."
              : widened
                ? list.length > 0
                  ? `No hay agencias con «${search.trim()}» ${zone}. Mostrando coincidencias de todas las agencias (${list.length}).`
                  : `No hay agencias con «${search.trim()}» ${zone} ni en el resto de agencias.`
                : `${fallbackNote}Mostrando las agencias ${place} (${located.agencies.length}).`}
          </span>
          <Button
            type="button"
            variant="link"
            size="sm"
            className="h-auto p-0 text-xs"
            disabled={disabled}
            onClick={() => {
              setShowAll((value) => !value);
              setSearch("");
            }}
          >
            {showAll ? "Ver solo las de la ubicación del cliente" : "Ver todas las agencias"}
          </Button>
        </div>
      )}
      {hasAgencyLocation(location) && located.level === "none" && catalog.length > 0 && (
        <p className="text-xs text-muted-foreground">
          No hay agencias Shalom para la ubicación del cliente. Se muestran todas.
        </p>
      )}
      {list.length > SHALOM_AGENCY_FIELD_MAX_OPTIONS && (
        <p className="text-xs text-muted-foreground">
          Mostrando {SHALOM_AGENCY_FIELD_MAX_OPTIONS} de {list.length} agencias. Escribe para acotar la búsqueda.
        </p>
      )}
    </div>
  );
}
