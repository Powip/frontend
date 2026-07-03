import { render, screen } from '@testing-library/react';
import { CcFunnelCards } from '../CcFunnelCards';
import { CcKpisFunnelResponse } from '@/interfaces/IOrder';
import { useCcKpisFunnel } from '@/hooks/useCcKpisFunnel';

// Mockear el hook completo — nunca el service HTTP directamente.
// Al mockear el hook se aísla el componente de TanStack Query y del service HTTP.
jest.mock('@/hooks/useCcKpisFunnel');

const mockUseCcKpisFunnel = jest.mocked(useCcKpisFunnel);

// DateRange de prueba — estable para todos los tests
const RANGE = {
  from: new Date('2026-05-01'),
  to: new Date('2026-05-31'),
};

// Datos representativos del dominio COD
const MOCK_DATA: CcKpisFunnelResponse = {
  ingresados:      { count: 100 },
  gestionados:     { count: 80,  percentage: 80 },
  confirmados:     { count: 50,  percentage: 50 },
  despachados:     { count: 40,  percentage: 80 },
  entregados:      { count: 30,  percentage: 75 },
  conversionFinal: { percentage: 30 },
};

// Helper para reducir boilerplate: devuelve un objeto mínimo compatible con
// el retorno de useQuery que el componente consume (data, isLoading, isError)
function makeQueryResult(overrides: {
  data?: CcKpisFunnelResponse;
  isLoading?: boolean;
  isError?: boolean;
}) {
  return {
    data: overrides.data ?? undefined,
    isLoading: overrides.isLoading ?? false,
    isError: overrides.isError ?? false,
    isSuccess: !overrides.isLoading && !overrides.isError && overrides.data !== undefined,
    isPending: overrides.isLoading ?? false,
    isFetching: overrides.isLoading ?? false,
    status: overrides.isError ? 'error' : overrides.isLoading ? 'pending' : 'success',
    error: overrides.isError ? new Error('Error del servidor') : null,
    refetch: jest.fn(),
    fetchStatus: overrides.isLoading ? 'fetching' : 'idle',
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

function renderComponent() {
  return render(<CcFunnelCards storeId="store-1" range={RANGE} />);
}

describe('CcFunnelCards', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('estado con data', () => {
    beforeEach(() => {
      mockUseCcKpisFunnel.mockReturnValue(makeQueryResult({ data: MOCK_DATA }));
    });

    it('muestra el título "Embudo de Conversión COD"', () => {
      renderComponent();
      expect(screen.getByText('Embudo de Conversión COD')).toBeInTheDocument();
    });

    it('muestra el count de Ingresados (100)', () => {
      renderComponent();
      expect(screen.getByText('100')).toBeInTheDocument();
    });

    it('muestra el count de Confirmados (50)', () => {
      renderComponent();
      expect(screen.getByText('50')).toBeInTheDocument();
    });

    it('muestra el count de Despachados (40)', () => {
      renderComponent();
      expect(screen.getByText('40')).toBeInTheDocument();
    });

    it('muestra el count de Entregados (30)', () => {
      renderComponent();
      // getByText con string exacto: solo el <p>30</p> del count de entregados
      // coincide — "30.0%" (Conversión Final) es un nodo distinto
      expect(screen.getByText('30')).toBeInTheDocument();
    });

    it('muestra porcentaje de Entregados formateado con un decimal', () => {
      renderComponent();
      expect(screen.getByText(/75\.0% % de despachados/i)).toBeInTheDocument();
    });

    it('la tarjeta Conversión Final muestra el porcentaje (30.0%) sin un count', () => {
      renderComponent();

      // Debe existir el porcentaje destacado
      expect(screen.getByText('30.0%')).toBeInTheDocument();

      // El label de la tarjeta de conversión identifica su propósito
      expect(screen.getByText('Ingresados → Entregados')).toBeInTheDocument();
    });
  });

  describe('estado loading', () => {
    beforeEach(() => {
      mockUseCcKpisFunnel.mockReturnValue(makeQueryResult({ isLoading: true }));
    });

    it('no crashea con isLoading=true y muestra el título de la sección', () => {
      renderComponent();
      expect(screen.getByText('Embudo de Conversión COD')).toBeInTheDocument();
    });

    it('no muestra counts ni porcentajes reales mientras carga', () => {
      renderComponent();
      // El componente renderiza skeletons y "..." durante loading
      expect(screen.queryByText('100')).not.toBeInTheDocument();
      expect(screen.queryByText('30.0%')).not.toBeInTheDocument();
    });
  });

  describe('estado error', () => {
    beforeEach(() => {
      mockUseCcKpisFunnel.mockReturnValue(makeQueryResult({ isError: true }));
    });

    it('muestra el mensaje de error visible al usuario', () => {
      renderComponent();
      expect(
        screen.getByText(/error al cargar el embudo de conversión/i)
      ).toBeInTheDocument();
    });

    it('no muestra datos de pedidos cuando hay error', () => {
      renderComponent();
      expect(screen.queryByText('100')).not.toBeInTheDocument();
    });
  });
});
