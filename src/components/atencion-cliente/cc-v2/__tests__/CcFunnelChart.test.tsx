import { render, screen } from '@testing-library/react';
import { CcFunnelChart } from '../CcFunnelChart';
import { CcKpisFunnelResponse } from '@/interfaces/IOrder';
import { useCcKpisFunnel } from '@/hooks/useCcKpisFunnel';

// Mockear el hook — aísla el componente de TanStack Query y del service HTTP.
jest.mock('@/hooks/useCcKpisFunnel');

// Recharts ResponsiveContainer no calcula dimensiones en jsdom (ancho/alto = 0).
// Se mocquea para que renderice directamente sus children con dimensiones fijas,
// permitiendo que el BarChart y sus elementos hijos lleguen al DOM.
jest.mock('recharts', () => {
  const OriginalRecharts = jest.requireActual('recharts');
  return {
    ...OriginalRecharts,
    ResponsiveContainer: ({
      children,
    }: {
      children: React.ReactElement;
    }) => (
      <div style={{ width: 600, height: 280 }}>
        {/* Clonar con dimensiones fijas para que el BarChart se monte */}
        {typeof children === 'function'
          ? (children as (size: { width: number; height: number }) => React.ReactNode)({ width: 600, height: 280 })
          : children}
      </div>
    ),
  };
});

const mockUseCcKpisFunnel = jest.mocked(useCcKpisFunnel);

const RANGE = {
  from: new Date('2026-05-01'),
  to:   new Date('2026-05-31'),
};

const MOCK_DATA: CcKpisFunnelResponse = {
  ingresados:      { count: 100 },
  gestionados:     { count: 80,  percentage: 80 },
  confirmados:     { count: 50,  percentage: 50 },
  despachados:     { count: 40,  percentage: 80 },
  entregados:      { count: 30,  percentage: 75 },
  conversionFinal: { percentage: 30 },
};

// Helper: devuelve objeto mínimo compatible con el retorno de useQuery
function makeQueryResult(overrides: {
  data?: CcKpisFunnelResponse;
  isLoading?: boolean;
  isError?: boolean;
}) {
  return {
    data:        overrides.data ?? undefined,
    isLoading:   overrides.isLoading ?? false,
    isError:     overrides.isError ?? false,
    isSuccess:   !overrides.isLoading && !overrides.isError && overrides.data !== undefined,
    isPending:   overrides.isLoading ?? false,
    isFetching:  overrides.isLoading ?? false,
    status:      overrides.isError ? 'error' : overrides.isLoading ? 'pending' : 'success',
    error:       overrides.isError ? new Error('Error del servidor') : null,
    refetch:     jest.fn(),
    fetchStatus: overrides.isLoading ? 'fetching' : 'idle',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

function renderComponent() {
  return render(<CcFunnelChart storeId="store-1" range={RANGE} />);
}

describe('CcFunnelChart', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('estado con data', () => {
    beforeEach(() => {
      mockUseCcKpisFunnel.mockReturnValue(makeQueryResult({ data: MOCK_DATA }));
    });

    it('muestra el título "Gráfico del Embudo"', () => {
      renderComponent();
      expect(screen.getByText('Gráfico del Embudo')).toBeInTheDocument();
    });

    it('no crashea con data válida', () => {
      expect(() => renderComponent()).not.toThrow();
    });

    it('no muestra el mensaje de error cuando hay data', () => {
      renderComponent();
      expect(screen.queryByText(/error al cargar el gráfico/i)).not.toBeInTheDocument();
    });
  });

  describe('estado loading', () => {
    beforeEach(() => {
      mockUseCcKpisFunnel.mockReturnValue(makeQueryResult({ isLoading: true }));
    });

    it('no crashea con isLoading=true', () => {
      expect(() => renderComponent()).not.toThrow();
    });

    it('muestra el título de la sección durante la carga', () => {
      renderComponent();
      expect(screen.getByText('Gráfico del Embudo')).toBeInTheDocument();
    });

    it('no muestra el mensaje de error mientras carga', () => {
      renderComponent();
      expect(screen.queryByText(/error al cargar el gráfico/i)).not.toBeInTheDocument();
    });
  });

  describe('estado error', () => {
    beforeEach(() => {
      mockUseCcKpisFunnel.mockReturnValue(makeQueryResult({ isError: true }));
    });

    it('muestra el mensaje de error visible al usuario', () => {
      renderComponent();
      expect(
        screen.getByText(/error al cargar el gráfico/i)
      ).toBeInTheDocument();
    });

    it('no crashea con isError=true', () => {
      expect(() => renderComponent()).not.toThrow();
    });
  });
});
