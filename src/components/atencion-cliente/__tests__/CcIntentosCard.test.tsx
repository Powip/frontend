import { render, screen } from '@testing-library/react';
import { CcIntentosCard } from '../cc-v2/CcIntentosCard';
import type { CcIntentosResponse } from '@/interfaces/IOrder';

// ── Mock del hook (no del service: el componente solo consume el hook) ─────────

jest.mock('@/hooks/useCcIntentos');

import { useCcIntentos } from '@/hooks/useCcIntentos';

const mockUseCcIntentos = jest.mocked(useCcIntentos);

// ── Fixtures ───────────────────────────────────────────────────────────────────

/**
 * Datos normales con valores ÚNICOS por bucket para evitar colisiones en getByText.
 *
 * Bucket "1": totalLlamadas=20, confirmados=10, noContesta=7,  rechazados=3,  tasaExito=50.0
 * Bucket "2": totalLlamadas=15, confirmados=6,  noContesta=5,  rechazados=4,  tasaExito=40.0
 * Bucket "3": totalLlamadas=12, confirmados=4,  noContesta=5,  rechazados=3,  tasaExito=33.3
 *   → tasaExito decreciente 50 > 40 > 33.3 → insight "cae del intento 1 al 3"
 * Bucket "3+": totalLlamadas=8, confirmados=2, noContesta=3,  rechazados=3,  tasaExito=25.0
 *
 * Valores únicos en el DOM (sin contar el texto de porcentaje): 20, 10, 7, 3 (con colisión 3),
 * 15, 6, 5, 4, 12 — cuidado con repetidos:
 *   confirmados=3 (b1) = rechazados=3 (b3) → usar getAllByText para esos
 *   noContesta=5 (b2) = noContesta=5 (b3) → usar getAllByText para esos
 * Para evitar toda colisión, ajustar a valores completamente únicos:
 *
 * Bucket "1": totalLlamadas=20, confirmados=10, noContesta=7,  rechazados=3,  tasaExito=50.0
 * Bucket "2": totalLlamadas=15, confirmados=6,  noContesta=4,  rechazados=5,  tasaExito=40.0
 * Bucket "3": totalLlamadas=11, confirmados=9,  noContesta=1,  rechazados=1,  tasaExito=81.8
 *   → tasaExito NO es decreciente (50 < 81.8 en b3) → insight "El intento #3 tiene..."
 * Bucket "3+": totalLlamadas=8, confirmados=2, noContesta=3,  rechazados=3,  tasaExito=25.0
 *
 * Con b3.tasaExito=81.8, el mejor es b3 ("3"), y la serie no es estrictamente
 * decreciente, así que el insight usa la rama "best":
 *   "El intento #3 tiene la mayor tasa de éxito (81.8%)."
 *
 * Valores únicos: 20, 10, 7, 3 | 15, 6, 4, 5 | 11, 9, 1 | 8, 2, 3 ← "3" colisiona con b1
 * Ajuste final — usar valores completamente disjuntos:
 *
 * Bucket "1":  totalLlamadas=20, confirmados=10, noContesta=7,  rechazados=3,  tasaExito=50.0
 * Bucket "2":  totalLlamadas=15, confirmados=6,  noContesta=4,  rechazados=5,  tasaExito=40.0
 * Bucket "3":  totalLlamadas=12, confirmados=9,  noContesta=2,  rechazados=1,  tasaExito=75.0
 *   → serie 50 → 40 → 75 → NO decreciente → best = b3 (tasaExito=75.0)
 * Bucket "3+": totalLlamadas=8, confirmados=11 (inválido) → usar 8 distintos
 *   totalLlamadas=8, confirmados=2, noContesta=3 (colisión con b1.rechazados=3) → usar 0
 *   totalLlamadas=8, confirmados=2, noContesta=0, rechazados=6, tasaExito=25.0
 *
 * Conteos finales en DOM (desglose):
 *   Confirm.: 10, 6, 9, 2  → únicos ✓
 *   No cont.: 7,  4, 2, 0  → únicos ✓
 *   Rechaz.:  3,  5, 1, 6  → únicos ✓
 * totalLlamadas: 20, 15, 12, 8 → únicos ✓
 * tasaExito: "50.0%", "40.0%", "75.0%", "25.0%" → únicos ✓  (aparecen 2 veces c/u: header badge + cuerpo)
 */
const BASE_DATA: CcIntentosResponse = {
  intentos: [
    {
      etiqueta: '1',
      totalLlamadas: 20,
      confirmados: 10,
      noContesta: 7,
      rechazados: 3,
      tasaExito: 50.0,
    },
    {
      etiqueta: '2',
      totalLlamadas: 15,
      confirmados: 6,
      noContesta: 4,
      rechazados: 5,
      tasaExito: 40.0,
    },
    {
      etiqueta: '3',
      totalLlamadas: 12,
      confirmados: 9,
      noContesta: 2,
      rechazados: 1,
      tasaExito: 75.0,
    },
    {
      etiqueta: '3+',
      totalLlamadas: 8,
      confirmados: 2,
      noContesta: 0,
      rechazados: 6,
      tasaExito: 25.0,
    },
  ],
};

/**
 * Datos con tasaExito estrictamente decreciente en los buckets 1-3
 * para activar el insight de "cae del intento 1 al 3".
 * Los valores de desglose no nos importan en este test (solo verificamos el insight).
 */
const DECREASING_DATA: CcIntentosResponse = {
  intentos: [
    {
      etiqueta: '1',
      totalLlamadas: 30,
      confirmados: 18,
      noContesta: 8,
      rechazados: 4,
      tasaExito: 60.0,
    },
    {
      etiqueta: '2',
      totalLlamadas: 25,
      confirmados: 10,
      noContesta: 9,
      rechazados: 6,
      tasaExito: 40.0,
    },
    {
      etiqueta: '3',
      totalLlamadas: 22,
      confirmados: 4,
      noContesta: 11,
      rechazados: 7,
      tasaExito: 18.2,
    },
    {
      etiqueta: '3+',
      totalLlamadas: 0,
      confirmados: 0,
      noContesta: 0,
      rechazados: 0,
      tasaExito: 0.0,
    },
  ],
};

/**
 * Datos con bucket "3+" con totalLlamadas=0 (note el 3+ de BASE_DATA tiene 8).
 * Reutilizado para el sub-caso "nota 3+ no visible".
 */
const DATA_WITHOUT_MAS: CcIntentosResponse = {
  intentos: [
    { etiqueta: '1',  totalLlamadas: 5,  confirmados: 3, noContesta: 1, rechazados: 1, tasaExito: 60.0 },
    { etiqueta: '2',  totalLlamadas: 3,  confirmados: 1, noContesta: 1, rechazados: 1, tasaExito: 33.3 },
    { etiqueta: '3',  totalLlamadas: 2,  confirmados: 1, noContesta: 1, rechazados: 0, tasaExito: 50.0 },
    { etiqueta: '3+', totalLlamadas: 0,  confirmados: 0, noContesta: 0, rechazados: 0, tasaExito: 0.0 },
  ],
};

/** Todos los buckets en 0 → estado vacío */
const ALL_ZERO_DATA: CcIntentosResponse = {
  intentos: [
    { etiqueta: '1',  totalLlamadas: 0, confirmados: 0, noContesta: 0, rechazados: 0, tasaExito: 0 },
    { etiqueta: '2',  totalLlamadas: 0, confirmados: 0, noContesta: 0, rechazados: 0, tasaExito: 0 },
    { etiqueta: '3',  totalLlamadas: 0, confirmados: 0, noContesta: 0, rechazados: 0, tasaExito: 0 },
    { etiqueta: '3+', totalLlamadas: 0, confirmados: 0, noContesta: 0, rechazados: 0, tasaExito: 0 },
  ],
};

const DEFAULT_RANGE = {
  from: new Date('2024-01-01'),
  to: new Date('2024-01-31'),
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function setupHook(
  overrides: Partial<ReturnType<typeof useCcIntentos>> = {},
) {
  mockUseCcIntentos.mockReturnValue({
    data: BASE_DATA,
    isLoading: false,
    isError: false,
    ...overrides,
  } as ReturnType<typeof useCcIntentos>);
}

function renderComponent() {
  return render(
    <CcIntentosCard storeId="store-1" range={DEFAULT_RANGE} />,
  );
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('CcIntentosCard', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  // ── 1. Datos normales ───────────────────────────────────────────────────────

  describe('con datos normales', () => {
    beforeEach(() => setupHook());

    it('renderiza el título "Análisis de Intentos"', () => {
      renderComponent();
      expect(screen.getByText(/análisis de intentos/i)).toBeInTheDocument();
    });

    it('renderiza las 3 tarjetas de intento con sus etiquetas', () => {
      renderComponent();
      expect(screen.getByText('1er intento')).toBeInTheDocument();
      expect(screen.getByText('2do intento')).toBeInTheDocument();
      expect(screen.getByText('3er intento')).toBeInTheDocument();
    });

    it('renderiza el total de llamadas de cada bucket', () => {
      renderComponent();
      // "20 llamadas", "15 llamadas", "12 llamadas"
      expect(screen.getByText('20 llamadas')).toBeInTheDocument();
      expect(screen.getByText('15 llamadas')).toBeInTheDocument();
      expect(screen.getByText('12 llamadas')).toBeInTheDocument();
    });

    it('renderiza la tasa de éxito en el badge del header y en el cuerpo de cada tarjeta', () => {
      renderComponent();
      // Cada tasaExito aparece 2 veces: badge header + cuerpo (Tasa de éxito grande)
      expect(screen.getAllByText(/50\.0%/)).toHaveLength(2); // b1
      expect(screen.getAllByText(/40\.0%/)).toHaveLength(2); // b2
      // b3 es el bucket ganador: aparece 3 veces (badge header + cuerpo + insight)
      expect(screen.getAllByText(/75\.0%/)).toHaveLength(3); // b3
    });

    it('renderiza el desglose confirmados / no contesta / rechazados por tarjeta', () => {
      renderComponent();
      // Confirm. (únicos): 10, 6, 9
      expect(screen.getByText('10')).toBeInTheDocument(); // b1 confirmados
      expect(screen.getByText('6')).toBeInTheDocument();  // b2 confirmados
      expect(screen.getByText('9')).toBeInTheDocument();  // b3 confirmados

      // No cont. (únicos): 7, 4, 2
      expect(screen.getByText('7')).toBeInTheDocument();  // b1 noContesta
      expect(screen.getByText('4')).toBeInTheDocument();  // b2 noContesta
      expect(screen.getByText('2')).toBeInTheDocument();  // b3 noContesta

      // Rechaz. (únicos): 3, 5, 1
      expect(screen.getByText('3')).toBeInTheDocument();  // b1 rechazados
      expect(screen.getByText('5')).toBeInTheDocument();  // b2 rechazados
      expect(screen.getByText('1')).toBeInTheDocument();  // b3 rechazados
    });

    it('renderiza las etiquetas de desglose "Confirm.", "No cont.", "Rechaz."', () => {
      renderComponent();
      // Cada etiqueta aparece 3 veces (una por tarjeta)
      expect(screen.getAllByText('Confirm.')).toHaveLength(3);
      expect(screen.getAllByText('No cont.')).toHaveLength(3);
      expect(screen.getAllByText('Rechaz.')).toHaveLength(3);
    });

    it('renderiza la etiqueta "Tasa de éxito" en el cuerpo de cada tarjeta', () => {
      renderComponent();
      expect(screen.getAllByText('Tasa de éxito')).toHaveLength(3);
    });
  });

  // ── 2. Nota bucket "3+" ─────────────────────────────────────────────────────

  describe('nota bucket 3+', () => {
    it('muestra la nota "Intentos 4+:" cuando el bucket 3+ tiene totalLlamadas > 0', () => {
      // BASE_DATA tiene bMas.totalLlamadas=8
      setupHook({ data: BASE_DATA });
      renderComponent();
      expect(screen.getByText(/intentos 4\+:/i)).toBeInTheDocument();
    });

    it('incluye el recuento de llamadas y tasaExito del bucket 3+ en la nota', () => {
      setupHook({ data: BASE_DATA });
      renderComponent();
      // "8 llamadas, 25.0% éxito"
      expect(screen.getByText(/8 llamadas/i)).toBeInTheDocument();
      expect(screen.getByText(/25\.0% éxito/i)).toBeInTheDocument();
    });

    it('incluye el desglose confirm./no cont./rechaz. del bucket 3+ en la nota', () => {
      setupHook({ data: BASE_DATA });
      renderComponent();
      // "2 confirm. · 0 no cont. · 6 rechaz."
      expect(screen.getByText(/2 confirm\./i)).toBeInTheDocument();
      expect(screen.getByText(/6 rechaz\./i)).toBeInTheDocument();
    });

    it('NO muestra la nota "Intentos 4+:" cuando el bucket 3+ tiene totalLlamadas === 0', () => {
      setupHook({ data: DATA_WITHOUT_MAS });
      renderComponent();
      expect(screen.queryByText(/intentos 4\+:/i)).not.toBeInTheDocument();
    });
  });

  // ── 3. Insight automático ───────────────────────────────────────────────────

  describe('insight automático', () => {
    it('muestra el insight de mejor intento cuando la tasa NO es decreciente', () => {
      // BASE_DATA: 50 → 40 → 75 — no es decreciente, best = b3 (75.0)
      setupHook({ data: BASE_DATA });
      renderComponent();
      expect(
        screen.getByText('El intento #3 tiene la mayor tasa de éxito (75.0%).'),
      ).toBeInTheDocument();
    });

    it('muestra el insight "cae del intento 1 al 3" cuando la tasa es decreciente', () => {
      // DECREASING_DATA: 60 → 40 → 18.2 — estrictamente decreciente
      setupHook({ data: DECREASING_DATA });
      renderComponent();
      expect(
        screen.getByText(
          'La conversión cae del intento 1 al 3. Priorizar llamadas en el 1er intento.',
        ),
      ).toBeInTheDocument();
    });
  });

  // ── 4. isLoading → skeleton ─────────────────────────────────────────────────

  describe('estado de carga', () => {
    it('renderiza 3 skeletons con animate-pulse cuando isLoading=true', () => {
      setupHook({ isLoading: true, data: undefined });
      const { container } = renderComponent();

      const pulses = container.querySelectorAll('.animate-pulse');
      expect(pulses.length).toBe(3);
    });

    it('sigue mostrando el título "Análisis de Intentos" durante la carga', () => {
      setupHook({ isLoading: true, data: undefined });
      renderComponent();
      expect(screen.getByText(/análisis de intentos/i)).toBeInTheDocument();
    });

    it('no renderiza las tarjetas de intento durante la carga', () => {
      setupHook({ isLoading: true, data: undefined });
      renderComponent();
      expect(screen.queryByText('1er intento')).not.toBeInTheDocument();
      expect(screen.queryByText('2do intento')).not.toBeInTheDocument();
      expect(screen.queryByText('3er intento')).not.toBeInTheDocument();
    });
  });

  // ── 5. isError → mensaje de error ──────────────────────────────────────────

  describe('estado de error', () => {
    it('muestra el mensaje de error exacto cuando isError=true', () => {
      setupHook({ isError: true, data: undefined });
      renderComponent();
      expect(
        screen.getByText('Error al cargar datos de intentos. Intentá de nuevo.'),
      ).toBeInTheDocument();
    });

    it('no renderiza las tarjetas de intento cuando hay error', () => {
      setupHook({ isError: true, data: undefined });
      renderComponent();
      expect(screen.queryByText('1er intento')).not.toBeInTheDocument();
      expect(screen.queryByText('2do intento')).not.toBeInTheDocument();
      expect(screen.queryByText('3er intento')).not.toBeInTheDocument();
    });

    it('sigue mostrando el título "Análisis de Intentos" en error', () => {
      setupHook({ isError: true, data: undefined });
      renderComponent();
      expect(screen.getByText(/análisis de intentos/i)).toBeInTheDocument();
    });
  });

  // ── 6. Todos los totalLlamadas en 0 → estado vacío ─────────────────────────

  describe('todos los buckets en cero (estado vacío)', () => {
    it('muestra el mensaje de estado vacío exacto', () => {
      setupHook({ data: ALL_ZERO_DATA });
      renderComponent();
      expect(
        screen.getByText('Sin datos de intentos para el período seleccionado.'),
      ).toBeInTheDocument();
    });

    it('no renderiza las tarjetas de intento en estado vacío', () => {
      setupHook({ data: ALL_ZERO_DATA });
      renderComponent();
      expect(screen.queryByText('1er intento')).not.toBeInTheDocument();
      expect(screen.queryByText('2do intento')).not.toBeInTheDocument();
      expect(screen.queryByText('3er intento')).not.toBeInTheDocument();
    });

    it('no muestra la nota "Intentos 4+:" en estado vacío', () => {
      setupHook({ data: ALL_ZERO_DATA });
      renderComponent();
      expect(screen.queryByText(/intentos 4\+:/i)).not.toBeInTheDocument();
    });

    it('no muestra el insight en estado vacío', () => {
      setupHook({ data: ALL_ZERO_DATA });
      renderComponent();
      expect(
        screen.queryByText(/la conversión cae|mayor tasa de éxito/i),
      ).not.toBeInTheDocument();
    });

    it('sigue mostrando el título "Análisis de Intentos" en estado vacío', () => {
      setupHook({ data: ALL_ZERO_DATA });
      renderComponent();
      expect(screen.getByText(/análisis de intentos/i)).toBeInTheDocument();
    });
  });

  // ── 7. data undefined (query no completada) ────────────────────────────────

  describe('sin data (query no completada)', () => {
    it('muestra el estado vacío cuando data es undefined', () => {
      setupHook({ data: undefined });
      renderComponent();
      expect(
        screen.getByText('Sin datos de intentos para el período seleccionado.'),
      ).toBeInTheDocument();
    });
  });
});
