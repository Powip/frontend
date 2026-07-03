import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CcUpsellByStoreCard } from '../cc-v2/CcUpsellByStoreCard';
import { CcUpsellResponse } from '@/interfaces/IOrder';
import { getKpisUpsell } from '@/services/atencionClienteService';

// ── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('@/services/atencionClienteService', () => ({
  getPedidosCC: jest.fn(),
  getKpisCC: jest.fn(),
  updateSubEstadoCC: jest.fn(),
  updateDatosClienteCC: jest.fn(),
  enviarPedidoALima: jest.fn(),
  confirmarEntregaLima: jest.fn(),
  confirmarDespacho: jest.fn(),
  recuperarVentaCC: jest.fn(),
  reassignSeller: jest.fn(),
  reasignarPedido: jest.fn(),
  getKpisFinancieros: jest.fn(),
  getKpisFunnel: jest.fn(),
  getStorePerformance: jest.fn(),
  getKpisUpsell: jest.fn(),
}));

const mockGetKpisUpsell = jest.mocked(getKpisUpsell);

// ── Fixtures ─────────────────────────────────────────────────────────────────

const TIENDA_A = {
  shop: 'tiendaA.myshopify.com',
  pedidosConfirmados: 20,
  conUpsell: 10,
  pctConUpsell: 50.0,
  facturacionBase: 4000,
  upsellMonto: 800,
  upsellUnidades: 5,
  ticketBase: 200,
  ticketConUpsell: 240,
  pctIncremento: 20.0,
  promUnidadesPorPedido: 2.5,
};

const TIENDA_SIN_ID = {
  shop: null,
  pedidosConfirmados: 5,
  conUpsell: 2,
  pctConUpsell: 40.0,
  facturacionBase: 1000,
  upsellMonto: 200,
  upsellUnidades: 2,
  ticketBase: 200,
  ticketConUpsell: 240,
  pctIncremento: 20.0,
  promUnidadesPorPedido: 1.5,
};

const CONSOLIDADO = {
  pedidosConfirmados: 25,
  conUpsell: 12,
  pctConUpsell: 48.0,
  facturacionBase: 5000,
  upsellMonto: 1000,
  upsellUnidades: 7,
  ticketBase: 200,
  ticketConUpsell: 240,
  pctIncremento: 20.0,
  promUnidadesPorPedido: 2.2,
  pctSobreBase: 20.0,
};

const MOCK_RESPONSE: CcUpsellResponse = {
  tiendas: [TIENDA_A, TIENDA_SIN_ID],
  consolidado: CONSOLIDADO,
};

const DEFAULT_RANGE = {
  from: new Date('2024-01-01'),
  to: new Date('2024-01-31'),
};

// ── Helper ───────────────────────────────────────────────────────────────────

function renderComponent(response: CcUpsellResponse | null = MOCK_RESPONSE) {
  if (response !== null) {
    mockGetKpisUpsell.mockResolvedValue(response);
  }
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <CcUpsellByStoreCard storeId="store-1" range={DEFAULT_RANGE} />
    </QueryClientProvider>,
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('CcUpsellByStoreCard', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  // ── 1. Renderizado de tarjetas por tienda ─────────────────────────────────

  describe('tarjetas por tienda', () => {
    it('renderiza una card por tienda con el nombre limpio', async () => {
      renderComponent();
      // "tiendaA.myshopify.com" → toLowerCase → "tiendaa" → capitaliza primera letra → "Tiendaa"
      expect(await screen.findByText('Tiendaa')).toBeInTheDocument();
    });

    it('shop=null muestra "Sin identificar"', async () => {
      renderComponent();
      expect(await screen.findByText('Sin identificar')).toBeInTheDocument();
    });

    it('renderiza la tarjeta consolidada con "Consolidado total"', async () => {
      renderComponent();
      expect(await screen.findByText('Consolidado total')).toBeInTheDocument();
    });

    it('muestra el contador de tiendas en el header', async () => {
      renderComponent();
      expect(await screen.findByText('2 tiendas')).toBeInTheDocument();
    });
  });

  // ── 2. Valores monetarios formateados con S/ ──────────────────────────────

  describe('formato de moneda S/', () => {
    it('muestra upsellMonto de tiendaA (800) con S/', async () => {
      renderComponent();
      // Buscamos texto que contenga "800" y "S/"
      const match = await screen.findAllByText((text) =>
        /800/.test(text.replace(/\s/g, '')) && /S/.test(text),
      );
      expect(match.length).toBeGreaterThanOrEqual(1);
    });

    it('muestra upsell total (1000) de la card consolidada con S/', async () => {
      renderComponent();
      const match = await screen.findAllByText((text) =>
        /1[,.\s]?000/.test(text.replace(/\s/g, '')) && /S/.test(text),
      );
      expect(match.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ── 3. Labels presentes ───────────────────────────────────────────────────

  describe('labels de la UI', () => {
    it('muestra la etiqueta "Upsell generado" en las cards de tienda', async () => {
      renderComponent();
      const labels = await screen.findAllByText('Upsell generado');
      // Una por cada tienda
      expect(labels.length).toBeGreaterThanOrEqual(1);
    });

    it('muestra "Upsell total generado" en la card consolidada', async () => {
      renderComponent();
      expect(await screen.findByText('Upsell total generado')).toBeInTheDocument();
    });

    it('muestra el porcentaje de incremento de la tienda (+20.0%)', async () => {
      renderComponent();
      const badges = await screen.findAllByText('+20.0%');
      expect(badges.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ── 4. Lista vacía no rompe ───────────────────────────────────────────────

  describe('lista vacía', () => {
    it('muestra mensaje de sin datos cuando tiendas=[]', async () => {
      mockGetKpisUpsell.mockResolvedValue({
        tiendas: [],
        consolidado: CONSOLIDADO,
      });
      const qc = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });
      render(
        <QueryClientProvider client={qc}>
          <CcUpsellByStoreCard storeId="store-1" range={DEFAULT_RANGE} />
        </QueryClientProvider>,
      );
      expect(
        await screen.findByText(/sin datos de upsell/i),
      ).toBeInTheDocument();
    });

    it('no lanza error al renderizar con lista vacía', async () => {
      mockGetKpisUpsell.mockResolvedValue({
        tiendas: [],
        consolidado: CONSOLIDADO,
      });
      const qc = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });
      expect(() =>
        render(
          <QueryClientProvider client={qc}>
            <CcUpsellByStoreCard storeId="store-1" range={DEFAULT_RANGE} />
          </QueryClientProvider>,
        ),
      ).not.toThrow();
    });
  });

  // ── 5. Estado de error del hook ───────────────────────────────────────────

  describe('estado de error', () => {
    it('muestra mensaje de error cuando la API falla', async () => {
      mockGetKpisUpsell.mockRejectedValue(new Error('Error del servidor'));
      const qc = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });
      render(
        <QueryClientProvider client={qc}>
          <CcUpsellByStoreCard storeId="store-1" range={DEFAULT_RANGE} />
        </QueryClientProvider>,
      );
      expect(
        await screen.findByText(/error al cargar datos de upsell/i),
      ).toBeInTheDocument();
    });
  });
});
