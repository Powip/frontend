import { render, screen } from '@testing-library/react';
import { CcStorePerformanceCard } from '../CcStorePerformanceCard';
import { CcStorePerformanceItem } from '@/interfaces/IOrder';
import { useCcStorePerformance } from '@/hooks/useCcStorePerformance';

// Mockear el hook — aísla el componente de TanStack Query y del service HTTP.
jest.mock('@/hooks/useCcStorePerformance');

const mockUseCcStorePerformance = jest.mocked(useCcStorePerformance);

const RANGE = {
  from: new Date('2026-05-01'),
  to:   new Date('2026-05-31'),
};

// Helper: devuelve objeto mínimo compatible con el retorno de useQuery
function makeQueryResult(overrides: {
  data?: CcStorePerformanceItem[];
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
  return render(<CcStorePerformanceCard storeId="store-1" range={RANGE} />);
}

describe('CcStorePerformanceCard', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('estado con data', () => {
    const MOCK_DATA: CcStorePerformanceItem[] = [
      { shop: 'styloperu.shop', ingresados: 100, confirmados: 40, tasaConversion: 40 },
      { shop: 'kunca.pe',       ingresados: 50,  confirmados: 11, tasaConversion: 22 },
    ];

    beforeEach(() => {
      mockUseCcStorePerformance.mockReturnValue(makeQueryResult({ data: MOCK_DATA }));
    });

    it('muestra el título "Rendimiento por Tienda"', () => {
      renderComponent();
      expect(screen.getByText('Rendimiento por Tienda')).toBeInTheDocument();
    });

    it('muestra el nombre limpio "Styloperu" a partir de styloperu.shop', () => {
      renderComponent();
      expect(screen.getByText('Styloperu')).toBeInTheDocument();
    });

    it('muestra el nombre limpio "Kunca" a partir de kunca.pe', () => {
      renderComponent();
      expect(screen.getByText('Kunca')).toBeInTheDocument();
    });

    it('muestra el porcentaje 40.0% para styloperu.shop', () => {
      renderComponent();
      expect(screen.getByText(/40\.0%/)).toBeInTheDocument();
    });

    it('muestra el porcentaje 22.0% para kunca.pe', () => {
      renderComponent();
      expect(screen.getByText(/22\.0%/)).toBeInTheDocument();
    });

    it('muestra el host crudo "styloperu.shop" como subtítulo', () => {
      renderComponent();
      expect(screen.getByText('styloperu.shop')).toBeInTheDocument();
    });

    it('muestra el host crudo "kunca.pe" como subtítulo', () => {
      renderComponent();
      expect(screen.getByText('kunca.pe')).toBeInTheDocument();
    });
  });

  describe('shop null → fallback "Sin identificar"', () => {
    beforeEach(() => {
      mockUseCcStorePerformance.mockReturnValue(
        makeQueryResult({
          data: [{ shop: null, ingresados: 10, confirmados: 2, tasaConversion: 20 }],
        })
      );
    });

    it('muestra "Sin identificar" en lugar del nombre de tienda', () => {
      renderComponent();
      expect(screen.getByText('Sin identificar')).toBeInTheDocument();
    });

    it('no renderiza el texto literal "null"', () => {
      renderComponent();
      expect(screen.queryByText('null')).not.toBeInTheDocument();
    });
  });

  describe('array vacío', () => {
    beforeEach(() => {
      mockUseCcStorePerformance.mockReturnValue(makeQueryResult({ data: [] }));
    });

    it('muestra el placeholder de sin datos', () => {
      renderComponent();
      expect(
        screen.getByText(/sin datos de tiendas en el período/i)
      ).toBeInTheDocument();
    });
  });

  describe('estado loading', () => {
    beforeEach(() => {
      mockUseCcStorePerformance.mockReturnValue(makeQueryResult({ isLoading: true }));
    });

    it('no crashea con isLoading=true', () => {
      expect(() => renderComponent()).not.toThrow();
    });

    it('muestra el título de la sección durante la carga', () => {
      renderComponent();
      expect(screen.getByText('Rendimiento por Tienda')).toBeInTheDocument();
    });

    it('no muestra porcentajes reales mientras carga', () => {
      renderComponent();
      expect(screen.queryByText(/40\.0%/)).not.toBeInTheDocument();
      expect(screen.queryByText(/22\.0%/)).not.toBeInTheDocument();
    });
  });

  describe('estado error', () => {
    beforeEach(() => {
      mockUseCcStorePerformance.mockReturnValue(makeQueryResult({ isError: true }));
    });

    it('muestra el mensaje de error visible al usuario', () => {
      renderComponent();
      expect(
        screen.getByText(/error al cargar el rendimiento por tienda/i)
      ).toBeInTheDocument();
    });

    it('no muestra datos de tiendas cuando hay error', () => {
      renderComponent();
      expect(screen.queryByText('Styloperu')).not.toBeInTheDocument();
    });
  });
});
