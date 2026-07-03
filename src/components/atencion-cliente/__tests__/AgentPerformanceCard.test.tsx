import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AgentPerformanceCard } from '../AgentPerformanceCard';
import { AgentePerformanceKpis } from '@/interfaces/IOrder';
import {
  toggleMiCcStatus,
  toggleAgenteCcStatus,
} from '@/services/agentesService';

// ── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('@/services/agentesService', () => ({
  toggleMiCcStatus: jest.fn(),
  toggleAgenteCcStatus: jest.fn(),
}));

// sonner: evitar errores de módulo en jsdom
jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

const mockToggleMiCcStatus = jest.mocked(toggleMiCcStatus);
const mockToggleAgenteCcStatus = jest.mocked(toggleAgenteCcStatus);

// ── Fixtures ─────────────────────────────────────────────────────────────────

const BASE_AGENTE: AgentePerformanceKpis = {
  id: 'agent-1',
  nombre: 'Juan Pérez',
  email: 'juan@x.com',
  ccActivo: true,
  ccRol: 'agente',
  asignados: 10,
  contactados: 8,
  confirmados: 5,
  entregados: 3,
  ventasConfirmadas: 1500,
  ticketPromedio: 300,
  pctContactados: 80,
  pctConfirmados: 50,
  pctEntregados: 60,
  // Fase 4b — Leaderboard
  unidades: 12,
  facturacionBase: 1400,
  upsellMonto: 100,
  ticketFinal: 320,
};

const DEFAULT_PROPS = {
  currentUserId: 'user-owner',
  isSupervisor: false,
  accessToken: 'tok-123',
  storeId: 'store-1',
};

// ── Helper ───────────────────────────────────────────────────────────────────

/**
 * Cada test recibe un QueryClient fresco para que no haya estado compartido
 * entre invalidaciones de caché.
 */
function renderCard(
  agente: AgentePerformanceKpis = BASE_AGENTE,
  props: Partial<typeof DEFAULT_PROPS> = {},
) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <AgentPerformanceCard
        agente={agente}
        currentUserId={DEFAULT_PROPS.currentUserId}
        isSupervisor={DEFAULT_PROPS.isSupervisor}
        accessToken={DEFAULT_PROPS.accessToken}
        storeId={DEFAULT_PROPS.storeId}
        {...props}
      />
    </QueryClientProvider>,
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('AgentPerformanceCard', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  // ── 1. Nombre y valores absolutos del embudo ─────────────────────────────

  describe('nombre y embudo absoluto', () => {
    it('renderiza el nombre del agente', () => {
      renderCard();
      expect(screen.getByText('Juan Pérez')).toBeInTheDocument();
    });

    it('muestra asignados=10', () => {
      renderCard();
      // El valor aparece dos veces (grid + barra), getAllByText es correcto
      expect(screen.getAllByText('10').length).toBeGreaterThanOrEqual(1);
    });

    it('muestra contactados=8', () => {
      renderCard();
      expect(screen.getAllByText('8').length).toBeGreaterThanOrEqual(1);
    });

    it('muestra confirmados=5', () => {
      renderCard();
      expect(screen.getAllByText('5').length).toBeGreaterThanOrEqual(1);
    });

    it('muestra entregados=3', () => {
      renderCard();
      expect(screen.getAllByText('3').length).toBeGreaterThanOrEqual(1);
    });
  });

  // ── 2. Porcentajes del embudo ─────────────────────────────────────────────

  describe('porcentajes del embudo', () => {
    it('muestra pctContactados=80.0%', () => {
      renderCard();
      expect(screen.getByText('80.0%')).toBeInTheDocument();
    });

    it('muestra pctConfirmados=50.0%', () => {
      renderCard();
      expect(screen.getByText('50.0%')).toBeInTheDocument();
    });

    it('muestra pctEntregados=60.0%', () => {
      renderCard();
      expect(screen.getByText('60.0%')).toBeInTheDocument();
    });
  });

  // ── 3. Métricas financieras en formato moneda ─────────────────────────────

  describe('métricas financieras', () => {
    /**
     * Intl.NumberFormat('es-PE', { style:'currency', currency:'PEN' }) produce
     * algo como "S/ 1,500.00" o "S/. 1 500,00" según el entorno.
     * Usamos matcher de función para ser resilientes a la variación del locale.
     */
    it('muestra ventasConfirmadas (1500) formateado como moneda', () => {
      renderCard();
      const match = screen.getByText((text) =>
        /1[,.\s]?500/.test(text.replace(/\s/g, '')),
      );
      expect(match).toBeInTheDocument();
    });

    it('muestra ticketPromedio (300) formateado como moneda', () => {
      renderCard();
      const match = screen.getByText((text) =>
        // 300.00 o 300,00 — el valor 300 sin separador de miles
        /300/.test(text) && /S/.test(text),
      );
      expect(match).toBeInTheDocument();
    });

    it('muestra la etiqueta "Mis ventas confirmadas"', () => {
      renderCard();
      expect(screen.getByText('Mis ventas confirmadas')).toBeInTheDocument();
    });

    it('muestra la etiqueta "Ticket promedio"', () => {
      renderCard();
      expect(screen.getByText('Ticket promedio')).toBeInTheDocument();
    });
  });

  // ── 4. Agente con todos los valores en 0 ─────────────────────────────────

  describe('agente con asignados=0', () => {
    const AGENTE_VACIO: AgentePerformanceKpis = {
      ...BASE_AGENTE,
      asignados: 0,
      contactados: 0,
      confirmados: 0,
      entregados: 0,
      ventasConfirmadas: 0,
      ticketPromedio: 0,
      pctContactados: 0,
      pctConfirmados: 0,
      pctEntregados: 0,
    };

    it('no lanza error al renderizar', () => {
      expect(() => renderCard(AGENTE_VACIO)).not.toThrow();
    });

    it('muestra el nombre del agente aunque todo sea 0', () => {
      renderCard(AGENTE_VACIO);
      expect(screen.getByText('Juan Pérez')).toBeInTheDocument();
    });

    it('los porcentajes se muestran como 0.0%', () => {
      renderCard(AGENTE_VACIO);
      // pct* = 0 → tres spans "0.0%"
      const ceros = screen.getAllByText('0.0%');
      expect(ceros.length).toBe(3);
    });
  });

  // ── 5. Supervisor toggling otro agente ────────────────────────────────────

  describe('supervisor toggling agente ajeno', () => {
    it('llama a toggleAgenteCcStatus (no toggleMiCcStatus) al cambiar el Switch', async () => {
      const user = userEvent.setup();
      // isSupervisor=true, currentUserId diferente al agente → canToggle=true, isOwnCard=false
      mockToggleAgenteCcStatus.mockResolvedValue(undefined);

      renderCard(BASE_AGENTE, {
        isSupervisor: true,
        currentUserId: 'supervisor-99',
      });

      // El Switch tiene aria-label según ccActivo=true → "Desactivar agente"
      const switchEl = screen.getByRole('switch', {
        name: /desactivar agente/i,
      });
      await user.click(switchEl);

      expect(mockToggleAgenteCcStatus).toHaveBeenCalledWith(
        DEFAULT_PROPS.accessToken,
        BASE_AGENTE.id,
        { ccActivo: false },
      );
      expect(mockToggleMiCcStatus).not.toHaveBeenCalled();
    });
  });
});
