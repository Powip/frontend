/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Tests: EvaOrderTrackingView
 *
 * Comportamiento verificado:
 * 1. Al montar, hace fetch al endpoint order-header/store/:storeId y muestra
 *    SOLO los pedidos con evaStatus no nulo; pedidos sin ese campo quedan
 *    excluidos de la tabla.
 * 2. El resumen de contadores muestra el label y la cantidad correcta por
 *    estado EVA (ej. "Entregado" → 1, "En ruta" → 1).
 * 3. Los contadores por estado funcionan como filtro clickeable (togglean
 *    statusFilter) y hay un botón "Limpiar filtro" cuando hay uno activo.
 * 4. El botón "Actualizar" dispara un segundo fetch al hacer click.
 * 5. El buscador filtra por número de pedido y por nombre de cliente.
 * 6. Estado vacío: si ningún pedido tiene evaStatus, se muestra el mensaje
 *    "No hay pedidos enviados a EVA Courier".
 * 7. Si selectedStoreId es null, no se realiza ningún fetch.
 * 8. Error de fetch: muestra toast.error.
 * 9. Se muestra la columna "Tracking EVA" con el evaTrackingId de cada pedido.
 *
 * Work-arounds jsdom aplicados:
 * - axios         → mock completo (axios.get como jest.fn())
 * - useAuth       → mock que devuelve selectedStoreId
 * - EvaStatusBadge → real (componente puro de display); se mockea date-fns
 *   para evitar problemas con localización en jsdom.
 * - Componentes UI Shadcn (Table, Button, Input, Label, Badge) → mocks mínimos
 *   para evitar errores de ResizeObserver / Radix en jsdom.
 * - lucide-react  → iconos como spans vacíos.
 * - sonner        → mock de toast.
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ── Mocks de infraestructura ─────────────────────────────────────────────────

jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
    warning: jest.fn(),
  },
}));

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: jest.fn(),
}));

jest.mock('axios', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    defaults: { withCredentials: false },
  },
}));

// Mock de date-fns para evitar problemas con localización (usado por EvaStatusBadge)
jest.mock('date-fns', () => ({
  format: (_date: Date, _fmt: string) => '01/01/25 10:00',
}));
jest.mock('date-fns/locale', () => ({ es: {} }));

// Mocks mínimos de componentes UI
jest.mock('@/components/ui/button', () => {
  const React = require('react');
  const Button = ({
    children,
    onClick,
    disabled,
    className,
    variant,
    size,
  }: {
    children?: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    className?: string;
    variant?: string;
    size?: string;
  }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className={className}
      data-variant={variant}
      data-size={size}
    >
      {children}
    </button>
  );
  const buttonVariants = () => '';
  return { Button, buttonVariants };
});

jest.mock('@/components/ui/table', () => {
  const React = require('react');
  const Table = ({ children }: { children?: React.ReactNode }) => <table>{children}</table>;
  const TableHeader = ({ children }: { children?: React.ReactNode }) => <thead>{children}</thead>;
  const TableBody = ({ children }: { children?: React.ReactNode }) => <tbody>{children}</tbody>;
  const TableRow = ({ children, className }: { children?: React.ReactNode; className?: string }) => (
    <tr className={className}>{children}</tr>
  );
  const TableHead = ({ children, className }: { children?: React.ReactNode; className?: string }) => (
    <th className={className}>{children}</th>
  );
  const TableCell = ({
    children,
    colSpan,
    className,
  }: {
    children?: React.ReactNode;
    colSpan?: number;
    className?: string;
  }) => (
    <td colSpan={colSpan} className={className}>
      {children}
    </td>
  );
  return { Table, TableHeader, TableBody, TableRow, TableHead, TableCell };
});

jest.mock('@/components/ui/input', () => {
  const React = require('react');
  const Input = (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />;
  return { Input };
});

jest.mock('@/components/ui/label', () => {
  const React = require('react');
  const Label = ({
    children,
    className,
    htmlFor,
  }: {
    children?: React.ReactNode;
    className?: string;
    htmlFor?: string;
  }) => (
    <label className={className} htmlFor={htmlFor}>
      {children}
    </label>
  );
  return { Label };
});

jest.mock('@/components/ui/badge', () => {
  const React = require('react');
  const Badge = ({
    children,
    variant,
    className,
  }: {
    children?: React.ReactNode;
    variant?: string;
    className?: string;
  }) => (
    <span data-variant={variant} className={className}>
      {children}
    </span>
  );
  return { Badge };
});

jest.mock('lucide-react', () => ({
  Search: () => <span data-testid="icon-search" />,
  RefreshCw: ({ className }: { className?: string }) => (
    <span data-testid="icon-refresh" className={className} />
  ),
}));

jest.mock('@/lib/utils', () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
}));

// ── Imports bajo prueba (después de los mocks) ───────────────────────────────

import axios from 'axios';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import EvaOrderTrackingView from '../EvaOrderTrackingView';

// ── Casts ────────────────────────────────────────────────────────────────────

const mockUseAuth = jest.mocked(useAuth);
const mockAxiosGet = axios.get as jest.Mock;
const mockToast = toast as jest.Mocked<typeof toast>;

// ── Fixtures ─────────────────────────────────────────────────────────────────

const MOCK_AUTH = {
  auth: {
    user: { id: 'user-1', email: 'test@powip.com', role: 'ADMIN', permissions: [] },
    company: { id: 'company-1', name: 'Powip Test', stores: [] },
    accessToken: 'fake-token',
    subscription: null,
    exp: 9999999999,
  },
  loading: false,
  login: jest.fn(),
  logout: jest.fn(),
  updateCompany: jest.fn(),
  selectedStoreId: 'store-1',
  setSelectedStore: jest.fn(),
  inventories: [],
  refreshInventories: jest.fn(),
  hasPermission: jest.fn().mockReturnValue(true),
};

/** Pedido con evaStatus → debe aparecer en la vista */
const ORDER_REGISTRADO = {
  id: 'order-1',
  orderNumber: 'ORD-001',
  storeId: 'store-1',
  evaStatus: 'REGISTRADO',
  evaSyncedAt: '2025-06-01T10:00:00Z',
  evaTrackingId: 'EVA-TRK-001',
  created_at: '2025-06-01T09:00:00Z',
  updated_at: '2025-06-01T09:00:00Z',
  customer: { fullName: 'María García', id: 'c1', companyId: 'company-1' },
  receiptType: 'BOLETA',
  orderType: 'VENTA',
  salesChannel: 'WHATSAPP',
  closingChannel: 'WHATSAPP',
  deliveryType: 'DOMICILIO',
  courierId: null,
  courier: null,
  subtotal: '100',
  taxTotal: '0',
  shippingTotal: '10',
  discountTotal: '0',
  grandTotal: '110',
  status: 'PREPARADO',
  salesRegion: 'LIMA',
  cancellationReason: null,
  notes: null,
  items: [],
  payments: [],
};

/** Pedido con ENTREGADO */
const ORDER_ENTREGADO = {
  ...ORDER_REGISTRADO,
  id: 'order-2',
  orderNumber: 'ORD-002',
  evaStatus: 'ENTREGADO',
  evaTrackingId: 'EVA-TRK-002',
  created_at: '2025-06-02T09:00:00Z',
  customer: { fullName: 'Juan Pérez', id: 'c2', companyId: 'company-1' },
};

/** Pedido con DEVUELTO */
const ORDER_DEVUELTO = {
  ...ORDER_REGISTRADO,
  id: 'order-3',
  orderNumber: 'ORD-003',
  evaStatus: 'DEVUELTO',
  evaTrackingId: 'EVA-TRK-003',
  created_at: '2025-06-03T09:00:00Z',
  customer: { fullName: 'Ana Torres', id: 'c3', companyId: 'company-1' },
};

/** Pedido SIN evaStatus → NO debe aparecer */
const ORDER_NO_EVA = {
  ...ORDER_REGISTRADO,
  id: 'order-4',
  orderNumber: 'ORD-004',
  evaStatus: null,
  evaSyncedAt: null,
  evaTrackingId: null,
  created_at: '2025-06-04T09:00:00Z',
  customer: { fullName: 'Pedro Ruiz', id: 'c4', companyId: 'company-1' },
};

// ── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  process.env.NEXT_PUBLIC_API_VENTAS = 'http://api-ventas';
  mockUseAuth.mockReturnValue(MOCK_AUTH as unknown as ReturnType<typeof useAuth>);
  mockAxiosGet.mockResolvedValue({ data: [ORDER_REGISTRADO, ORDER_ENTREGADO, ORDER_NO_EVA] });
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function renderView() {
  return render(<EvaOrderTrackingView />);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('EvaOrderTrackingView', () => {

  // ── 1. Fetch al endpoint correcto y filtrado por evaStatus ─────────────────

  describe('fetch inicial y filtrado de pedidos', () => {
    it('llama a axios.get con la URL correcta al montar', async () => {
      renderView();
      await waitFor(() => {
        expect(mockAxiosGet).toHaveBeenCalledWith(
          'http://api-ventas/order-header/store/store-1',
        );
      });
    });

    it('muestra el pedido que tiene evaStatus', async () => {
      renderView();
      expect(await screen.findByText('ORD-001')).toBeInTheDocument();
    });

    it('muestra el número de pedido ENTREGADO que también tiene evaStatus', async () => {
      renderView();
      expect(await screen.findByText('ORD-002')).toBeInTheDocument();
    });

    it('NO muestra el pedido sin evaStatus (evaStatus: null)', async () => {
      renderView();
      // Esperar a que la carga termine (el pedido con estado aparece)
      await screen.findByText('ORD-001');
      expect(screen.queryByText('ORD-004')).not.toBeInTheDocument();
    });

    it('muestra el nombre del cliente del pedido con evaStatus', async () => {
      renderView();
      expect(await screen.findByText('María García')).toBeInTheDocument();
    });

    it('muestra el evaTrackingId en la columna Tracking EVA', async () => {
      renderView();
      expect(await screen.findByText('EVA-TRK-001')).toBeInTheDocument();
    });
  });

  // ── 2. Resumen de contadores por estado ────────────────────────────────────

  describe('resumen de contadores por estado', () => {
    // Nota: el label de cada estado aparece simultáneamente en 3 lugares del DOM
    // (la burbuja de resumen, el <option> del selector "Estado EVA" — que lista
    // TODOS los estados conocidos siempre — y el badge de la fila). Por eso las
    // aserciones sobre el resumen usan getByRole('button', ...) para apuntar
    // específicamente a la burbuja clicable y evitar coincidencias múltiples.

    it('muestra el label "Registrado" en el resumen cuando hay un pedido REGISTRADO', async () => {
      renderView();
      await screen.findByText('ORD-001');
      expect(screen.getByRole('button', { name: /registrado/i })).toBeInTheDocument();
    });

    it('muestra el label "Entregado" en el resumen cuando hay un pedido ENTREGADO', async () => {
      renderView();
      await screen.findByText('ORD-002');
      expect(screen.getByRole('button', { name: /entregado/i })).toBeInTheDocument();
    });

    it('muestra el conteo 1 para el estado REGISTRADO', async () => {
      // Datos: 1 REGISTRADO, 1 ENTREGADO → la burbuja de conteo de REGISTRADO es "1"
      renderView();
      await screen.findByText('ORD-001');
      const registradoBtns = screen.getAllByRole('button', { name: /registrado/i });
      expect(registradoBtns.length).toBeGreaterThan(0);
      expect(registradoBtns[0].textContent).toContain('1');
    });

    it('muestra el conteo 1 para el estado ENTREGADO', async () => {
      renderView();
      await screen.findByText('ORD-002');
      const entregadoBtns = screen.getAllByRole('button', { name: /entregado/i });
      expect(entregadoBtns.length).toBeGreaterThan(0);
      expect(entregadoBtns[0].textContent).toContain('1');
    });

    it('no muestra el resumen cuando no hay pedidos con evaStatus', async () => {
      mockAxiosGet.mockResolvedValue({ data: [ORDER_NO_EVA] });
      renderView();
      await screen.findByText('No hay pedidos enviados a EVA Courier');
      // El resumen de contadores (botón clicable) no aparece. Nota: "Registrado"
      // existe igual como <option> del filtro de estado, por eso se chequea el botón del resumen.
      expect(screen.queryByRole('button', { name: /registrado/i })).not.toBeInTheDocument();
    });

    it('muestra "Devuelto" en el resumen cuando hay un DEVUELTO', async () => {
      mockAxiosGet.mockResolvedValue({ data: [ORDER_REGISTRADO, ORDER_DEVUELTO] });
      renderView();
      await screen.findByText('ORD-003');
      expect(screen.getByRole('button', { name: /devuelto/i })).toBeInTheDocument();
    });

    it('clickear un contador de estado lo activa como filtro y muestra "Limpiar filtro"', async () => {
      const user = userEvent.setup();
      renderView();
      await screen.findByText('ORD-001');

      const registradoBtns = screen.getAllByRole('button', { name: /registrado/i });
      await user.click(registradoBtns[0]);

      expect(screen.getByText('Limpiar filtro')).toBeInTheDocument();
      // Solo queda el pedido REGISTRADO
      expect(screen.getByText('ORD-001')).toBeInTheDocument();
      expect(screen.queryByText('ORD-002')).not.toBeInTheDocument();
    });

    it('clickear el mismo contador de estado dos veces desactiva el filtro', async () => {
      const user = userEvent.setup();
      renderView();
      await screen.findByText('ORD-001');

      const registradoBtns = screen.getAllByRole('button', { name: /registrado/i });
      await user.click(registradoBtns[0]);
      expect(screen.queryByText('ORD-002')).not.toBeInTheDocument();

      const registradoBtnsAgain = screen.getAllByRole('button', { name: /registrado/i });
      await user.click(registradoBtnsAgain[0]);

      expect(screen.getByText('ORD-001')).toBeInTheDocument();
      expect(screen.getByText('ORD-002')).toBeInTheDocument();
    });

    it('click en "Limpiar filtro" restaura todos los pedidos', async () => {
      const user = userEvent.setup();
      renderView();
      await screen.findByText('ORD-001');

      const registradoBtns = screen.getAllByRole('button', { name: /registrado/i });
      await user.click(registradoBtns[0]);
      expect(screen.queryByText('ORD-002')).not.toBeInTheDocument();

      await user.click(screen.getByText('Limpiar filtro'));

      expect(screen.getByText('ORD-001')).toBeInTheDocument();
      expect(screen.getByText('ORD-002')).toBeInTheDocument();
    });
  });

  // ── 3. Botón "Actualizar" dispara nuevo fetch ──────────────────────────────

  describe('botón Actualizar', () => {
    it('el botón "Actualizar" está en el DOM', async () => {
      renderView();
      await screen.findByText('ORD-001');
      expect(screen.getByRole('button', { name: /actualizar/i })).toBeInTheDocument();
    });

    it('al hacer click en "Actualizar" se dispara un segundo fetch', async () => {
      const user = userEvent.setup();
      renderView();
      await screen.findByText('ORD-001');

      // Primer fetch ya fue llamado al montar
      expect(mockAxiosGet).toHaveBeenCalledTimes(1);

      await user.click(screen.getByRole('button', { name: /actualizar/i }));

      await waitFor(() => {
        expect(mockAxiosGet).toHaveBeenCalledTimes(2);
      });
    });

    it('el segundo fetch usa la misma URL que el inicial', async () => {
      const user = userEvent.setup();
      renderView();
      await screen.findByText('ORD-001');

      await user.click(screen.getByRole('button', { name: /actualizar/i }));

      await waitFor(() => {
        expect(mockAxiosGet).toHaveBeenNthCalledWith(
          2,
          'http://api-ventas/order-header/store/store-1',
        );
      });
    });
  });

  // ── 4. Buscador — filtrado por N° de pedido y cliente ──────────────────────

  describe('buscador', () => {
    beforeEach(() => {
      mockAxiosGet.mockResolvedValue({
        data: [ORDER_REGISTRADO, ORDER_ENTREGADO, ORDER_DEVUELTO],
      });
    });

    it('el placeholder del buscador indica "N° pedido o cliente..."', async () => {
      renderView();
      await screen.findByText('ORD-001');
      expect(screen.getByPlaceholderText(/n° pedido o cliente/i)).toBeInTheDocument();
    });

    it('buscar por número de pedido exacto muestra solo ese pedido', async () => {
      const user = userEvent.setup();
      renderView();
      await screen.findByText('ORD-001');

      await user.type(screen.getByPlaceholderText(/n° pedido o cliente/i), 'ORD-002');

      expect(screen.getByText('ORD-002')).toBeInTheDocument();
      expect(screen.queryByText('ORD-001')).not.toBeInTheDocument();
      expect(screen.queryByText('ORD-003')).not.toBeInTheDocument();
    });

    it('buscar por nombre de cliente filtra por fullName', async () => {
      const user = userEvent.setup();
      renderView();
      await screen.findByText('ORD-001');

      await user.type(screen.getByPlaceholderText(/n° pedido o cliente/i), 'Ana Torres');

      expect(screen.getByText('ORD-003')).toBeInTheDocument();
      expect(screen.queryByText('ORD-001')).not.toBeInTheDocument();
      expect(screen.queryByText('ORD-002')).not.toBeInTheDocument();
    });

    it('buscar por texto parcial del número de pedido filtra correctamente', async () => {
      const user = userEvent.setup();
      renderView();
      await screen.findByText('ORD-001');

      // "ORD" coincide con todos
      await user.type(screen.getByPlaceholderText(/n° pedido o cliente/i), 'ORD');

      expect(screen.getByText('ORD-001')).toBeInTheDocument();
      expect(screen.getByText('ORD-002')).toBeInTheDocument();
      expect(screen.getByText('ORD-003')).toBeInTheDocument();
    });

    it('buscar por texto sin coincidencia muestra el mensaje de vacío con hint de filtros', async () => {
      const user = userEvent.setup();
      renderView();
      await screen.findByText('ORD-001');

      await user.type(
        screen.getByPlaceholderText(/n° pedido o cliente/i),
        'XXXXXX-INEXISTENTE',
      );

      expect(screen.getByText('No hay pedidos enviados a EVA Courier')).toBeInTheDocument();
      expect(screen.getByText(/probá quitando los filtros activos/i)).toBeInTheDocument();
    });

    it('borrar la búsqueda restaura todos los pedidos', async () => {
      const user = userEvent.setup();
      renderView();
      await screen.findByText('ORD-001');

      const input = screen.getByPlaceholderText(/n° pedido o cliente/i);
      await user.type(input, 'ORD-002');
      expect(screen.queryByText('ORD-001')).not.toBeInTheDocument();

      await user.clear(input);
      expect(screen.getByText('ORD-001')).toBeInTheDocument();
    });
  });

  // ── 5. Selector de estado (filtro por <select>) ─────────────────────────────

  describe('selector de estado EVA', () => {
    it('lista las opciones de estado EVA con su label', async () => {
      renderView();
      await screen.findByText('ORD-001');
      expect(screen.getByRole('option', { name: 'Registrado' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Entregado' })).toBeInTheDocument();
    });

    it('seleccionar un estado filtra la tabla a solo ese estado', async () => {
      mockAxiosGet.mockResolvedValue({
        data: [ORDER_REGISTRADO, ORDER_ENTREGADO],
      });
      const user = userEvent.setup();
      renderView();
      await screen.findByText('ORD-001');

      await user.selectOptions(screen.getByRole('combobox'), 'ENTREGADO');

      expect(screen.getByText('ORD-002')).toBeInTheDocument();
      expect(screen.queryByText('ORD-001')).not.toBeInTheDocument();
    });
  });

  // ── 6. Estado vacío ────────────────────────────────────────────────────────

  describe('estado vacío', () => {
    it('muestra "No hay pedidos enviados a EVA Courier" cuando la API no devuelve pedidos', async () => {
      mockAxiosGet.mockResolvedValue({ data: [] });
      renderView();
      expect(await screen.findByText('No hay pedidos enviados a EVA Courier')).toBeInTheDocument();
    });

    it('muestra "No hay pedidos enviados a EVA Courier" cuando todos los pedidos carecen de evaStatus', async () => {
      mockAxiosGet.mockResolvedValue({ data: [ORDER_NO_EVA] });
      renderView();
      expect(await screen.findByText('No hay pedidos enviados a EVA Courier')).toBeInTheDocument();
    });

    it('no muestra el hint de filtros activos cuando no hay búsqueda ni filtros', async () => {
      mockAxiosGet.mockResolvedValue({ data: [] });
      renderView();
      await screen.findByText('No hay pedidos enviados a EVA Courier');
      expect(screen.queryByText(/probá quitando los filtros activos/i)).not.toBeInTheDocument();
    });
  });

  // ── 7. No fetch si selectedStoreId es null ─────────────────────────────────

  describe('sin storeId', () => {
    it('no llama a axios.get cuando selectedStoreId es null', () => {
      mockUseAuth.mockReturnValue({
        ...MOCK_AUTH,
        selectedStoreId: null,
      } as unknown as ReturnType<typeof useAuth>);

      renderView();

      expect(mockAxiosGet).not.toHaveBeenCalled();
    });
  });

  // ── 8. Error de fetch ──────────────────────────────────────────────────────

  describe('error de fetch', () => {
    it('llama a toast.error cuando axios.get rechaza', async () => {
      mockAxiosGet.mockRejectedValue(new Error('Network error'));
      renderView();
      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith(
          expect.stringMatching(/error al cargar pedidos de eva courier/i),
        );
      });
    });

    it('no crashea el componente cuando el fetch falla', async () => {
      mockAxiosGet.mockRejectedValue(new Error('500'));
      renderView();
      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalled();
      });
      // El componente sigue en pie — la tabla vacía se muestra
      expect(screen.getByText('No hay pedidos enviados a EVA Courier')).toBeInTheDocument();
    });
  });

  // ── 9. Contador de registros ──────────────────────────────────────────────

  describe('contador de registros visibles', () => {
    it('muestra "2 registros" cuando hay 2 pedidos con evaStatus', async () => {
      renderView();
      expect(await screen.findByText(/2 registros/i)).toBeInTheDocument();
    });

    it('muestra "1 registro" cuando solo un pedido pasa el filtro', async () => {
      const user = userEvent.setup();
      renderView();
      await screen.findByText('ORD-001');

      await user.type(screen.getByPlaceholderText(/n° pedido o cliente/i), 'ORD-001');

      expect(screen.getByText(/1 registro$/)).toBeInTheDocument();
    });
  });
});
