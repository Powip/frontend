import { useCallback, useEffect, useRef } from "react";
import {
  fetchShalomAgencyOptions,
  type ShalomAgencyOption,
} from "@/services/shalomService";

/** Espera tras la última tecla antes de buscar agencias (evita una llamada por tecla). */
export const AGENCY_SEARCH_DEBOUNCE_MS = 400;

/** Mínimo de letras para buscar por término. */
export const AGENCY_SEARCH_MIN_CHARS = 3;

/** Término de agencia normalizado: sin tildes, sin espacios extra, en minúsculas. */
export const normalizeAgencyQuery = (q: string): string =>
  q.normalize("NFD").replace(/\p{M}/gu, "").trim().replace(/\s+/g, " ").toLowerCase();

interface AgencySearchHandlers {
  /** `key` identifica al buscador (por ejemplo "origin" o el id de un pedido). */
  onLoading: (key: string, loading: boolean) => void;
  onResult: (key: string, agencies: ShalomAgencyOption[]) => void;
}

interface AgencySearchOptions {
  /** Con el término vacío trae el catálogo completo (GET /shalom/agencies) en vez de no hacer nada. */
  catalogWhenEmpty?: boolean;
}

/**
 * Búsqueda de agencias Shalom compartida (modal «Enviar a Shalom» y Registrar venta), sin saturar
 * a Shalom: caché por término mientras el componente vive, llamadas simultáneas compartidas y
 * espera a que se deje de tipear. Varios buscadores pueden convivir; cada uno usa su `key`.
 */
export function useShalomAgencySearch(
  handlers: AgencySearchHandlers,
  { catalogWhenEmpty = false }: AgencySearchOptions = {},
) {
  // Los handlers se leen por ref: `fetchAgencies` queda estable aunque el padre los recree.
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  // Caché por término normalizado ("" = catálogo). Guarda la promesa, así dos buscadores que
  // piden lo mismo a la vez comparten la llamada.
  const cacheRef = useRef(new Map<string, Promise<ShalomAgencyOption[] | null>>());
  // Último término pedido por cada buscador: una respuesta vieja que llega tarde no pisa la actual.
  const latestQueryRef = useRef<Record<string, string>>({});
  const timersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      Object.values(timers).forEach(clearTimeout);
    };
  }, []);

  const canSearch = useCallback(
    (q: string) =>
      (!!q && q.length >= AGENCY_SEARCH_MIN_CHARS) || (catalogWhenEmpty && !q.trim()),
    [catalogWhenEmpty],
  );

  const fetchAgencies = useCallback(
    async (q: string, key: string) => {
      if (!canSearch(q)) return;
      const term = normalizeAgencyQuery(q);
      latestQueryRef.current[key] = term;
      const isLatest = () => latestQueryRef.current[key] === term;

      let request = cacheRef.current.get(term);
      if (!request) {
        request = fetchShalomAgencyOptions(q);
        cacheRef.current.set(term, request);
        // Un fallo no se guarda: el próximo intento vuelve a consultar.
        request.then(
          (agencies) => {
            if (agencies === null) cacheRef.current.delete(term);
          },
          () => cacheRef.current.delete(term),
        );
      }

      handlersRef.current.onLoading(key, true);
      try {
        const agencies = await request;
        if (agencies && isLatest()) handlersRef.current.onResult(key, agencies);
      } catch (error) {
        console.error(error);
      } finally {
        if (isLatest()) handlersRef.current.onLoading(key, false);
      }
    },
    [canSearch],
  );

  /** Búsqueda mientras se escribe: espera a que se deje de tipear (no una llamada por tecla). */
  const scheduleFetchAgencies = useCallback(
    (q: string, key: string) => {
      const timers = timersRef.current;
      if (timers[key]) clearTimeout(timers[key]);
      if (!canSearch(q)) return;
      timers[key] = setTimeout(() => {
        delete timers[key];
        void fetchAgencies(q, key);
      }, AGENCY_SEARCH_DEBOUNCE_MS);
    },
    [canSearch, fetchAgencies],
  );

  return { fetchAgencies, scheduleFetchAgencies };
}
