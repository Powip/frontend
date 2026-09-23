/**
 * Tests: useReconciliationVariantSearch (FEAT-17 Anexo A — buscador de
 * "Buscar otra variante" de la bandeja de reconciliación)
 *
 * Comportamiento verificado:
 * 1. Con el texto (recortado) por debajo del mínimo de 2 caracteres,
 *    `isSearchable` es `false` y nunca se llama a `searchReconciliationVariants`,
 *    ni siquiera tras pasar los 300ms de debounce.
 * 2. El fetch NO se dispara antes de que transcurran los 300ms de debounce.
 * 3. Tras los 300ms, se llama a `searchReconciliationVariants` con el texto
 *    recortado y se exponen los resultados devueltos.
 * 4. El debounce se reinicia con cada cambio de `query`: si el texto cambia
 *    antes de los 300ms, sólo se termina buscando con el último valor.
 * 5. El texto se recorta (trim) antes de decidir si es buscable y antes de
 *    pasarlo al service — " ab " (2 chars útiles) sí busca (con "ab"), " a "
 *    (1 char útil) no.
 * 6. `isLoading` es `true` mientras la promesa del service está pendiente y
 *    vuelve a `false` al resolver, exponiendo los resultados.
 * 7. Si el service rechaza la promesa, expone `isError: true` y el `error`.
 *
 * Mocks aplicados:
 * - @/services/reconciliationTask.service → `searchReconciliationVariants`
 *   (única función del service que usa el hook). Nunca se ejecuta el fetch
 *   real.
 * - Debounce (300ms) controlado con `jest.useFakeTimers()` +
 *   `act(() => jest.advanceTimersByTime(...))`, mismo patrón que el resto
 *   del repo para timers dependientes de tiempo (ver
 *   SendToEvaGuideModal.test.tsx "auto-cierre tras envío bulk exitoso"):
 *   avanzar el timer fake es sólo para el `setTimeout` del debounce, la
 *   resolución de la promesa del mock (microtask) se espera con `waitFor`
 *   normalmente, sin necesidad de más avances de timer.
 */

import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useReconciliationVariantSearch } from '../useReconciliationVariantSearch';
import {
  searchReconciliationVariants,
  type VariantSearchResult,
} from '@/services/reconciliationTask.service';

// ── Mocks de infraestructura ─────────────────────────────────────────────────

jest.mock('@/services/reconciliationTask.service', () => ({
  searchReconciliationVariants: jest.fn(),
}));

const mockSearch = jest.mocked(searchReconciliationVariants);

// ── Fixtures ─────────────────────────────────────────────────────────────────

const RESULTS: VariantSearchResult[] = [
  {
    variant_id: 'variant-1',
    product_name: 'Zapatilla Roja Talla 40',
    sku: 'ZAP-ROJA-40',
    company_sku: null,
    attribute_values: { color: 'Rojo', talla: '40' },
  },
];

function buildWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  function QueryWrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  }
  QueryWrapper.displayName = 'QueryWrapper';
  return QueryWrapper;
}

// ── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe('useReconciliationVariantSearch', () => {
  describe('mínimo de 2 caracteres', () => {
    it('con 1 carácter, isSearchable es false y nunca busca (ni tras el debounce)', () => {
      mockSearch.mockResolvedValue(RESULTS);

      const { result } = renderHook(() => useReconciliationVariantSearch('a'), {
        wrapper: buildWrapper(),
      });

      act(() => {
        jest.advanceTimersByTime(300);
      });

      expect(result.current.isSearchable).toBe(false);
      expect(mockSearch).not.toHaveBeenCalled();
    });

    it('con texto vacío, isSearchable es false y nunca busca', () => {
      mockSearch.mockResolvedValue(RESULTS);

      const { result } = renderHook(() => useReconciliationVariantSearch(''), {
        wrapper: buildWrapper(),
      });

      act(() => {
        jest.advanceTimersByTime(300);
      });

      expect(result.current.isSearchable).toBe(false);
      expect(mockSearch).not.toHaveBeenCalled();
    });
  });

  describe('debounce de 300ms', () => {
    // Los 3 tests de este bloque montan el hook con `query: ''` (como
    // siempre lo hace la UI real: el input arranca vacío) y recién después
    // hacen `rerender` con el texto tipeado. Si en cambio se montara
    // directamente con el texto final, `useState(query)` inicializaría
    // `debouncedQuery` YA con ese valor y el fetch dispararía de inmediato
    // al primer render, sin pasar por el debounce que se quiere probar.

    it('no dispara el fetch antes de que transcurran los 300ms', () => {
      mockSearch.mockResolvedValue(RESULTS);

      const { rerender } = renderHook(
        ({ query }: { query: string }) => useReconciliationVariantSearch(query),
        { wrapper: buildWrapper(), initialProps: { query: '' } },
      );

      rerender({ query: 'zapatilla' });

      act(() => {
        jest.advanceTimersByTime(299);
      });

      expect(mockSearch).not.toHaveBeenCalled();
    });

    it('tras 300ms, busca con el texto y expone los resultados', async () => {
      mockSearch.mockResolvedValue(RESULTS);

      const { result, rerender } = renderHook(
        ({ query }: { query: string }) => useReconciliationVariantSearch(query),
        { wrapper: buildWrapper(), initialProps: { query: '' } },
      );

      rerender({ query: 'zapatilla' });

      act(() => {
        jest.advanceTimersByTime(300);
      });

      await waitFor(() => expect(mockSearch).toHaveBeenCalledWith('zapatilla'));
      await waitFor(() => expect(result.current.results).toEqual(RESULTS));
      expect(result.current.isSearchable).toBe(true);
    });

    it('el debounce se reinicia con cada cambio: sólo se busca con el último valor', async () => {
      mockSearch.mockResolvedValue(RESULTS);

      const { rerender } = renderHook(
        ({ query }: { query: string }) => useReconciliationVariantSearch(query),
        { wrapper: buildWrapper(), initialProps: { query: '' } },
      );

      rerender({ query: 'zapa' });
      act(() => {
        jest.advanceTimersByTime(200);
      });
      rerender({ query: 'zapatilla' });
      act(() => {
        jest.advanceTimersByTime(200);
      });

      // El cambio a los 200ms reinició el timer: a los 400ms desde que se
      // tipeó "zapa" (200 + 200) todavía no pasaron 300ms desde el último
      // cambio ("zapatilla").
      expect(mockSearch).not.toHaveBeenCalled();

      act(() => {
        jest.advanceTimersByTime(100);
      });

      await waitFor(() => expect(mockSearch).toHaveBeenCalledTimes(1));
      expect(mockSearch).toHaveBeenCalledWith('zapatilla');
    });
  });

  describe('trimming', () => {
    it('" ab " cuenta como 2 caracteres útiles y busca con el texto ya recortado', async () => {
      mockSearch.mockResolvedValue(RESULTS);

      const { result } = renderHook(() => useReconciliationVariantSearch('  ab  '), {
        wrapper: buildWrapper(),
      });

      act(() => {
        jest.advanceTimersByTime(300);
      });

      expect(result.current.isSearchable).toBe(true);
      await waitFor(() => expect(mockSearch).toHaveBeenCalledWith('ab'));
    });

    it('"  a  " (1 carácter útil) no llega al mínimo y no busca', () => {
      mockSearch.mockResolvedValue(RESULTS);

      const { result } = renderHook(() => useReconciliationVariantSearch('  a  '), {
        wrapper: buildWrapper(),
      });

      act(() => {
        jest.advanceTimersByTime(300);
      });

      expect(result.current.isSearchable).toBe(false);
      expect(mockSearch).not.toHaveBeenCalled();
    });
  });

  describe('isLoading', () => {
    it('es true mientras la búsqueda está en curso y vuelve a false al resolver', async () => {
      let resolveSearch!: (value: VariantSearchResult[]) => void;
      mockSearch.mockReturnValue(
        new Promise((resolve) => {
          resolveSearch = resolve;
        }),
      );

      const { result } = renderHook(() => useReconciliationVariantSearch('zapatilla'), {
        wrapper: buildWrapper(),
      });

      act(() => {
        jest.advanceTimersByTime(300);
      });

      await waitFor(() => expect(result.current.isLoading).toBe(true));

      resolveSearch(RESULTS);

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.results).toEqual(RESULTS);
    });
  });

  describe('error', () => {
    it('expone isError true y el error cuando el service rechaza', async () => {
      mockSearch.mockRejectedValue(new Error('Error del servidor'));

      const { result } = renderHook(() => useReconciliationVariantSearch('zapatilla'), {
        wrapper: buildWrapper(),
      });

      act(() => {
        jest.advanceTimersByTime(300);
      });

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error).toBeInstanceOf(Error);
      expect(result.current.results).toEqual([]);
    });
  });
});
