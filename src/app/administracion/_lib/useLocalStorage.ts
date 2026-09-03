"use client";

/**
 * Persistencia temporal en localStorage — solución puente mientras no existe
 * backend para inversión de pauta ni metas (ver `pautaStorage.ts` y
 * `metasStorage.ts`). Vive solo en el navegador/dispositivo donde se
 * registra: no se sincroniza entre usuarios ni entre dispositivos. Cuando
 * exista el endpoint real, reemplazar el uso de este hook por
 * queries/mutations de React Query, igual que el resto del módulo.
 */

import { useEffect, useState } from "react";

export function useLocalStorageState<T>(key: string, initial: T) {
  const [state, setState] = useState<T>(initial);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(false);
    try {
      const raw = window.localStorage.getItem(key);
      setState(raw != null ? (JSON.parse(raw) as T) : initial);
    } catch {
      setState(initial);
    } finally {
      setHydrated(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(key, JSON.stringify(state));
    } catch {
      // localStorage lleno, bloqueado (modo privado) o inaccesible — el
      // dato no persiste, pero la UI sigue funcionando con el valor en memoria.
    }
  }, [key, state, hydrated]);

  return [state, setState, hydrated] as const;
}
