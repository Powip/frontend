import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CcLeaderboard } from '../cc-v2/CcLeaderboard';
import { AgentePerformanceKpis } from '@/interfaces/IOrder';
import { getAgentesPerformance } from '@/services/agentesService';

// ── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('@/services/agentesService', () => ({
  toggleMiCcStatus: jest.fn(),
  toggleAgenteCcStatus: jest.fn(),
  getAgentesPerformance: jest.fn(),
}));

// sonner: evitar errores de módulo en jsdom
jest.mock('sonner', () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

const mockGetAgentesPerformance = jest.mocked(getAgentesPerformance);

// ── Fixtures ─────────────────────────────────────────────────────────────────

const AGENTE_ALTO_UPSELL: AgentePerformanceKpis = {
  id: 'agent-1',
  nombre: 'Ana Torres',
  email: 'ana@x.com',
  ccActivo: true,
  ccRol: 'agente',
  asignados: 30,
  contactados: 25,
  confirmados: 20,
  entregados: 18,
  ventasConfirmadas: 6000,
  ticketPromedio: 300,
  pctContactados: 83.3,
  pctConfirmados: 66.7,
  pctEntregados: 90.0,
  unidades: 40,
  facturacionBase: 5000,
  upsellMonto: 1000,
  ticketFinal: 350,
};

const AGENTE_SIN_UPSELL: AgentePerformanceKpis = {
  id: 'agent-2',
  nombre: 'Luis Gómez',
  email: 'luis@x.com',
  ccActivo: true,
  ccRol: 'agente',
  asignados: 50,
  contactados: 40,
  confirmados: 15,
  entregados: 12,
  ventasConfirmadas: 4500,
  ticketPromedio: 300,
  pctContactados: 80.0,
  pctConfirmados: 30.0,
  pctEntregados: 80.0,
  unidades: 20,
  facturacionBase: 4500,
  upsellMonto: 0,
  ticketFinal: 300,
};

const AGENTE_TERCER: AgentePerformanceKpis = {
  id: 'agent-3',
  nombre: 'Carlos Ruiz',
  email: 'carlos@x.com',
  ccActivo: true,
  ccRol: 'agente',
  asignados: 20,
  contactados: 16,
  confirmados: 10,
  entregados: 8,
  ventasConfirmadas: 3000,
  ticketPromedio: 300,
  pctContactados: 80.0,
  pctConfirmados: 50.0,
  pctEntregados: 80.0,
  unidades: 15,
  facturacionBase: 3000,
  upsellMonto: 500,
  ticketFinal: 350,
};

const MOCK_AGENTES = [AGENTE_ALTO_UPSELL, AGENTE_SIN_UPSELL, AGENTE_TERCER];

const DEFAULT_RANGE = {
  from: new Date('2024-01-01'),
  to: new Date('2024-01-31'),
};

const DEFAULT_PROPS = {
  storeId: 'store-1',
  companyId: 'company-1',
  range: DEFAULT_RANGE,
};

// ── Helper ───────────────────────────────────────────────────────────────────

function renderLeaderboard(
  agentes: AgentePerformanceKpis[] = MOCK_AGENTES,
  props: Partial<typeof DEFAULT_PROPS> = {},
) {
  mockGetAgentesPerformance.mockResolvedValue(agentes);
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <CcLeaderboard {...DEFAULT_PROPS} {...props} />
    </QueryClientProvider>,
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('CcLeaderboard', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  // ── 1. Renderizado básico ─────────────────────────────────────────────────

  describe('renderizado básico', () => {
    it('muestra el título "Leaderboard de Vendedores"', async () => {
      renderLeaderboard();
      expect(
        await screen.findByText('Leaderboard de Vendedores'),
      ).toBeInTheDocument();
    });

    it('renderiza una fila por cada agente', async () => {
      renderLeaderboard();
      expect(await screen.findByText('Ana Torres')).toBeInTheDocument();
      expect(await screen.findByText('Luis Gómez')).toBeInTheDocument();
      expect(await screen.findByText('Carlos Ruiz')).toBeInTheDocument();
    });

    it('muestra la fila de totales con la etiqueta "Total"', async () => {
      renderLeaderboard();
      expect(await screen.findByText('Total')).toBeInTheDocument();
    });
  });

  // ── 2. Medallas top-3 ────────────────────────────────────────────────────

  describe('medallas top-3', () => {
    it('muestra medalla de oro (🥇) para el primer puesto en tab Upsell', async () => {
      renderLeaderboard();
      // El default tab es "upsell": Ana Torres (upsellMonto=1000) es 1°
      await screen.findByText('Ana Torres');
      expect(screen.getByTitle('1°')).toBeInTheDocument();
    });

    it('muestra medalla de plata (🥈) para el segundo puesto', async () => {
      renderLeaderboard();
      await screen.findByText('Ana Torres');
      expect(screen.getByTitle('2°')).toBeInTheDocument();
    });

    it('muestra medalla de bronce (🥉) para el tercer puesto', async () => {
      renderLeaderboard();
      await screen.findByText('Ana Torres');
      expect(screen.getByTitle('3°')).toBeInTheDocument();
    });
  });

  // ── 3. Badge "sin upsell" ─────────────────────────────────────────────────

  describe('badge "sin upsell"', () => {
    it('muestra badge "sin upsell" para el agente con upsellMonto=0', async () => {
      renderLeaderboard();
      await screen.findByText('Luis Gómez');
      expect(screen.getByText('sin upsell')).toBeInTheDocument();
    });

    it('no muestra badge "sin upsell" para agentes con upsell > 0', async () => {
      renderLeaderboard();
      await screen.findByText('Ana Torres');
      // Solo un badge de "sin upsell" (el de Luis)
      expect(screen.getAllByText('sin upsell').length).toBe(1);
    });
  });

  // ── 4. Cambio de tab reordena filas ───────────────────────────────────────

  describe('cambio de tab reordena filas', () => {
    it('tab Volumen: primera fila es el agente con más asignados (Luis=50)', async () => {
      renderLeaderboard();
      await screen.findByText('Ana Torres');

      await userEvent.click(screen.getByRole('button', { name: 'Volumen' }));

      // Verificamos que el primer RankIcon (1°) sea el de Luis Gómez
      // Buscamos las celdas de nombre en orden de aparición en el DOM
      const rows = screen
        .getAllByRole('row')
        // Filtramos la fila de header y la de totales
        .filter((row) => {
          const cells = within(row).queryAllByRole('cell');
          return cells.length > 0 && !within(row).queryByText('Total');
        });

      // La primera fila de datos debe contener "Luis Gómez"
      expect(within(rows[0]).getByText('Luis Gómez')).toBeInTheDocument();
    });

    it('tab Confirmación: primera fila es el agente con más pctConfirmados (Ana=66.7)', async () => {
      renderLeaderboard();
      await screen.findByText('Ana Torres');

      await userEvent.click(
        screen.getByRole('button', { name: 'Confirmación' }),
      );

      const rows = screen
        .getAllByRole('row')
        .filter((row) => {
          const cells = within(row).queryAllByRole('cell');
          return cells.length > 0 && !within(row).queryByText('Total');
        });

      expect(within(rows[0]).getByText('Ana Torres')).toBeInTheDocument();
    });

    it('tab Upsell S/ (default): primera fila es Ana Torres (upsellMonto=1000)', async () => {
      renderLeaderboard();
      await screen.findByText('Ana Torres');

      const rows = screen
        .getAllByRole('row')
        .filter((row) => {
          const cells = within(row).queryAllByRole('cell');
          return cells.length > 0 && !within(row).queryByText('Total');
        });

      expect(within(rows[0]).getByText('Ana Torres')).toBeInTheDocument();
    });
  });

  // ── 5. Fila de totales ────────────────────────────────────────────────────

  describe('fila de totales', () => {
    it('suma correctamente los asignados totales (30+50+20=100)', async () => {
      renderLeaderboard();
      await screen.findByText('Total');
      // La fila de totales debe mostrar 100
      const totalRow = screen
        .getAllByRole('row')
        .find((row) => within(row).queryByText('Total'));
      expect(within(totalRow!).getByText('100')).toBeInTheDocument();
    });
  });

  // ── 6. Lista vacía no rompe ───────────────────────────────────────────────

  describe('lista vacía', () => {
    it('muestra mensaje de sin datos cuando no hay agentes', async () => {
      renderLeaderboard([]);
      expect(
        await screen.findByText(/sin agentes con datos/i),
      ).toBeInTheDocument();
    });

    it('no lanza error al renderizar con lista vacía', async () => {
      expect(() => renderLeaderboard([])).not.toThrow();
    });
  });

  // ── 7. Estado de error del hook ───────────────────────────────────────────

  describe('estado de error', () => {
    it('muestra mensaje de error cuando la API falla', async () => {
      mockGetAgentesPerformance.mockRejectedValue(new Error('Error del servidor'));
      const qc = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });
      render(
        <QueryClientProvider client={qc}>
          <CcLeaderboard {...DEFAULT_PROPS} />
        </QueryClientProvider>,
      );
      expect(
        await screen.findByText(/error al cargar el leaderboard/i),
      ).toBeInTheDocument();
    });
  });

  // ── 8. Insights ───────────────────────────────────────────────────────────

  describe('insights', () => {
    it('muestra la sección Insights cuando hay agentes con datos', async () => {
      renderLeaderboard();
      expect(await screen.findByText('Insights')).toBeInTheDocument();
    });

    it('muestra el insight de mayor upsell/pedido', async () => {
      renderLeaderboard();
      // Ana tiene upsellMonto/confirmados = 1000/20 = 50 → mayor que Carlos 500/10 = 50 (empate, depende de sort estable)
      expect(
        await screen.findByText(/mayor upsell\/pedido/i),
      ).toBeInTheDocument();
    });
  });
});
