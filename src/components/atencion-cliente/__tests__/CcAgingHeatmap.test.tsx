import { render, screen } from '@testing-library/react';
import { CcAgingHeatmap } from '../cc-v2/CcAgingHeatmap';
import type { CcAgingResponse } from '@/interfaces/IOrder';

// ── Mock del hook (no del service: el componente solo consume el hook) ─────────

jest.mock('@/hooks/useCcAging');

import { useCcAging } from '@/hooks/useCcAging';

const mockUseCcAging = jest.mocked(useCcAging);

// ── Fixtures ───────────────────────────────────────────────────────────────────

/**
 * Datos con counts distintos por bucket, por fila y por total para evitar
 * ambigüedad en getByText cuando hay valores repetidos.
 *
 * PENDIENTE:   d0=2, d1=3, d2=4, d3=5, d4=6, d5=7, d6plus=8  → total=35
 * NO_CONTESTA: d0=1, d1=9, d2=0, d3=0, d4=0, d5=0, d6plus=11 → total=21
 * DESPACHADO:  d0=0, d1=0, d2=0, d3=0, d4=0, d5=0, d6plus=14 → total=42
 *   (total=42 es intencionalmente distinto de d6plus=14 para evitar getByText ambiguo)
 *
 * Valores únicos en el DOM: 2,3,4,5,6,7,8,9,11,14 (celdas) + 35,21,42 (totales).
 * zonaCriticaTotal=19 también único.
 */
const BASE_DATA: CcAgingResponse = {
  estados: [
    {
      estado: 'PENDIENTE',
      dias: { d0: 2, d1: 3, d2: 4, d3: 5, d4: 6, d5: 7, d6plus: 8 },
      total: 35,
    },
    {
      estado: 'NO_CONTESTA',
      dias: { d0: 1, d1: 9, d2: 0, d3: 0, d4: 0, d5: 0, d6plus: 11 },
      total: 21,
    },
    {
      estado: 'DESPACHADO',
      // d6plus=14, total=42 → ambos únicos en el DOM
      dias: { d0: 0, d1: 0, d2: 0, d3: 0, d4: 0, d5: 0, d6plus: 14 },
      total: 42,
    },
  ],
  zonaCriticaTotal: 19,
};

const ALL_ZERO_DATA: CcAgingResponse = {
  estados: [
    {
      estado: 'PENDIENTE',
      dias: { d0: 0, d1: 0, d2: 0, d3: 0, d4: 0, d5: 0, d6plus: 0 },
      total: 0,
    },
    {
      estado: 'NO_CONTESTA',
      dias: { d0: 0, d1: 0, d2: 0, d3: 0, d4: 0, d5: 0, d6plus: 0 },
      total: 0,
    },
    {
      estado: 'DESPACHADO',
      dias: { d0: 0, d1: 0, d2: 0, d3: 0, d4: 0, d5: 0, d6plus: 0 },
      total: 0,
    },
  ],
  zonaCriticaTotal: 0,
};

const DEFAULT_RANGE = {
  from: new Date('2024-01-01'),
  to: new Date('2024-01-31'),
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function setupHook(
  overrides: Partial<ReturnType<typeof useCcAging>> = {},
) {
  mockUseCcAging.mockReturnValue({
    data: BASE_DATA,
    isLoading: false,
    isError: false,
    ...overrides,
  } as ReturnType<typeof useCcAging>);
}

function renderComponent() {
  return render(
    <CcAgingHeatmap storeId="store-1" range={DEFAULT_RANGE} />,
  );
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('CcAgingHeatmap', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  // ── 1. Datos normales ───────────────────────────────────────────────────────

  describe('con datos normales', () => {
    beforeEach(() => setupHook());

    it('renderiza el título del heatmap', () => {
      renderComponent();
      expect(screen.getByText(/aging de pedidos activos/i)).toBeInTheDocument();
    });

    it('renderiza las 3 etiquetas de estado en la tabla', () => {
      renderComponent();
      expect(screen.getByText('Pendiente')).toBeInTheDocument();
      expect(screen.getByText('No contesta')).toBeInTheDocument();
      expect(screen.getByText('Despachado')).toBeInTheDocument();
    });

    it('renderiza counts de celdas no nulas como números', () => {
      renderComponent();
      // Todos los valores son únicos en el DOM — fixture diseñado para esto
      expect(screen.getByText('2')).toBeInTheDocument();   // PENDIENTE d0
      expect(screen.getByText('3')).toBeInTheDocument();   // PENDIENTE d1
      expect(screen.getByText('4')).toBeInTheDocument();   // PENDIENTE d2
      expect(screen.getByText('5')).toBeInTheDocument();   // PENDIENTE d3
      expect(screen.getByText('6')).toBeInTheDocument();   // PENDIENTE d4
      expect(screen.getByText('7')).toBeInTheDocument();   // PENDIENTE d5
      expect(screen.getByText('8')).toBeInTheDocument();   // PENDIENTE d6plus
      expect(screen.getByText('9')).toBeInTheDocument();   // NO_CONTESTA d1
      expect(screen.getByText('11')).toBeInTheDocument();  // NO_CONTESTA d6plus
      expect(screen.getByText('14')).toBeInTheDocument();  // DESPACHADO d6plus
    });

    it('renderiza el total de cada fila', () => {
      renderComponent();
      // Totales: 35, 21, 42 — todos únicos en el DOM
      expect(screen.getByText('35')).toBeInTheDocument();
      expect(screen.getByText('21')).toBeInTheDocument();
      expect(screen.getByText('42')).toBeInTheDocument();
    });

    it('renderiza las cabeceras de columna de días', () => {
      renderComponent();
      expect(screen.getByText('0d')).toBeInTheDocument();
      expect(screen.getByText('1d')).toBeInTheDocument();
      expect(screen.getByText('6d+')).toBeInTheDocument();
      expect(screen.getByText('Total')).toBeInTheDocument();
    });

    it('renderiza la leyenda semáforo', () => {
      renderComponent();
      expect(screen.getByText(/0-1d normal/i)).toBeInTheDocument();
      expect(screen.getByText(/2d atención/i)).toBeInTheDocument();
      expect(screen.getByText(/3d urgente/i)).toBeInTheDocument();
      expect(screen.getByText(/4-5d crítico/i)).toBeInTheDocument();
      expect(screen.getByText(/6d\+ crítico intenso/i)).toBeInTheDocument();
    });
  });

  // ── 2. Badge "Zona crítica" ─────────────────────────────────────────────────

  describe('badge Zona crítica', () => {
    it('muestra el número cuando zonaCriticaTotal > 0', () => {
      setupHook({ data: { ...BASE_DATA, zonaCriticaTotal: 19 } });
      renderComponent();
      expect(screen.getByText(/zona crítica: 19/i)).toBeInTheDocument();
    });

    it('muestra "Zona crítica: 0" cuando zonaCriticaTotal === 0 pero hay datos', () => {
      setupHook({ data: { ...BASE_DATA, zonaCriticaTotal: 0 } });
      renderComponent();
      // El badge siempre se muestra cuando hay data; con 0 dice "Zona crítica: 0"
      expect(screen.getByText(/zona crítica: 0/i)).toBeInTheDocument();
    });

    it('NO muestra el ícono AlertTriangle dentro del badge cuando zonaCriticaTotal === 0', () => {
      setupHook({ data: { ...BASE_DATA, zonaCriticaTotal: 0 } });
      const { container } = renderComponent();
      // El badge existe pero sin el ícono: el span que contiene "Zona crítica: 0"
      // no debe tener un svg hijo (el <AlertTriangle> es condicional a count > 0)
      const badge = container.querySelector('span.inline-flex');
      expect(badge).toBeInTheDocument();
      expect(badge?.querySelector('svg')).not.toBeInTheDocument();
    });

    it('NO renderiza el badge cuando no hay data (isLoading)', () => {
      setupHook({ isLoading: true, data: undefined });
      renderComponent();
      expect(screen.queryByText(/zona crítica/i)).not.toBeInTheDocument();
    });
  });

  // ── 3. isLoading → skeleton ─────────────────────────────────────────────────

  describe('estado de carga', () => {
    it('renderiza el skeleton con animate-pulse cuando isLoading=true', () => {
      setupHook({ isLoading: true, data: undefined });
      const { container } = renderComponent();

      const pulse = container.querySelector('.animate-pulse');
      expect(pulse).toBeInTheDocument();
    });

    it('no renderiza filas de estado mientras carga', () => {
      setupHook({ isLoading: true, data: undefined });
      renderComponent();

      expect(screen.queryByText('Pendiente')).not.toBeInTheDocument();
      expect(screen.queryByText('No contesta')).not.toBeInTheDocument();
      expect(screen.queryByText('Despachado')).not.toBeInTheDocument();
    });

    it('no renderiza la tabla mientras carga', () => {
      setupHook({ isLoading: true, data: undefined });
      const { container } = renderComponent();

      expect(container.querySelector('table')).not.toBeInTheDocument();
    });
  });

  // ── 4. isError → mensaje de error ──────────────────────────────────────────

  describe('estado de error', () => {
    it('muestra el mensaje de error cuando isError=true', () => {
      setupHook({ isError: true, data: undefined });
      renderComponent();

      expect(
        screen.getByText('Error al cargar el aging de pedidos. Intentá de nuevo.'),
      ).toBeInTheDocument();
    });

    it('no renderiza la tabla cuando hay error', () => {
      setupHook({ isError: true, data: undefined });
      const { container } = renderComponent();

      expect(container.querySelector('table')).not.toBeInTheDocument();
    });

    it('no renderiza las etiquetas de estado cuando hay error', () => {
      setupHook({ isError: true, data: undefined });
      renderComponent();

      expect(screen.queryByText('Pendiente')).not.toBeInTheDocument();
      expect(screen.queryByText('No contesta')).not.toBeInTheDocument();
    });
  });

  // ── 5. Todos los buckets en 0 → estado vacío ───────────────────────────────

  describe('todos los buckets en cero', () => {
    it('muestra el mensaje de estado vacío cuando todos los counts son 0', () => {
      setupHook({ data: ALL_ZERO_DATA });
      renderComponent();

      expect(
        screen.getByText('Sin pedidos activos en el período seleccionado.'),
      ).toBeInTheDocument();
    });

    it('no renderiza la tabla cuando todos los buckets son 0', () => {
      setupHook({ data: ALL_ZERO_DATA });
      const { container } = renderComponent();

      expect(container.querySelector('table')).not.toBeInTheDocument();
    });

    it('sigue mostrando el badge con "Zona crítica: 0" en el estado vacío', () => {
      // El header (que contiene el badge) se renderiza también en la rama empty
      setupHook({ data: ALL_ZERO_DATA });
      renderComponent();

      expect(screen.getByText(/zona crítica: 0/i)).toBeInTheDocument();
    });

    it('no renderiza las etiquetas de fila cuando todos los buckets son 0', () => {
      setupHook({ data: ALL_ZERO_DATA });
      renderComponent();

      expect(screen.queryByText('Pendiente')).not.toBeInTheDocument();
      expect(screen.queryByText('No contesta')).not.toBeInTheDocument();
      expect(screen.queryByText('Despachado')).not.toBeInTheDocument();
    });
  });

  // ── 6. data undefined (sin resultado de query aún) ─────────────────────────

  describe('sin data (query no completada)', () => {
    it('muestra el estado vacío cuando data es undefined', () => {
      setupHook({ data: undefined });
      renderComponent();

      expect(
        screen.getByText('Sin pedidos activos en el período seleccionado.'),
      ).toBeInTheDocument();
    });
  });
});
