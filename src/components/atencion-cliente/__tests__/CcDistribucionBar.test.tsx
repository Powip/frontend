import { render, screen } from '@testing-library/react';
import { CcDistribucionBar } from '../cc-v2/CcDistribucionBar';
import type {
  CcKpisFunnelResponse,
  CcKpisFunnelDistribucion,
  CcKpisFunnelSubBreakdown,
} from '@/interfaces/IOrder';

// ── Mock del hook (no del service: el componente solo consume el hook) ────────

jest.mock('@/hooks/useCcKpisFunnel');

import { useCcKpisFunnel } from '@/hooks/useCcKpisFunnel';

const mockUseCcKpisFunnel = jest.mocked(useCcKpisFunnel);

// ── Fixtures ──────────────────────────────────────────────────────────────────

const DISTRIBUCION: CcKpisFunnelDistribucion = {
  total:      100,
  pendiente:  { count: 20, percentage: 20 },
  confirmado: { count: 50, percentage: 50 },
  noContesta: { count: 18, percentage: 18 },
  anulado:    { count: 12, percentage: 12 },
};

const SUB_BREAKDOWN: CcKpisFunnelSubBreakdown = {
  entregado:  { count: 30, percentage: 60 },
  despachado: { count: 15, percentage: 30 },
};

const BASE_RESPONSE: CcKpisFunnelResponse = {
  ingresados:      { count: 100 },
  gestionados:     { count: 90, percentage: 90 },
  confirmados:     { count: 50, percentage: 50 },
  despachados:     { count: 15, percentage: 30 },
  entregados:      { count: 30, percentage: 60 },
  conversionFinal: { percentage: 30 },
  distribucion:    DISTRIBUCION,
  subBreakdown:    SUB_BREAKDOWN,
};

const DEFAULT_RANGE = {
  from: new Date('2024-01-01'),
  to:   new Date('2024-01-31'),
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function setupHook(
  overrides: Partial<ReturnType<typeof useCcKpisFunnel>> = {},
) {
  mockUseCcKpisFunnel.mockReturnValue({
    data:      BASE_RESPONSE,
    isLoading: false,
    isError:   false,
    isPending: false,
    ...overrides,
  } as ReturnType<typeof useCcKpisFunnel>);
}

function renderComponent() {
  return render(
    <CcDistribucionBar storeId="store-1" range={DEFAULT_RANGE} />,
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('CcDistribucionBar', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  // ── 1. Datos normales: 4 segmentos + sub-barra ────────────────────────────

  describe('con datos normales', () => {
    beforeEach(() => setupHook());

    it('renderiza los 4 labels de segmentos en la leyenda', () => {
      renderComponent();

      expect(screen.getByText('Pendiente')).toBeInTheDocument();
      expect(screen.getByText('Confirmado')).toBeInTheDocument();
      expect(screen.getByText('No contesta')).toBeInTheDocument();
      expect(screen.getByText('Anulado')).toBeInTheDocument();
    });

    it('muestra los counts y porcentajes de cada segmento', () => {
      renderComponent();

      // Pendiente: 20 · 20.0%
      expect(screen.getByText(/20 · 20\.0%/)).toBeInTheDocument();
      // Confirmado: 50 · 50.0%
      expect(screen.getByText(/50 · 50\.0%/)).toBeInTheDocument();
      // No contesta: 18 · 18.0%
      expect(screen.getByText(/18 · 18\.0%/)).toBeInTheDocument();
      // Anulado: 12 · 12.0%
      expect(screen.getByText(/12 · 12\.0%/)).toBeInTheDocument();
    });

    it('renderiza la sub-barra de confirmados con sus labels', () => {
      renderComponent();

      // Header de sub-barra
      expect(screen.getByText(/detalle confirmados/i)).toBeInTheDocument();
      expect(screen.getByText('Entregado')).toBeInTheDocument();
      expect(screen.getByText('En tránsito')).toBeInTheDocument();
      expect(screen.getByText('Sin despachar')).toBeInTheDocument();
    });

    it('muestra el count de confirmados en el encabezado de la sub-barra', () => {
      renderComponent();
      // "Detalle confirmados (50 pedidos)"
      expect(screen.getByText(/50 pedidos/)).toBeInTheDocument();
    });
  });

  // ── 2. Cuadre OK ─────────────────────────────────────────────────────────

  describe('badge de cuadre', () => {
    it('muestra "Cuadre OK" cuando la suma de buckets === total', () => {
      // 20+50+18+12 = 100 === total:100
      setupHook();
      renderComponent();

      expect(screen.getByText('Cuadre OK')).toBeInTheDocument();
    });

    it('muestra desfase cuando la suma de buckets !== total', () => {
      setupHook({
        data: {
          ...BASE_RESPONSE,
          distribucion: {
            ...DISTRIBUCION,
            total: 110, // suma es 100, total es 110 → desfase
          },
        },
      });
      renderComponent();

      expect(screen.getByText(/Desfase: 100 \/ 110/)).toBeInTheDocument();
    });
  });

  // ── 3. distribucion undefined → Sin datos ────────────────────────────────

  describe('sin distribucion', () => {
    it('muestra mensaje "Sin datos" cuando distribucion es undefined', () => {
      setupHook({
        data: { ...BASE_RESPONSE, distribucion: undefined },
      });
      renderComponent();

      expect(
        screen.getByText(/sin datos de distribución/i),
      ).toBeInTheDocument();
    });

    it('no lanza error cuando distribucion es undefined', () => {
      setupHook({
        data: { ...BASE_RESPONSE, distribucion: undefined },
      });

      expect(() => renderComponent()).not.toThrow();
    });
  });

  // ── 4. total === 0 → Sin pedidos ─────────────────────────────────────────

  describe('total cero', () => {
    it('muestra "Sin pedidos" cuando total === 0', () => {
      setupHook({
        data: {
          ...BASE_RESPONSE,
          distribucion: {
            total:      0,
            pendiente:  { count: 0, percentage: 0 },
            confirmado: { count: 0, percentage: 0 },
            noContesta: { count: 0, percentage: 0 },
            anulado:    { count: 0, percentage: 0 },
          },
        },
      });
      renderComponent();

      expect(
        screen.getByText(/sin pedidos en el período/i),
      ).toBeInTheDocument();
    });
  });

  // ── 5. isLoading → skeleton ───────────────────────────────────────────────

  describe('estado de carga', () => {
    it('muestra el skeleton cuando isLoading=true', () => {
      setupHook({ isLoading: true, data: undefined });
      const { container } = renderComponent();

      // El skeleton usa animate-pulse; no renderiza datos
      const pulse = container.querySelector('.animate-pulse');
      expect(pulse).toBeInTheDocument();
    });

    it('no muestra los labels de segmentos mientras carga', () => {
      setupHook({ isLoading: true, data: undefined });
      renderComponent();

      expect(screen.queryByText('Pendiente')).not.toBeInTheDocument();
      expect(screen.queryByText('Confirmado')).not.toBeInTheDocument();
    });
  });

  // ── 6. isError → mensaje de error ────────────────────────────────────────

  describe('estado de error', () => {
    it('muestra mensaje de error cuando isError=true', () => {
      setupHook({ isError: true, data: undefined });
      renderComponent();

      expect(
        screen.getByText(/error al cargar la distribución/i),
      ).toBeInTheDocument();
    });

    it('no renderiza la barra de distribución cuando hay error', () => {
      setupHook({ isError: true, data: undefined });
      renderComponent();

      expect(screen.queryByText('Pendiente')).not.toBeInTheDocument();
    });
  });

  // ── 7. Sub-barra se oculta cuando confirmados === 0 ───────────────────────

  describe('sub-barra con confirmados cero', () => {
    it('no muestra la sub-barra si confirmado.count === 0', () => {
      setupHook({
        data: {
          ...BASE_RESPONSE,
          distribucion: {
            ...DISTRIBUCION,
            confirmado: { count: 0, percentage: 0 },
          },
        },
      });
      renderComponent();

      expect(screen.queryByText(/detalle confirmados/i)).not.toBeInTheDocument();
    });
  });
});
