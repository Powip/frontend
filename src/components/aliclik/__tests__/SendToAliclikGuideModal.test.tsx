/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Tests: SendToAliclikGuideModal
 *
 * Comportamiento verificado:
 * 1. Al abrir con N pedidos llama a quoteAliclikOrder una vez por pedido.
 * 2. Un pedido con unresolvedItems no vacío muestra el banner bloqueante
 *    "Productos no enlazados al catálogo Aliclik" y queda marcado como
 *    "Bloqueado — productos no enlazados"; el botón de envío global solo
 *    incluye los pedidos enviables.
 * 3. "Enviar N a Aliclik" llama a createAliclikOrder una vez por pedido
 *    enviable, muestra la pantalla de resultado con éxitos
 *    (externalOrderNumber) y dispara onSuccess.
 * 4. Si createAliclikOrder falla para un pedido el resumen lo marca como
 *    error; los demás pedidos se reportan como éxito. onSuccess se llama
 *    igual porque el proceso completo terminó.
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

jest.mock('@/services/aliclikService', () => ({
  quoteAliclikOrder: jest.fn(),
  createAliclikOrder: jest.fn(),
}));

/**
 * Mock de Radix Select → <select> nativo.
 * Idéntico al usado en SendToAliclikModal.test.tsx.
 */
jest.mock('@/components/ui/select', () => {
  const React = require('react');

  function extractText(node: unknown): string {
    if (node === null || node === undefined) return '';
    if (typeof node === 'string' || typeof node === 'number') return String(node);
    if (typeof node === 'boolean') return '';
    if (Array.isArray(node)) return node.map(extractText).join('');
    if (typeof node === 'object' && node !== null && 'props' in node) {
      const el = node as { props: { children?: unknown } };
      return extractText(el.props.children);
    }
    return '';
  }

  const Select = ({
    value,
    onValueChange,
    children,
  }: {
    value?: string;
    onValueChange?: (v: string) => void;
    children?: React.ReactNode;
  }) => {
    const options: { value: string; label: string }[] = [];
    React.Children.forEach(
      children,
      (child: React.ReactElement<{ children?: React.ReactNode }>) => {
        if (!child || !child.props) return;
        if (child.props.children) {
          React.Children.forEach(
            child.props.children,
            (item: React.ReactElement<{ value?: string; children?: React.ReactNode }>) => {
              if (item && item.props && item.props.value !== undefined) {
                options.push({
                  value: item.props.value,
                  label: extractText(item.props.children),
                });
              }
            },
          );
        }
      },
    );
    return (
      <select
        value={value}
        onChange={(e) => onValueChange?.(e.target.value)}
        data-testid="select-mock"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    );
  };

  const SelectContent = ({ children }: { children?: React.ReactNode }) => <>{children}</>;
  const SelectItem = ({
    value,
    children,
  }: {
    value: string;
    children?: React.ReactNode;
  }) => <option value={value}>{children}</option>;
  const SelectTrigger = ({ children }: { children?: React.ReactNode }) => <>{children}</>;
  const SelectValue = ({ placeholder }: { placeholder?: string }) => (
    <span>{placeholder}</span>
  );

  return { Select, SelectContent, SelectItem, SelectTrigger, SelectValue };
});

/**
 * Mock de Radix Dialog → div simple.
 * Renderiza children directamente cuando open=true.
 */
jest.mock('@/components/ui/dialog', () => {
  const React = require('react');
  const Dialog = ({
    open,
    children,
  }: {
    open?: boolean;
    children?: React.ReactNode;
  }) => (open ? <div data-testid="dialog">{children}</div> : null);

  const DialogContent = ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="dialog-content">{children}</div>
  );
  const DialogHeader = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  const DialogTitle = ({ children }: { children?: React.ReactNode }) => <h2>{children}</h2>;

  return { Dialog, DialogContent, DialogHeader, DialogTitle };
});

jest.mock('@/components/ui/card', () => {
  const React = require('react');
  const Card = ({
    children,
    className,
  }: {
    children?: React.ReactNode;
    className?: string;
  }) => (
    <div data-testid="card" className={className}>
      {children}
    </div>
  );
  const CardContent = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  return { Card, CardContent };
});

jest.mock('@/components/ui/button', () => {
  const React = require('react');
  const Button = ({
    children,
    onClick,
    disabled,
    className,
  }: {
    children?: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    className?: string;
  }) => (
    <button onClick={onClick} disabled={disabled} className={className}>
      {children}
    </button>
  );
  const buttonVariants = () => '';
  return { Button, buttonVariants };
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

jest.mock('lucide-react', () => ({
  Loader2: ({ className }: { className?: string }) => (
    <span data-testid="loader" className={className} />
  ),
  CheckCircle2: () => null,
  AlertCircle: () => null,
  Package: () => null,
  XCircle: () => null,
}));

jest.mock('@/lib/utils', () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
}));

// ── Imports bajo prueba (después de los mocks) ───────────────────────────────

import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { quoteAliclikOrder, createAliclikOrder } from '@/services/aliclikService';
import SendToAliclikGuideModal from '../SendToAliclikGuideModal';

// ── Casts ────────────────────────────────────────────────────────────────────

const mockUseAuth = jest.mocked(useAuth);
const mockQuote = jest.mocked(quoteAliclikOrder);
const mockCreate = jest.mocked(createAliclikOrder);
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
  selectedStoreId: null,
  setSelectedStore: jest.fn(),
  inventories: [],
  refreshInventories: jest.fn(),
  hasPermission: jest.fn().mockReturnValue(true),
};

const MOCK_COURIER = {
  id: 10,
  transportId: 100,
  transportName: 'Courier Express',
  transportUrlImage: '',
  addDays: 2,
  deliveryCost: 15.5,
  returnCost: 8.0,
  flagDeliveryExpress: false,
  schedule: null,
  scheduleExpressStart: null,
  scheduleExpressEnd: null,
};

/** Quote base para un pedido sin problemas (1 almacén con cobertura). */
function makeMockQuote(orderId: string, orderNumber: string) {
  return {
    orderId,
    orderNumber,
    companyId: 'company-1',
    shippingTotalSugerido: 15.5,
    customer: {
      lat: -12.0,
      lng: -77.0,
      fullName: 'Cliente Test',
      province: 'Lima',
      city: 'Lima',
      district: 'Miraflores',
    },
    warehouses: [
      {
        warehouseId: 1,
        warehouseName: 'Almacén Principal',
        ubigeo: { department: 'Lima', province: 'Lima', district: 'San Isidro' },
        items: [
          { sku: 'SKU-001', ean: '', quantity: 2, unitPrice: 50.0, productName: 'Producto A' },
        ],
        couriers: [MOCK_COURIER],
      },
    ],
    unresolvedItems: [],
  };
}

/** Quote con unresolvedItems para el escenario bloqueante. */
function makeMockQuoteWithUnresolved(orderId: string, orderNumber: string) {
  return {
    ...makeMockQuote(orderId, orderNumber),
    unresolvedItems: [{ sku: 'SKU-X', productName: 'Producto Sin Enlace' }],
  };
}

const MOCK_CREATE_RESULT = {
  shipments: [{ warehouseId: 1, externalOrderNumber: 'ALI-99999' }],
};

/** Pedidos de ejemplo para los tests multi-pedido. */
const ORDER_1 = { id: 'order-1', orderNumber: 'ORD-001', customer: { fullName: 'Ana López' } };
const ORDER_2 = { id: 'order-2', orderNumber: 'ORD-002', customer: { fullName: 'Luis Pérez' } };

const BASE_PROPS = {
  open: true,
  guideId: 'guide-abc',
  companyId: 'company-1',
  orders: [ORDER_1, ORDER_2],
  onClose: jest.fn(),
  onSuccess: jest.fn(),
};

// ── Helper ───────────────────────────────────────────────────────────────────

function renderModal(propOverrides: Partial<typeof BASE_PROPS> = {}) {
  return render(<SendToAliclikGuideModal {...BASE_PROPS} {...propOverrides} />);
}

/** Espera a que la cotización de todos los pedidos haya cargado. */
async function waitForQuotesLoaded() {
  // El texto "Cotizando en Aliclik..." desaparece cuando todas las cotizaciones terminan.
  await waitFor(() => {
    expect(screen.queryByText(/cotizando en aliclik/i)).not.toBeInTheDocument();
  });
}

// ── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  mockUseAuth.mockReturnValue(MOCK_AUTH as unknown as ReturnType<typeof useAuth>);

  // Por defecto: ambos pedidos se cotizan exitosamente
  mockQuote.mockImplementation((_, __, orderId) =>
    Promise.resolve(makeMockQuote(orderId as string, orderId === 'order-1' ? 'ORD-001' : 'ORD-002')),
  );

  mockCreate.mockResolvedValue(MOCK_CREATE_RESULT);
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe('SendToAliclikGuideModal', () => {

  // ── 1. Cotización: una llamada por pedido ─────────────────────────────────

  describe('cotización al abrir', () => {
    it('muestra spinner de carga mientras cotiza los pedidos', () => {
      mockQuote.mockReturnValue(new Promise(() => {}));
      renderModal();
      expect(screen.getAllByText(/cotizando en aliclik/i).length).toBeGreaterThan(0);
    });

    it('llama a quoteAliclikOrder exactamente una vez por pedido al abrir con 2 pedidos', async () => {
      renderModal();
      await waitForQuotesLoaded();
      expect(mockQuote).toHaveBeenCalledTimes(2);
    });

    it('llama a quoteAliclikOrder con token, companyId y el id de cada pedido', async () => {
      renderModal();
      await waitForQuotesLoaded();
      expect(mockQuote).toHaveBeenCalledWith('fake-token', 'company-1', 'order-1');
      expect(mockQuote).toHaveBeenCalledWith('fake-token', 'company-1', 'order-2');
    });

    it('llama a quoteAliclikOrder una sola vez si solo hay 1 pedido', async () => {
      renderModal({ orders: [ORDER_1] });
      await waitFor(() => expect(mockQuote).toHaveBeenCalledTimes(1));
    });

    it('NO llama a quoteAliclikOrder cuando open=false', () => {
      renderModal({ open: false });
      expect(mockQuote).not.toHaveBeenCalled();
    });

    it('muestra el número de pedidos en el título', async () => {
      renderModal();
      // El título incluye "2 pedidos"
      expect(await screen.findByText(/2 pedidos/i)).toBeInTheDocument();
    });

    it('muestra el orderNumber de cada pedido tras cotizar', async () => {
      renderModal();
      await waitForQuotesLoaded();
      expect(screen.getByText('#ORD-001')).toBeInTheDocument();
      expect(screen.getByText('#ORD-002')).toBeInTheDocument();
    });

    it('muestra el indicador "Listo para enviar" cuando un pedido cotizó sin problemas', async () => {
      renderModal();
      await waitForQuotesLoaded();
      const readyIndicators = screen.getAllByText(/listo para enviar/i);
      expect(readyIndicators.length).toBe(2);
    });

    it('muestra el resumen "N de M" pedidos a enviar en la barra inferior', async () => {
      renderModal();
      await waitForQuotesLoaded();
      // Debería decir "2 de 2"
      expect(screen.getByText('2 de 2')).toBeInTheDocument();
    });
  });

  // ── 2. Banner bloqueante por unresolvedItems ──────────────────────────────

  describe('pedido con unresolvedItems (banner bloqueante)', () => {
    beforeEach(() => {
      // order-1 tiene unresolved, order-2 está OK
      mockQuote.mockImplementation((_, __, orderId) => {
        if (orderId === 'order-1') {
          return Promise.resolve(makeMockQuoteWithUnresolved('order-1', 'ORD-001'));
        }
        return Promise.resolve(makeMockQuote('order-2', 'ORD-002'));
      });
    });

    it('muestra el banner "Productos no enlazados al catálogo Aliclik" para el pedido bloqueado', async () => {
      renderModal();
      await waitForQuotesLoaded();
      expect(screen.getByText(/productos no enlazados al catálogo aliclik/i)).toBeInTheDocument();
    });

    it('muestra el SKU del ítem no enlazado dentro del banner', async () => {
      renderModal();
      await waitForQuotesLoaded();
      expect(screen.getByText('SKU-X')).toBeInTheDocument();
    });

    it('muestra el indicador "Bloqueado — productos no enlazados" para el pedido con unresolved', async () => {
      renderModal();
      await waitForQuotesLoaded();
      expect(screen.getByText(/bloqueado — productos no enlazados/i)).toBeInTheDocument();
    });

    it('el pedido sin unresolvedItems sigue mostrando "Listo para enviar"', async () => {
      renderModal();
      await waitForQuotesLoaded();
      expect(screen.getByText(/listo para enviar/i)).toBeInTheDocument();
    });

    it('el resumen muestra "1 de 2" pedidos enviables', async () => {
      renderModal();
      await waitForQuotesLoaded();
      expect(screen.getByText('1 de 2')).toBeInTheDocument();
    });

    it('NO llama a createAliclikOrder para el pedido bloqueado al enviar', async () => {
      renderModal();
      await waitForQuotesLoaded();

      const user = userEvent.setup();
      const btn = screen.getByRole('button', { name: /enviar/i });
      await waitFor(() => expect(btn).not.toBeDisabled());
      await user.click(btn);

      await waitFor(() => expect(mockCreate).toHaveBeenCalled());

      // Solo se creó 1 pedido (order-2), NO order-1
      expect(mockCreate).toHaveBeenCalledTimes(1);
      expect(mockCreate).toHaveBeenCalledWith(
        'fake-token',
        expect.objectContaining({ orderId: 'order-2' }),
      );
      expect(mockCreate).not.toHaveBeenCalledWith(
        'fake-token',
        expect.objectContaining({ orderId: 'order-1' }),
      );
    });
  });

  // ── 3. Enviar todos: createAliclikOrder por pedido, resumen, onSuccess ─────

  describe('envío exitoso de todos los pedidos', () => {
    it('el botón de envío muestra el conteo de pedidos enviables', async () => {
      renderModal();
      await waitForQuotesLoaded();
      // Con 2 pedidos enviables: "Enviar 2 a Aliclik"
      expect(screen.getByRole('button', { name: /enviar 2 a aliclik/i })).toBeInTheDocument();
    });

    it('llama a createAliclikOrder una vez por pedido enviable', async () => {
      renderModal();
      await waitForQuotesLoaded();

      const user = userEvent.setup();
      const btn = screen.getByRole('button', { name: /enviar/i });
      await waitFor(() => expect(btn).not.toBeDisabled());
      await user.click(btn);

      await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(2));
    });

    it('llama a createAliclikOrder con companyId, orderId y shipments correctos', async () => {
      renderModal();
      await waitForQuotesLoaded();

      const user = userEvent.setup();
      const btn = screen.getByRole('button', { name: /enviar/i });
      await waitFor(() => expect(btn).not.toBeDisabled());
      await user.click(btn);

      await waitFor(() => {
        expect(mockCreate).toHaveBeenCalledWith(
          'fake-token',
          expect.objectContaining({
            companyId: 'company-1',
            orderId: 'order-1',
            shipments: expect.arrayContaining([
              expect.objectContaining({
                warehouseId: 1,
                courier: expect.objectContaining({
                  transportId: MOCK_COURIER.transportId,
                  deliveryCost: MOCK_COURIER.deliveryCost,
                }),
              }),
            ]),
          }),
        );
      });
    });

    it('muestra la pantalla de resultado con "¡Pedidos creados!" cuando todos exitosos', async () => {
      renderModal();
      await waitForQuotesLoaded();

      const user = userEvent.setup();
      const btn = screen.getByRole('button', { name: /enviar/i });
      await waitFor(() => expect(btn).not.toBeDisabled());
      await user.click(btn);

      expect(await screen.findByText('¡Pedidos creados!')).toBeInTheDocument();
    });

    it('muestra la sección "Pedidos creados en Aliclik:" tras el envío exitoso', async () => {
      renderModal();
      await waitForQuotesLoaded();

      const user = userEvent.setup();
      const btn = screen.getByRole('button', { name: /enviar/i });
      await waitFor(() => expect(btn).not.toBeDisabled());
      await user.click(btn);

      expect(await screen.findByText(/pedidos creados en aliclik/i)).toBeInTheDocument();
    });

    it('muestra el externalOrderNumber de cada pedido exitoso en el resumen', async () => {
      mockCreate.mockResolvedValue({
        shipments: [{ warehouseId: 1, externalOrderNumber: 'ALI-12345' }],
      });
      renderModal();
      await waitForQuotesLoaded();

      const user = userEvent.setup();
      const btn = screen.getByRole('button', { name: /enviar/i });
      await waitFor(() => expect(btn).not.toBeDisabled());
      await user.click(btn);

      // Aparece 2 veces (una por cada pedido exitoso)
      const numbers = await screen.findAllByText('ALI-12345');
      expect(numbers.length).toBeGreaterThanOrEqual(1);
    });

    it('llama a onSuccess tras completar el envío', async () => {
      renderModal();
      await waitForQuotesLoaded();

      const user = userEvent.setup();
      const btn = screen.getByRole('button', { name: /enviar/i });
      await waitFor(() => expect(btn).not.toBeDisabled());
      await user.click(btn);

      await waitFor(() => {
        expect(BASE_PROPS.onSuccess).toHaveBeenCalled();
      });
    });

    it('llama a toast.success cuando todos los pedidos se crean correctamente', async () => {
      renderModal();
      await waitForQuotesLoaded();

      const user = userEvent.setup();
      const btn = screen.getByRole('button', { name: /enviar/i });
      await waitFor(() => expect(btn).not.toBeDisabled());
      await user.click(btn);

      await waitFor(() => {
        expect(mockToast.success).toHaveBeenCalledWith(
          expect.stringContaining('Aliclik'),
        );
      });
    });

    it('muestra el botón "Entendido, cerrar" en la pantalla de resultado', async () => {
      renderModal();
      await waitForQuotesLoaded();

      const user = userEvent.setup();
      const btn = screen.getByRole('button', { name: /enviar/i });
      await waitFor(() => expect(btn).not.toBeDisabled());
      await user.click(btn);

      expect(await screen.findByRole('button', { name: /entendido, cerrar/i })).toBeInTheDocument();
    });
  });

  // ── 4. Envío parcial: un pedido falla, los demás siguen ───────────────────

  describe('envío secuencial con error parcial', () => {
    beforeEach(() => {
      // order-1 falla, order-2 tiene éxito
      mockCreate.mockImplementation((_, payload) => {
        if ((payload as { orderId: string }).orderId === 'order-1') {
          return Promise.reject({
            response: { data: { message: 'Stock insuficiente en Aliclik' } },
          });
        }
        return Promise.resolve({
          shipments: [{ warehouseId: 1, externalOrderNumber: 'ALI-88888' }],
        });
      });
    });

    it('llama a createAliclikOrder para cada pedido enviable, incluso si uno falla', async () => {
      renderModal();
      await waitForQuotesLoaded();

      const user = userEvent.setup();
      const btn = screen.getByRole('button', { name: /enviar/i });
      await waitFor(() => expect(btn).not.toBeDisabled());
      await user.click(btn);

      await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(2));
    });

    it('muestra "¡Proceso completado!" cuando hay al menos un error', async () => {
      renderModal();
      await waitForQuotesLoaded();

      const user = userEvent.setup();
      const btn = screen.getByRole('button', { name: /enviar/i });
      await waitFor(() => expect(btn).not.toBeDisabled());
      await user.click(btn);

      expect(await screen.findByText('¡Proceso completado!')).toBeInTheDocument();
    });

    it('muestra el pedido exitoso con su externalOrderNumber en el resumen', async () => {
      renderModal();
      await waitForQuotesLoaded();

      const user = userEvent.setup();
      const btn = screen.getByRole('button', { name: /enviar/i });
      await waitFor(() => expect(btn).not.toBeDisabled());
      await user.click(btn);

      expect(await screen.findByText('ALI-88888')).toBeInTheDocument();
    });

    it('muestra la sección de pedidos fallidos con el mensaje de error', async () => {
      renderModal();
      await waitForQuotesLoaded();

      const user = userEvent.setup();
      const btn = screen.getByRole('button', { name: /enviar/i });
      await waitFor(() => expect(btn).not.toBeDisabled());
      await user.click(btn);

      expect(await screen.findByText(/pedido\(s\) fallaron/i)).toBeInTheDocument();
      expect(await screen.findByText(/stock insuficiente en aliclik/i)).toBeInTheDocument();
    });

    it('llama a toast.warning (no toast.success) cuando hay errores parciales', async () => {
      renderModal();
      await waitForQuotesLoaded();

      const user = userEvent.setup();
      const btn = screen.getByRole('button', { name: /enviar/i });
      await waitFor(() => expect(btn).not.toBeDisabled());
      await user.click(btn);

      await waitFor(() => {
        expect(mockToast.warning).toHaveBeenCalled();
      });
      expect(mockToast.success).not.toHaveBeenCalled();
    });

    it('llama igualmente a onSuccess aunque haya errores parciales', async () => {
      renderModal();
      await waitForQuotesLoaded();

      const user = userEvent.setup();
      const btn = screen.getByRole('button', { name: /enviar/i });
      await waitFor(() => expect(btn).not.toBeDisabled());
      await user.click(btn);

      await waitFor(() => {
        expect(BASE_PROPS.onSuccess).toHaveBeenCalled();
      });
    });

    it('el pedido fallido aparece en la sección de errores con su orderNumber', async () => {
      renderModal();
      await waitForQuotesLoaded();

      const user = userEvent.setup();
      const btn = screen.getByRole('button', { name: /enviar/i });
      await waitFor(() => expect(btn).not.toBeDisabled());
      await user.click(btn);

      // La pantalla de resultado lista "#ORD-001" (el que falló) dentro del bloque de errores
      await waitFor(() => {
        expect(screen.getByText(/ORD-001/)).toBeInTheDocument();
      });
    });
  });

  // ── 5. Estado de envío (botón deshabilitado mientras se envía) ────────────

  describe('estado visual durante el envío', () => {
    it('el botón de envío muestra "Enviando pedidos..." mientras se procesa', async () => {
      mockCreate.mockReturnValue(new Promise(() => {})); // nunca resuelve
      renderModal();
      await waitForQuotesLoaded();

      const user = userEvent.setup();
      const btn = screen.getByRole('button', { name: /enviar/i });
      await waitFor(() => expect(btn).not.toBeDisabled());
      await user.click(btn);

      await waitFor(() => {
        expect(screen.getByText(/enviando pedidos/i)).toBeInTheDocument();
      });
    });
  });

  // ── 6. Sin pedidos seleccionados ──────────────────────────────────────────

  describe('modal con lista de pedidos vacía', () => {
    it('muestra "No hay pedidos seleccionados" cuando orders=[]', () => {
      renderModal({ orders: [] });
      expect(screen.getByText(/no hay pedidos seleccionados/i)).toBeInTheDocument();
    });

    it('NO llama a quoteAliclikOrder cuando orders=[]', () => {
      renderModal({ orders: [] });
      expect(mockQuote).not.toHaveBeenCalled();
    });
  });

  // ── 7. Banner bloqueante por coordenadas faltantes ────────────────────────

  describe('pedido con coordenadas faltantes (banner bloqueante)', () => {
    /** Quote con lat=null: cliente sin geolocalización cargada. */
    function makeMockQuoteWithMissingCoords(
      orderId: string,
      orderNumber: string,
      overrides: { lat?: number | null; lng?: number | null } = {},
    ) {
      const base = makeMockQuote(orderId, orderNumber);
      return {
        ...base,
        customer: {
          ...base.customer,
          lat: overrides.lat !== undefined ? overrides.lat : null,
          lng: overrides.lng !== undefined ? overrides.lng : null,
        },
      };
    }

    // ── 7.1 Un único pedido con lat=null ─────────────────────────────────────

    describe('pedido único con lat=null', () => {
      beforeEach(() => {
        mockQuote.mockImplementation((_, __, orderId) =>
          Promise.resolve(
            makeMockQuoteWithMissingCoords(
              orderId as string,
              orderId === 'order-1' ? 'ORD-001' : 'ORD-002',
              { lat: null, lng: null },
            ),
          ),
        );
      });

      it('muestra el banner "Faltan coordenadas del cliente (lat/lng)"', async () => {
        renderModal({ orders: [ORDER_1] });
        await waitForQuotesLoaded();
        expect(
          screen.getByText(/faltan coordenadas del cliente \(lat\/lng\)/i),
        ).toBeInTheDocument();
      });

      it('muestra el texto de acción "Cargalas en la venta antes de enviar a Aliclik"', async () => {
        renderModal({ orders: [ORDER_1] });
        await waitForQuotesLoaded();
        expect(
          screen.getByText(/cargalas en la venta antes de enviar a aliclik/i),
        ).toBeInTheDocument();
      });

      it('muestra el indicador "Bloqueado — faltan coordenadas en la venta"', async () => {
        renderModal({ orders: [ORDER_1] });
        await waitForQuotesLoaded();
        expect(
          screen.getByText(/bloqueado — faltan coordenadas en la venta/i),
        ).toBeInTheDocument();
      });

      it('el botón de envío queda deshabilitado cuando el único pedido tiene coords faltantes', async () => {
        renderModal({ orders: [ORDER_1] });
        await waitForQuotesLoaded();
        const btn = screen.getByRole('button', { name: /enviar/i });
        expect(btn).toBeDisabled();
      });

      it('NO llama a createAliclikOrder cuando el único pedido tiene coords faltantes', async () => {
        renderModal({ orders: [ORDER_1] });
        await waitForQuotesLoaded();
        // El botón está deshabilitado; verificamos que create nunca se llamó
        expect(mockCreate).not.toHaveBeenCalled();
      });
    });

    // ── 7.2 Dos pedidos: uno con coords válidas, otro sin coords ─────────────

    describe('2 pedidos: uno con coords válidas, otro sin coords (lng=null)', () => {
      beforeEach(() => {
        mockQuote.mockImplementation((_, __, orderId) => {
          if (orderId === 'order-1') {
            // order-1 tiene coords válidas
            return Promise.resolve(makeMockQuote('order-1', 'ORD-001'));
          }
          // order-2 sin lng
          return Promise.resolve(
            makeMockQuoteWithMissingCoords('order-2', 'ORD-002', {
              lat: -12.0,
              lng: null,
            }),
          );
        });
      });

      it('el resumen muestra "1 de 2" pedidos enviables', async () => {
        renderModal();
        await waitForQuotesLoaded();
        expect(screen.getByText('1 de 2')).toBeInTheDocument();
      });

      it('el pedido con coords válidas aparece como "Listo para enviar"', async () => {
        renderModal();
        await waitForQuotesLoaded();
        expect(screen.getByText(/listo para enviar/i)).toBeInTheDocument();
      });

      it('el pedido sin coords aparece como "Bloqueado — faltan coordenadas en la venta"', async () => {
        renderModal();
        await waitForQuotesLoaded();
        expect(
          screen.getByText(/bloqueado — faltan coordenadas en la venta/i),
        ).toBeInTheDocument();
      });

      it('al enviar, createAliclikOrder se llama SOLO para el pedido con coords válidas', async () => {
        renderModal();
        await waitForQuotesLoaded();

        const user = userEvent.setup();
        const btn = screen.getByRole('button', { name: /enviar 1 a aliclik/i });
        await waitFor(() => expect(btn).not.toBeDisabled());
        await user.click(btn);

        await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1));
        expect(mockCreate).toHaveBeenCalledWith(
          'fake-token',
          expect.objectContaining({ orderId: 'order-1' }),
        );
        expect(mockCreate).not.toHaveBeenCalledWith(
          'fake-token',
          expect.objectContaining({ orderId: 'order-2' }),
        );
      });

      it('el botón refleja el conteo correcto: "Enviar 1 a Aliclik"', async () => {
        renderModal();
        await waitForQuotesLoaded();
        expect(
          screen.getByRole('button', { name: /enviar 1 a aliclik/i }),
        ).toBeInTheDocument();
      });
    });

    // ── 7.3 lat=0 / lng=0 también se trata como faltante ────────────────────

    describe('coordenadas con valor 0 (equivalente a faltantes)', () => {
      beforeEach(() => {
        mockQuote.mockImplementation((_, __, orderId) =>
          Promise.resolve(
            makeMockQuoteWithMissingCoords(
              orderId as string,
              orderId === 'order-1' ? 'ORD-001' : 'ORD-002',
              { lat: 0, lng: 0 },
            ),
          ),
        );
      });

      it('trata lat=0/lng=0 como faltante y muestra el banner de coordenadas', async () => {
        renderModal({ orders: [ORDER_1] });
        await waitForQuotesLoaded();
        expect(
          screen.getByText(/faltan coordenadas del cliente \(lat\/lng\)/i),
        ).toBeInTheDocument();
      });

      it('trata lat=0/lng=0 como bloqueante: muestra "Bloqueado — faltan coordenadas en la venta"', async () => {
        renderModal({ orders: [ORDER_1] });
        await waitForQuotesLoaded();
        expect(
          screen.getByText(/bloqueado — faltan coordenadas en la venta/i),
        ).toBeInTheDocument();
      });

      it('el botón de envío queda deshabilitado con lat=0/lng=0', async () => {
        renderModal({ orders: [ORDER_1] });
        await waitForQuotesLoaded();
        const btn = screen.getByRole('button', { name: /enviar/i });
        expect(btn).toBeDisabled();
      });
    });
  });
});
