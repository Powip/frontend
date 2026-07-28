/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Tests: SendToEvaGuideModal
 *
 * Comportamiento verificado:
 * 1. Autocompletado por pedido (clientType=ALMACEN): cada Card muestra el SKU
 *    autogenerado en formato "CODIGO(cant),CODIGO(cant)" a partir de
 *    order.items, y el distrito se autoselecciona con el valor CANÓNICO del
 *    maestro cuando matchea de forma tolerante (mayúsculas/espacios extra) o
 *    exacta.
 * 2. Autocompletado por pedido (clientType=RECOJO): "product" se arma con los
 *    nombres de los items separados por coma, y "packages" default es la
 *    cantidad de items (mínimo 1).
 * 3. Edición de pedido: cambiar un input de una Card (dirección, teléfono)
 *    actualiza solo esa Card, sin afectar el resto.
 * 4. Exclusión de pedido: destildar el checkbox de una Card baja en 1 el
 *    contador "Pedidos a enviar" y ese pedido no viaja en el payload al
 *    confirmar el envío.
 * 5. Pedido inválido (distrito sin match contra el maestro): no cuenta como
 *    válido aunque esté tildado, no se incluye en el payload y muestra un
 *    indicador visual de alerta.
 * 6. El envío arma el payload correcto: createEvaOrdersBulk se llama UNA
 *    sola vez con un ítem por cada pedido válido y tildado, con companyId,
 *    orderId, recipientPhone normalizado a "+51XXXXXXXXX" y
 *    paymentMethod/serviceType tomados de los selects globales.
 * 7. Resultado mixto: la pantalla final agrupa creados (con trackingId) y no
 *    enviados (con reason), y dispara toast.warning (no success ni error).
 * 8. Sin credencial activa (null o isActive=false): se muestra el mensaje de
 *    error y NO se renderiza ninguna Card de pedido ni el botón de envío.
 * 9. Detalle de solo lectura del pedido (motivo del rediseño Table→Card): la
 *    Card muestra DNI y teléfono del cliente, la itemización de productos
 *    (nombre, SKU, cantidad, precio unitario) y el monto total del pedido
 *    con el badge "Pendiente S/ X" cuando `payments` deja saldo sin cobrar
 *    (ausente si el pedido está pagado completo).
 *
 * Work-arounds jsdom aplicados (mismo estilo que SendToEvaModal.test.tsx):
 * - @/components/ui/dialog   → mock que renderiza children directamente
 *   cuando open=true.
 * - @/components/ui/select   → mock de <select> nativo (Tipo de servicio /
 *   Método de cobro, globales — fuera de las Cards).
 * - @/components/ui/combobox → mock simplificado: trigger con
 *   role="combobox" (uno POR CARD, ya que cada pedido monta su propia
 *   instancia) + filtrado en cliente, sin abrir/cerrar popover real.
 * - @/components/ui/checkbox → mock de <input type="checkbox"> nativo
 *   (Radix Checkbox no es necesario para estos tests de comportamiento).
 * - @/components/ui/button, input, label → mocks mínimos (pass-through).
 * - @/components/ui/card     → SIN mockear: es un wrapper trivial sobre
 *   <div> con `cn`, sin dependencias de browser APIs, y reenvía cualquier
 *   prop extra (incluido `data-testid`) tal cual — se usa la Card real para
 *   poder escopar cada pedido con `screen.getByTestId('eva-order-card-{id}')`
 *   (el componente no tiene ningún id natural por pedido, a diferencia de
 *   los selects de Aliclik).
 * - lucide-react → iconos como stubs; AlertCircle reenvía aria-label con
 *   role="img" para poder localizar el indicador de pedido inválido sin
 *   recurrir a getByTestId.
 *
 * Los selects globales (Tipo de servicio / Método de cobro) y los combobox
 * de distrito por pedido resuelven todos a role="combobox" en jsdom. Se
 * desambiguan por tagName ('SELECT' vs 'DIV') cuando hace falta acceder a
 * los selects globales, y por scoping con `within(card)` para el combobox
 * de cada pedido (no hay selects nativos dentro de las Cards).
 */

import React from 'react';
import { render, screen, within, waitFor } from '@testing-library/react';
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

jest.mock('@/services/evaService', () => ({
  getEvaCredentials: jest.fn(),
  getEvaDistricts: jest.fn(),
  createEvaOrdersBulk: jest.fn(),
}));

/**
 * Mock del Combobox de distrito — idéntico en espíritu al de
 * SendToEvaModal.test.tsx: trigger con role="combobox" (texto = opción
 * seleccionada o placeholder) + input de búsqueda + opciones como botones,
 * filtrado 100% en cliente. Cada Card de la guía monta su propia instancia
 * (estado independiente), así que no hace falta desambiguar entre pedidos —
 * alcanza con escopar la búsqueda con `within(card)`.
 */
jest.mock('@/components/ui/combobox', () => {
  const React = require('react');

  interface MockComboboxOption {
    value: string;
    label: string;
  }

  const Combobox = ({
    value,
    onValueChange,
    options,
    placeholder,
    searchPlaceholder,
    emptyMessage,
    className,
  }: {
    value?: string;
    onValueChange?: (value: string) => void;
    options?: MockComboboxOption[];
    placeholder?: string;
    searchPlaceholder?: string;
    emptyMessage?: string;
    className?: string;
  }) => {
    const [query, setQuery] = React.useState('');
    const opts: MockComboboxOption[] = options ?? [];
    const filtered = opts.filter((opt) =>
      opt.label.toLowerCase().includes(query.toLowerCase()),
    );
    const selected = opts.find((opt) => opt.value === value);

    return (
      <div className={className}>
        <div role="combobox" aria-expanded="true">
          {selected ? selected.label : placeholder}
        </div>
        <input
          placeholder={searchPlaceholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <ul>
          {filtered.length === 0 && <li>{emptyMessage}</li>}
          {filtered.map((opt) => (
            <li key={opt.value}>
              <button type="button" onClick={() => onValueChange?.(opt.value)}>
                {opt.label}
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  };

  return { Combobox };
});

/**
 * Mock de Radix Select → <select> nativo. Idéntico al usado en
 * SendToEvaModal.test.tsx.
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
    React.Children.forEach(children, (child: React.ReactElement<{ children?: React.ReactNode }>) => {
      if (!child || !child.props) return;
      if (child.props.children) {
        React.Children.forEach(child.props.children, (item: React.ReactElement<{ value?: string; children?: React.ReactNode }>) => {
          if (item && item.props && item.props.value !== undefined) {
            options.push({ value: item.props.value, label: extractText(item.props.children) });
          }
        });
      }
    });
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
  const SelectItem = ({ value, children }: { value: string; children?: React.ReactNode }) => (
    <option value={value}>{children}</option>
  );
  const SelectTrigger = ({ children }: { children?: React.ReactNode }) => <>{children}</>;
  const SelectValue = ({ placeholder }: { placeholder?: string }) => <span>{placeholder}</span>;

  return { Select, SelectContent, SelectItem, SelectTrigger, SelectValue };
});

jest.mock('@/components/ui/dialog', () => {
  const React = require('react');
  const Dialog = ({ open, children }: { open?: boolean; children?: React.ReactNode }) =>
    open ? <div data-testid="dialog">{children}</div> : null;
  const DialogContent = ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="dialog-content">{children}</div>
  );
  const DialogHeader = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  const DialogTitle = ({ children }: { children?: React.ReactNode }) => <h2>{children}</h2>;
  return { Dialog, DialogContent, DialogHeader, DialogTitle };
});

jest.mock('@/components/ui/checkbox', () => {
  const React = require('react');
  const Checkbox = ({
    checked,
    onCheckedChange,
  }: {
    checked?: boolean;
    onCheckedChange?: (checked: boolean) => void;
  }) => (
    <input
      type="checkbox"
      checked={checked === true}
      onChange={(e) => onCheckedChange?.(e.target.checked)}
    />
  );
  return { Checkbox };
});

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
    <button onClick={onClick} disabled={disabled} className={className} data-variant={variant} data-size={size}>
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
    <label className={className} htmlFor={htmlFor}>{children}</label>
  );
  return { Label };
});

jest.mock('lucide-react', () => {
  const React = require('react');
  return {
    Loader2: ({ className }: { className?: string }) => <span data-testid="loader" className={className} />,
    CheckCircle2: () => null,
    XCircle: () => null,
    Package: () => null,
    AlertCircle: ({
      className,
      'aria-label': ariaLabel,
    }: {
      className?: string;
      'aria-label'?: string;
    }) =>
      ariaLabel ? (
        <span role="img" aria-label={ariaLabel} className={className} />
      ) : (
        <span className={className} />
      ),
  };
});

// ── Imports bajo prueba (después de los mocks) ────────────────────────────────

import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { getEvaCredentials, getEvaDistricts, createEvaOrdersBulk } from '@/services/evaService';
import type { EvaCredentialSafe, EvaSendOrdersBulkItemResult } from '@/services/evaService';
import SendToEvaGuideModal, { type EvaGuideOrderItem } from '../SendToEvaGuideModal';

// ── Casts ────────────────────────────────────────────────────────────────────

const mockUseAuth = jest.mocked(useAuth);
const mockGetCredentials = jest.mocked(getEvaCredentials);
const mockGetDistricts = jest.mocked(getEvaDistricts);
const mockCreateOrdersBulk = jest.mocked(createEvaOrdersBulk);
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

const MOCK_CREDENTIAL_ALMACEN: EvaCredentialSafe = {
  id: 'cred-1',
  companyId: 'company-1',
  baseUrl: null,
  clientType: 'ALMACEN',
  maskedApiKey: '****abcd',
  hasWebhookSecret: true,
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const MOCK_CREDENTIAL_RECOJO: EvaCredentialSafe = {
  ...MOCK_CREDENTIAL_ALMACEN,
  clientType: 'RECOJO',
};

const MOCK_CREDENTIAL_INACTIVE: EvaCredentialSafe = {
  ...MOCK_CREDENTIAL_ALMACEN,
  isActive: false,
};

/** Maestro de distritos EVA usado por defecto en todos los tests. */
const DEFAULT_DISTRICTS = ['MIRAFLORES', 'SAN ISIDRO', 'SURCO'];

/** Pedido válido — distrito en minúscula y con espacios internos de más (match tolerante). */
const ORDER_1: EvaGuideOrderItem = {
  id: 'order-1',
  orderNumber: 'ORD-001',
  customer: {
    fullName: 'Ana López',
    phoneNumber: '987654321',
    district: 'san   isidro',
    address: 'Av. Test 123',
  },
  grandTotal: 50,
  items: [
    { productName: 'Producto A', sku: 'SKU-001', quantity: 2 },
    { productName: 'Producto B', sku: 'SKU-002', quantity: 1 },
  ],
};

/** Pedido válido — distrito ya en formato canónico exacto (match directo). */
const ORDER_2: EvaGuideOrderItem = {
  id: 'order-2',
  orderNumber: 'ORD-002',
  customer: {
    fullName: 'Luis Pérez',
    phoneNumber: '912345678',
    district: 'SURCO',
    address: 'Jr. Otro 456',
  },
  totals: { grandTotal: 80 },
  items: [{ productName: 'Producto C', sku: 'SKU-003', quantity: 3 }],
};

/** Pedido inválido — distrito que NO matchea contra el maestro. */
const ORDER_3_INVALID_DISTRICT: EvaGuideOrderItem = {
  id: 'order-3',
  orderNumber: 'ORD-003',
  customer: {
    fullName: 'Carla Ruiz',
    phoneNumber: '955555555',
    district: 'Chorrillos',
    address: 'Calle X 789',
  },
  grandTotal: 30,
  items: [{ productName: 'Producto D', sku: 'SKU-004', quantity: 1 }],
};

/**
 * Pedido con detalle completo (DNI, ítems con unitPrice, pago parcial) —
 * usado para verificar la sección de solo lectura que motivó el rediseño
 * Table → Card. Queda un saldo pendiente de S/ 70.00 (120 - 50 pagado).
 */
const ORDER_4_FULL_DETAIL: EvaGuideOrderItem = {
  id: 'order-4',
  orderNumber: 'ORD-004',
  customer: {
    fullName: 'Marta Gómez',
    phoneNumber: '999888777',
    district: 'SURCO',
    address: 'Av. Prueba 321',
    dni: '45678912',
  },
  totals: { grandTotal: 120 },
  payments: [{ id: 'pay-1', amount: 50, status: 'PAID' }],
  items: [
    { productName: 'Producto E', sku: 'SKU-005', quantity: 2, unitPrice: 30 },
    { productName: 'Producto F', sku: 'SKU-006', quantity: 1, unitPrice: 40 },
  ],
};

/** Pedido pagado completo (payments cubre el total) — sin saldo pendiente. */
const ORDER_5_FULLY_PAID: EvaGuideOrderItem = {
  id: 'order-5',
  orderNumber: 'ORD-005',
  customer: {
    fullName: 'Pedro Ramos',
    phoneNumber: '911222333',
    district: 'MIRAFLORES',
    address: 'Calle Pagada 111',
    dni: '11223344',
  },
  totals: { grandTotal: 90 },
  payments: [{ id: 'pay-2', amount: 90, status: 'PAID' }],
  items: [{ productName: 'Producto G', sku: 'SKU-007', quantity: 2, unitPrice: 45 }],
};

const BASE_PROPS = {
  open: true,
  guideId: 'guide-abc',
  companyId: 'company-1',
  orders: [ORDER_1, ORDER_2],
  onClose: jest.fn(),
  onSuccess: jest.fn(),
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function renderModal(propOverrides: Partial<typeof BASE_PROPS> = {}) {
  return render(<SendToEvaGuideModal {...BASE_PROPS} {...propOverrides} />);
}

/** Espera a que las Cards/config estén listas (credencial + distritos resueltos). */
async function waitForTableReady() {
  return screen.findByRole('button', { name: /enviar guía a eva/i });
}

/** Escopa la Card de un pedido por su `id` vía el data-testid agregado en el componente. */
function getCardByOrderId(orderId: string): HTMLElement {
  return screen.getByTestId(`eva-order-card-${orderId}`);
}

function getCardCheckbox(card: HTMLElement): HTMLElement {
  return within(card).getByRole('checkbox');
}

function getCardDistrictCombobox(card: HTMLElement): HTMLElement {
  return within(card).getByRole('combobox');
}

/** Los selects globales (Tipo de servicio / Método de cobro) son <select> nativos; los combobox de distrito por pedido son <div role="combobox">. */
function getGlobalSelects(): HTMLElement[] {
  return screen.getAllByRole('combobox').filter((el) => el.tagName === 'SELECT');
}

function makeBulkResult(
  orderId: string,
  outcome: EvaSendOrdersBulkItemResult['outcome'],
  extra: { trackingId?: string; reason?: string } = {},
): EvaSendOrdersBulkItemResult {
  return { orderId, shipmentId: null, outcome, ...extra };
}

// ── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  mockUseAuth.mockReturnValue(MOCK_AUTH as unknown as ReturnType<typeof useAuth>);
  mockGetCredentials.mockResolvedValue(MOCK_CREDENTIAL_ALMACEN);
  mockGetDistricts.mockResolvedValue(DEFAULT_DISTRICTS);
  mockCreateOrdersBulk.mockResolvedValue([]);
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe('SendToEvaGuideModal', () => {
  // ── 1. Autocompletado por pedido — clientType ALMACEN ───────────────────

  describe('autocompletado por pedido (clientType=ALMACEN)', () => {
    it('genera el SKU en formato CODIGO(cant),CODIGO(cant) a partir de order.items para cada pedido', async () => {
      renderModal();
      await waitForTableReady();

      const card1 = getCardByOrderId('order-1');
      const card2 = getCardByOrderId('order-2');

      // Orden de role="textbox" en la Card: nombre(0), teléfono(1), buscador
      // interno del Combobox de distrito mockeado(2), dirección(3), sku(4).
      expect(within(card1).getAllByRole('textbox')[4]).toHaveValue('SKU-001(2),SKU-002(1)');
      expect(within(card2).getAllByRole('textbox')[4]).toHaveValue('SKU-003(3)');
    });

    it('autoselecciona el distrito canónico con match tolerante a minúsculas y espacios extra', async () => {
      renderModal();
      await waitForTableReady();

      const card1 = getCardByOrderId('order-1');
      expect(getCardDistrictCombobox(card1)).toHaveTextContent('SAN ISIDRO');
    });

    it('autoselecciona el distrito cuando ya viene en formato canónico exacto', async () => {
      renderModal();
      await waitForTableReady();

      const card2 = getCardByOrderId('order-2');
      expect(getCardDistrictCombobox(card2)).toHaveTextContent('SURCO');
    });
  });

  // ── 2. Autocompletado por pedido — clientType RECOJO ─────────────────────

  describe('autocompletado por pedido (clientType=RECOJO)', () => {
    beforeEach(() => {
      mockGetCredentials.mockResolvedValue(MOCK_CREDENTIAL_RECOJO);
    });

    it('arma "product" con los nombres de los items separados por coma', async () => {
      renderModal();
      await waitForTableReady();

      const card1 = getCardByOrderId('order-1');
      const card2 = getCardByOrderId('order-2');

      // Orden de role="textbox" en la Card: nombre(0), teléfono(1), buscador
      // interno del Combobox de distrito mockeado(2), dirección(3), producto(4).
      expect(within(card1).getAllByRole('textbox')[4]).toHaveValue('Producto A, Producto B');
      expect(within(card2).getAllByRole('textbox')[4]).toHaveValue('Producto C');
    });

    it('"packages" default es la cantidad de items del pedido (mínimo 1)', async () => {
      renderModal();
      await waitForTableReady();

      const card1 = getCardByOrderId('order-1'); // 2 items
      const card2 = getCardByOrderId('order-2'); // 1 item

      expect(within(card1).getAllByRole('spinbutton')[1]).toHaveValue(2);
      expect(within(card2).getAllByRole('spinbutton')[1]).toHaveValue(1);
    });
  });

  // ── 3. Edición de pedido ───────────────────────────────────────────────────

  describe('edición de pedido', () => {
    it('actualiza la dirección de un pedido sin afectar los demás', async () => {
      renderModal();
      await waitForTableReady();

      const card1 = getCardByOrderId('order-1');
      const card2 = getCardByOrderId('order-2');

      // Orden de role="textbox" en la Card: nombre(0), teléfono(1), buscador
      // interno del Combobox de distrito mockeado(2), dirección(3).
      const addressInput1 = within(card1).getAllByRole('textbox')[3];
      const user = userEvent.setup();
      await user.clear(addressInput1);
      await user.type(addressInput1, 'Nueva Dirección 999');

      expect(addressInput1).toHaveValue('Nueva Dirección 999');
      expect(within(card2).getAllByRole('textbox')[3]).toHaveValue('Jr. Otro 456');
    });

    it('actualiza el teléfono de un pedido sin afectar los demás', async () => {
      renderModal();
      await waitForTableReady();

      const card1 = getCardByOrderId('order-1');
      const card2 = getCardByOrderId('order-2');

      const phoneInput1 = within(card1).getAllByRole('textbox')[1];
      const user = userEvent.setup();
      await user.clear(phoneInput1);
      await user.type(phoneInput1, '900111222');

      expect(phoneInput1).toHaveValue('900111222');
      expect(within(card2).getAllByRole('textbox')[1]).toHaveValue('912345678');
    });
  });

  // ── 4. Exclusión de pedido ─────────────────────────────────────────────────

  describe('exclusión de pedido', () => {
    it('destildar el checkbox de un pedido baja en 1 el contador "Pedidos a enviar"', async () => {
      renderModal();
      await waitForTableReady();

      expect(screen.getByText('2 de 2')).toBeInTheDocument();

      const card1 = getCardByOrderId('order-1');
      const user = userEvent.setup();
      await user.click(getCardCheckbox(card1));

      expect(screen.getByText('1 de 2')).toBeInTheDocument();
    });

    it('el pedido destildado NO aparece en el payload enviado a createEvaOrdersBulk', async () => {
      mockCreateOrdersBulk.mockResolvedValue([makeBulkResult('order-2', 'created', { trackingId: 'TRK-2' })]);
      renderModal();
      await waitForTableReady();

      const card1 = getCardByOrderId('order-1');
      const user = userEvent.setup();
      await user.click(getCardCheckbox(card1));

      const btn = screen.getByRole('button', { name: /enviar guía a eva/i });
      await user.click(btn);

      await waitFor(() => expect(mockCreateOrdersBulk).toHaveBeenCalledTimes(1));
      const [, payloads] = mockCreateOrdersBulk.mock.calls[0];
      expect(payloads).toHaveLength(1);
      expect(payloads[0]).toEqual(expect.objectContaining({ orderId: 'order-2' }));
      expect(payloads.some((p) => p.orderId === 'order-1')).toBe(false);
    });
  });

  // ── 5. Pedido inválido no cuenta como enviable ────────────────────────────

  describe('pedido inválido (distrito sin match) no cuenta como enviable', () => {
    it('no cuenta como válido en el resumen aunque esté tildado', async () => {
      renderModal({ orders: [ORDER_1, ORDER_3_INVALID_DISTRICT] });
      await waitForTableReady();

      expect(screen.getByText('1 de 2')).toBeInTheDocument();

      const card3 = getCardByOrderId('order-3');
      expect(getCardCheckbox(card3)).toBeChecked();
    });

    it('muestra un indicador visual de alerta en el pedido inválido', async () => {
      renderModal({ orders: [ORDER_1, ORDER_3_INVALID_DISTRICT] });
      await waitForTableReady();

      const card3 = getCardByOrderId('order-3');
      expect(
        within(card3).getByRole('img', { name: /fila con datos incompletos o inválidos/i }),
      ).toBeInTheDocument();
      expect(screen.getByText(/no coincide con cobertura eva/i)).toBeInTheDocument();
    });

    it('NO se incluye en el payload al enviar', async () => {
      mockCreateOrdersBulk.mockResolvedValue([makeBulkResult('order-1', 'created', { trackingId: 'TRK-1' })]);
      renderModal({ orders: [ORDER_1, ORDER_3_INVALID_DISTRICT] });
      await waitForTableReady();

      const btn = screen.getByRole('button', { name: /enviar guía a eva/i });
      const user = userEvent.setup();
      await user.click(btn);

      await waitFor(() => expect(mockCreateOrdersBulk).toHaveBeenCalledTimes(1));
      const [, payloads] = mockCreateOrdersBulk.mock.calls[0];
      expect(payloads).toHaveLength(1);
      expect(payloads[0]).toEqual(expect.objectContaining({ orderId: 'order-1' }));
    });
  });

  // ── 6. El envío arma el payload correcto ──────────────────────────────────

  describe('el envío arma el payload correcto', () => {
    it('llama a createEvaOrdersBulk UNA sola vez con un ítem por cada pedido válido y tildado', async () => {
      mockCreateOrdersBulk.mockResolvedValue([
        makeBulkResult('order-1', 'created', { trackingId: 'TRK-1' }),
        makeBulkResult('order-2', 'created', { trackingId: 'TRK-2' }),
      ]);
      renderModal();
      await waitForTableReady();

      const btn = screen.getByRole('button', { name: /enviar guía a eva/i });
      const user = userEvent.setup();
      await user.click(btn);

      await waitFor(() => expect(mockCreateOrdersBulk).toHaveBeenCalledTimes(1));
      const [, payloads] = mockCreateOrdersBulk.mock.calls[0];
      expect(payloads).toHaveLength(2);
    });

    it('cada ítem incluye companyId, orderId, teléfono normalizado y paymentMethod/serviceType de los selects globales', async () => {
      mockCreateOrdersBulk.mockResolvedValue([
        makeBulkResult('order-1', 'created', { trackingId: 'TRK-1' }),
        makeBulkResult('order-2', 'created', { trackingId: 'TRK-2' }),
      ]);
      renderModal();
      await waitForTableReady();

      const [serviceTypeSelect, paymentMethodSelect] = getGlobalSelects();
      const user = userEvent.setup();
      await user.selectOptions(serviceTypeSelect, '2');
      await user.selectOptions(paymentMethodSelect, 'POS');

      const btn = screen.getByRole('button', { name: /enviar guía a eva/i });
      await user.click(btn);

      await waitFor(() => expect(mockCreateOrdersBulk).toHaveBeenCalledTimes(1));
      expect(mockCreateOrdersBulk).toHaveBeenCalledWith(
        'fake-token',
        expect.arrayContaining([
          expect.objectContaining({
            companyId: 'company-1',
            orderId: 'order-1',
            recipientPhone: '+51987654321',
            paymentMethod: 'POS',
            serviceType: 2,
          }),
          expect.objectContaining({
            companyId: 'company-1',
            orderId: 'order-2',
            recipientPhone: '+51912345678',
            paymentMethod: 'POS',
            serviceType: 2,
          }),
        ]),
      );
    });
  });

  // ── 7. Resultado mixto reflejado por pedido ───────────────────────────────

  describe('resultado mixto', () => {
    beforeEach(() => {
      mockCreateOrdersBulk.mockResolvedValue([
        makeBulkResult('order-1', 'created', { trackingId: 'EVA-TRK-1' }),
        makeBulkResult('order-2', 'failed_client', { reason: 'Distrito no cubierto' }),
      ]);
    });

    it('muestra los pedidos creados con su trackingId', async () => {
      renderModal();
      await waitForTableReady();

      const btn = screen.getByRole('button', { name: /enviar guía a eva/i });
      const user = userEvent.setup();
      await user.click(btn);

      expect(await screen.findByText(/pedidos creados en eva/i)).toBeInTheDocument();
      expect(screen.getByText('EVA-TRK-1')).toBeInTheDocument();
    });

    it('muestra los pedidos no enviados con su reason', async () => {
      renderModal();
      await waitForTableReady();

      const btn = screen.getByRole('button', { name: /enviar guía a eva/i });
      const user = userEvent.setup();
      await user.click(btn);

      expect(await screen.findByText(/pedido\(s\) no se enviaron/i)).toBeInTheDocument();
      expect(screen.getByText(/distrito no cubierto/i)).toBeInTheDocument();
    });

    it('llama a toast.warning (no success ni error) cuando el resultado es mixto', async () => {
      renderModal();
      await waitForTableReady();

      const btn = screen.getByRole('button', { name: /enviar guía a eva/i });
      const user = userEvent.setup();
      await user.click(btn);

      expect(await screen.findByText(/pedidos creados en eva/i)).toBeInTheDocument();
      expect(mockToast.warning).toHaveBeenCalled();
      expect(mockToast.success).not.toHaveBeenCalled();
      expect(mockToast.error).not.toHaveBeenCalled();
    });
  });

  // ── 7.5. Falla de red en el envío completo (createEvaOrdersBulk rechaza) ───

  describe('falla de red en el envío completo', () => {
    it('llama a toast.error, no pasa a la pantalla de resultado y reactiva el botón de envío', async () => {
      mockCreateOrdersBulk.mockRejectedValueOnce(new Error('Network Error'));
      renderModal();
      await waitForTableReady();

      const btn = screen.getByRole('button', { name: /enviar guía a eva/i });
      const user = userEvent.setup();
      await user.click(btn);

      await waitFor(() => expect(mockToast.error).toHaveBeenCalled());
      expect(mockToast.success).not.toHaveBeenCalled();
      expect(mockToast.warning).not.toHaveBeenCalled();

      // Se queda en la pantalla de configuración (no pasa a isSuccess): el
      // botón de envío sigue presente y habilitado, y ninguna Card se desmontó.
      expect(screen.queryByText(/¡pedidos enviados!/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/¡proceso completado!/i)).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /enviar guía a eva/i })).toBeInTheDocument();
      expect(getCardByOrderId('order-1')).toBeInTheDocument();

      // El botón vuelve a estar habilitado, sin quedar trabado en "Enviando guía...".
      const btnAfter = screen.getByRole('button', { name: /enviar guía a eva/i });
      expect(btnAfter).not.toBeDisabled();
      expect(screen.queryByText(/enviando guía\.\.\./i)).not.toBeInTheDocument();
    });
  });

  // ── 8. Sin credencial activa ───────────────────────────────────────────────

  describe('sin credencial activa', () => {
    it('muestra el mensaje de error cuando no existe credencial (null)', async () => {
      mockGetCredentials.mockResolvedValue(null);
      renderModal({ orders: [ORDER_1] });

      expect(
        await screen.findByText(/la integración con eva no está configurada o activa/i),
      ).toBeInTheDocument();
    });

    it('muestra el mensaje de error cuando la credencial existe pero está inactiva', async () => {
      mockGetCredentials.mockResolvedValue(MOCK_CREDENTIAL_INACTIVE);
      renderModal({ orders: [ORDER_1] });

      expect(
        await screen.findByText(/la integración con eva no está configurada o activa/i),
      ).toBeInTheDocument();
    });

    it('NO renderiza ninguna Card de pedido ni el botón de envío sin credencial activa', async () => {
      mockGetCredentials.mockResolvedValue(null);
      renderModal({ orders: [ORDER_1] });

      await screen.findByText(/la integración con eva no está configurada o activa/i);
      expect(screen.queryByTestId(/eva-order-card-/)).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /enviar guía a eva/i })).not.toBeInTheDocument();
    });
  });

  // ── 9. Detalle de solo lectura del pedido (motivo del rediseño Card) ──────

  describe('detalle de solo lectura del pedido', () => {
    it('muestra el DNI y el teléfono del cliente en la sección de solo lectura', async () => {
      renderModal({ orders: [ORDER_4_FULL_DETAIL] });
      await waitForTableReady();

      const card = getCardByOrderId('order-4');
      expect(within(card).getByText('45678912')).toBeInTheDocument();
      expect(within(card).getByText('999888777')).toBeInTheDocument();
    });

    it('itemiza los productos del pedido con nombre, SKU, cantidad y precio unitario', async () => {
      renderModal({ orders: [ORDER_4_FULL_DETAIL] });
      await waitForTableReady();

      const card = getCardByOrderId('order-4');
      expect(within(card).getByText('Producto E')).toBeInTheDocument();
      expect(within(card).getByText('SKU-005')).toBeInTheDocument();
      expect(within(card).getByText('×2')).toBeInTheDocument();
      expect(within(card).getByText('S/ 30.00')).toBeInTheDocument();

      expect(within(card).getByText('Producto F')).toBeInTheDocument();
      expect(within(card).getByText('SKU-006')).toBeInTheDocument();
      expect(within(card).getByText('×1')).toBeInTheDocument();
      expect(within(card).getByText('S/ 40.00')).toBeInTheDocument();
    });

    it('muestra el monto total del pedido y el badge "Pendiente S/ X" cuando queda saldo sin cobrar', async () => {
      renderModal({ orders: [ORDER_4_FULL_DETAIL] });
      await waitForTableReady();

      const card = getCardByOrderId('order-4');
      expect(within(card).getByText('S/ 120.00')).toBeInTheDocument();
      expect(within(card).getByText(/pendiente s\/ 70\.00/i)).toBeInTheDocument();
    });

    it('NO muestra el badge "Pendiente" cuando el pedido está pagado completo', async () => {
      renderModal({ orders: [ORDER_5_FULLY_PAID] });
      await waitForTableReady();

      const card = getCardByOrderId('order-5');
      expect(within(card).getByText('S/ 90.00')).toBeInTheDocument();
      expect(within(card).queryByText(/pendiente/i)).not.toBeInTheDocument();
    });
  });
});
