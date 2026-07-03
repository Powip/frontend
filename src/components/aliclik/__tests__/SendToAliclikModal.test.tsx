/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Tests: SendToAliclikModal
 *
 * Comportamiento verificado:
 * 1. Al abrir con orderId llama a quoteAliclikOrder y muestra almacenes/couriers
 *    (loading -> contenido).
 * 2. Almacén con couriers: [] muestra "Sin cobertura" y un aviso de sin cobertura;
 *    el botón de crear pedido sigue habilitado (ese almacén se excluye del payload).
 * 3. unresolvedItems no vacío muestra el banner de advertencia con los SKUs.
 * 4. El botón "Crear pedido en Aliclik" está deshabilitado hasta que todos los
 *    almacenes CON cobertura tienen courier seleccionado; al tener courier
 *    pre-seleccionado queda habilitado inmediatamente.
 * 5. Al crear: arma shipments[] con warehouseId, delivery y courier; llama a
 *    createAliclikOrder con {companyId, orderId, shipments}; tras éxito muestra
 *    externalOrderNumber y dispara onSuccess.
 * 6. Editar el delivery de un almacén se refleja en el payload enviado.
 * 7. Error de cotización (quoteAliclikOrder rechaza) muestra estado de error y
 *    llama a toast.error; no crashea.
 * 8. Error al crear (createAliclikOrder rechaza) llama a toast.error, no llama
 *    a onSuccess.
 *
 * Work-arounds jsdom aplicados:
 * - @/components/ui/select → mock de <select> nativo para evitar problemas de
 *   ResizeObserver / pointer-events de Radix UI en jsdom.
 * - @/components/ui/dialog → mock que renderiza children directamente cuando
 *   open=true.
 * - @/components/ui/card, input, label, button, textarea → mocks mínimos.
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

jest.mock('@/services/clients.service', () => ({
  updateClient: jest.fn(),
}));

/**
 * Mock de Radix Select → <select> nativo.
 * Permite testear valor inicial y cambios con userEvent.selectOptions.
 */
jest.mock('@/components/ui/select', () => {
  const React = require('react');

  /**
   * Extrae texto legible de un nodo React de forma recursiva.
   * Necesario porque SelectItem puede tener children con divs/spans anidados
   * (p.ej. el nombre del courier dentro de un <div><span>...</span></div>).
   */
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

// Mocks mínimos de componentes UI
jest.mock('@/components/ui/card', () => {
  const React = require('react');
  const Card = ({ children, className }: { children?: React.ReactNode; className?: string }) => (
    <div data-testid="card" className={className}>{children}</div>
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

jest.mock('@/components/ui/textarea', () => {
  const React = require('react');
  const Textarea = (props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => (
    <textarea {...props} />
  );
  return { Textarea };
});

// Mock mínimo de lucide-react
jest.mock('lucide-react', () => ({
  Loader2: ({ className }: { className?: string }) => (
    <span data-testid="loader" className={className} />
  ),
  CheckCircle2: () => null,
  AlertCircle: () => null,
  Package: () => null,
  Truck: () => null,
}));

// Mock de @/lib/utils para cn
jest.mock('@/lib/utils', () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
}));

// ── Imports bajo prueba (después de los mocks) ───────────────────────────────

import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { quoteAliclikOrder, createAliclikOrder } from '@/services/aliclikService';
import { updateClient } from '@/services/clients.service';
import SendToAliclikModal from '../SendToAliclikModal';

// ── Casts ────────────────────────────────────────────────────────────────────

const mockUseAuth = jest.mocked(useAuth);
const mockQuote = jest.mocked(quoteAliclikOrder);
const mockCreate = jest.mocked(createAliclikOrder);
const mockUpdateClient = jest.mocked(updateClient);
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

const MOCK_COURIER_EXPRESS = {
  id: 11,
  transportId: 101,
  transportName: 'Express Turbo',
  transportUrlImage: '',
  addDays: 1,
  deliveryCost: 25.0,
  returnCost: 10.0,
  flagDeliveryExpress: true,
  schedule: null,
  scheduleExpressStart: null,
  scheduleExpressEnd: null,
};

const MOCK_QUOTE_SINGLE_WAREHOUSE = {
  orderId: 'order-abc',
  orderNumber: 'ORD-001',
  companyId: 'company-1',
  shippingTotalSugerido: 15.5,
  customer: {
    lat: -12.0,
    lng: -77.0,
    fullName: 'María García',
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

/**
 * MOCK_QUOTE_NO_COVERAGE: tiene DOS almacenes.
 * - Almacén 2 (Lima Norte): sin cobertura (couriers: []) — se excluye del payload
 * - Almacén 1 (Principal): con cobertura y courier preseleccionable
 * Esto permite verificar que el almacén sin cobertura NO bloquea el botón
 * cuando hay al menos otro almacén CON cobertura y courier elegido (canSubmit=true).
 */
const MOCK_QUOTE_NO_COVERAGE = {
  ...MOCK_QUOTE_SINGLE_WAREHOUSE,
  warehouses: [
    {
      warehouseId: 2,
      warehouseName: 'Almacén Lima Norte',
      ubigeo: null,
      items: [
        { sku: 'SKU-002', ean: '', quantity: 1, unitPrice: 30.0, productName: 'Producto B' },
      ],
      couriers: [],
    },
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
};

const MOCK_QUOTE_WITH_UNRESOLVED = {
  ...MOCK_QUOTE_SINGLE_WAREHOUSE,
  unresolvedItems: [
    { sku: 'SKU-X', productName: 'Producto Sin Enlace' },
    { sku: 'SKU-Y', productName: 'Otro Sin Enlace' },
  ],
};

const MOCK_CREATE_RESULT = {
  shipments: [{ warehouseId: 1, externalOrderNumber: 'ALI-12345' }],
};

/**
 * MOCK_QUOTE_NO_COORDS: quote cuyo cliente NO tiene coordenadas válidas.
 * Representa el escenario en que lat y lng son 0 (sentinel de "sin coords").
 */
const MOCK_QUOTE_NO_COORDS = {
  ...MOCK_QUOTE_SINGLE_WAREHOUSE,
  customer: {
    ...MOCK_QUOTE_SINGLE_WAREHOUSE.customer,
    lat: 0,
    lng: 0,
  },
};

const BASE_PROPS = {
  open: true,
  onClose: jest.fn(),
  orderId: 'order-abc',
  companyId: 'company-1',
  onSuccess: jest.fn(),
};

// ── Helper ───────────────────────────────────────────────────────────────────

function renderModal(propOverrides: Partial<typeof BASE_PROPS> & { clientId?: string } = {}) {
  return render(<SendToAliclikModal {...BASE_PROPS} {...propOverrides} />);
}

// ── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  mockUseAuth.mockReturnValue(MOCK_AUTH as unknown as ReturnType<typeof useAuth>);
  mockQuote.mockResolvedValue(MOCK_QUOTE_SINGLE_WAREHOUSE);
  mockCreate.mockResolvedValue(MOCK_CREATE_RESULT);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mockUpdateClient.mockResolvedValue({} as any);
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe('SendToAliclikModal', () => {

  // ── 1. Cotización y render de contenido ──────────────────────────────────

  describe('cotización y render de contenido', () => {
    it('muestra spinner de carga mientras cotiza', () => {
      // quoteAliclikOrder nunca resuelve durante este test
      mockQuote.mockReturnValue(new Promise(() => {}));
      renderModal();
      expect(screen.getByTestId('loader')).toBeInTheDocument();
      expect(screen.getByText(/cotizando pedido en aliclik/i)).toBeInTheDocument();
    });

    it('llama a quoteAliclikOrder con token, companyId y orderId al abrir', async () => {
      renderModal();
      await waitFor(() => {
        expect(mockQuote).toHaveBeenCalledWith('fake-token', 'company-1', 'order-abc');
      });
    });

    it('muestra el nombre del cliente tras cotizar', async () => {
      renderModal();
      expect(await screen.findByText('María García')).toBeInTheDocument();
    });

    it('muestra el nombre del almacén tras cotizar', async () => {
      renderModal();
      expect(await screen.findByText('Almacén Principal')).toBeInTheDocument();
    });

    it('muestra el nombre del courier disponible', async () => {
      renderModal();
      // El courier preseleccionado aparece como <option> dentro del <select> mockeado.
      // Usamos selector 'option' para evitar match ambiguo con el <select> padre
      // (cuyo textContent también contiene el nombre del courier).
      await screen.findByText('Almacén Principal'); // esperar fin del loading
      expect(screen.getByText(/courier express/i, { selector: 'option' })).toBeInTheDocument();
    });

    it('muestra el costo de envío sugerido', async () => {
      renderModal();
      expect(await screen.findByText('S/ 15.50')).toBeInTheDocument();
    });

    it('desaparece el spinner al completar la cotización', async () => {
      renderModal();
      await screen.findByText('María García');
      expect(screen.queryByText(/cotizando pedido en aliclik/i)).not.toBeInTheDocument();
    });

    it('no llama a quoteAliclikOrder cuando open=false', () => {
      renderModal({ open: false });
      expect(mockQuote).not.toHaveBeenCalled();
    });
  });

  // ── 2. Almacén sin cobertura ──────────────────────────────────────────────

  describe('almacén sin cobertura', () => {
    beforeEach(() => {
      mockQuote.mockResolvedValue(MOCK_QUOTE_NO_COVERAGE);
    });

    it('muestra el badge "Sin cobertura" para almacén sin couriers', async () => {
      renderModal();
      // El badge es un <span> con texto exacto "Sin cobertura".
      // Usamos selector 'span' para evitar matches en elementos padre
      // cuyo textContent también contiene ese texto.
      await screen.findByText('Almacén Lima Norte'); // esperar fin del loading
      expect(screen.getByText('Sin cobertura', { selector: 'span' })).toBeInTheDocument();
    });

    it('muestra el mensaje explicativo de sin cobertura', async () => {
      renderModal();
      expect(
        await screen.findByText(/no hay couriers disponibles para este almacén/i),
      ).toBeInTheDocument();
    });

    it('el botón "Crear pedido en Aliclik" queda habilitado aunque haya almacén sin cobertura', async () => {
      // El almacén sin cobertura se excluye del payload pero no bloquea el submit.
      // El Almacén Principal (con cobertura y courier preseleccionado) satisface
      // hasAtLeastOneShipment → canSubmit=true.
      renderModal();
      const btn = await screen.findByRole('button', { name: /crear pedido en aliclik/i });
      await waitFor(() => {
        expect(btn).not.toBeDisabled();
      });
    });

    it('no muestra el selector de courier para almacén sin cobertura', async () => {
      renderModal();
      // Esperar que la cotización cargue y el badge aparezca
      await screen.findByText('Almacén Lima Norte');
      expect(screen.getByText('Sin cobertura', { selector: 'span' })).toBeInTheDocument();
      // Con el mock de dos almacenes: Almacén Principal (con cobertura) SÍ tiene
      // courier select; Almacén Lima Norte (sin cobertura) NO debe tenerlo.
      // Hay exactamente 1 courier select (el del almacén con cobertura), no 2.
      const selects = screen.queryAllByRole('combobox') as HTMLSelectElement[];
      const courierSelects = selects.filter((s) =>
        Array.from(s.options).some((o) => o.value === '10'),
      );
      expect(courierSelects).toHaveLength(1);
    });
  });

  // ── 3. Banner de ítems no enlazados ──────────────────────────────────────

  describe('banner de unresolvedItems', () => {
    it('muestra el banner cuando hay ítems no enlazados', async () => {
      mockQuote.mockResolvedValue(MOCK_QUOTE_WITH_UNRESOLVED);
      renderModal();
      expect(
        await screen.findByText(/productos no enlazados al catálogo aliclik/i),
      ).toBeInTheDocument();
    });

    it('muestra los SKUs de los ítems no enlazados', async () => {
      mockQuote.mockResolvedValue(MOCK_QUOTE_WITH_UNRESOLVED);
      renderModal();
      expect(await screen.findByText('SKU-X')).toBeInTheDocument();
      expect(await screen.findByText('SKU-Y')).toBeInTheDocument();
    });

    it('NO muestra el banner cuando unresolvedItems está vacío', async () => {
      renderModal();
      await screen.findByText('María García');
      expect(
        screen.queryByText(/productos no enlazados al catálogo aliclik/i),
      ).not.toBeInTheDocument();
    });
  });

  // ── 4. Habilitación del botón "Crear pedido" ──────────────────────────────

  describe('habilitación del botón Crear pedido', () => {
    it('el botón queda habilitado al cargarse la cotización con courier pre-seleccionado', async () => {
      renderModal();
      const btn = await screen.findByRole('button', { name: /crear pedido en aliclik/i });
      await waitFor(() => {
        expect(btn).not.toBeDisabled();
      });
    });

    it('el botón queda DESHABILITADO cuando unresolvedItems tiene al menos un ítem', async () => {
      // MOCK_QUOTE_WITH_UNRESOLVED tiene unresolvedItems con 2 ítems y un almacén
      // con cobertura y courier pre-seleccionado — lo único que bloquea es unresolvedItems.
      mockQuote.mockResolvedValue(MOCK_QUOTE_WITH_UNRESOLVED);
      renderModal();
      // Esperar que la cotización cargue y el banner de ítems sin enlace aparezca
      await screen.findByText(/productos no enlazados al catálogo aliclik/i);
      const btn = screen.getByRole('button', { name: /crear pedido en aliclik/i });
      expect(btn).toBeDisabled();
    });

    it('el botón queda HABILITADO cuando unresolvedItems está vacío y hay courier seleccionado con coords válidas', async () => {
      // MOCK_QUOTE_SINGLE_WAREHOUSE: unresolvedItems:[], un almacén con cobertura,
      // courier pre-seleccionado y coords válidas (lat:-12, lng:-77) → canSubmit=true.
      // Este es el default de beforeEach — lo declaramos explícito para claridad.
      mockQuote.mockResolvedValue(MOCK_QUOTE_SINGLE_WAREHOUSE);
      renderModal();
      const btn = await screen.findByRole('button', { name: /crear pedido en aliclik/i });
      await waitFor(() => {
        expect(btn).not.toBeDisabled();
      });
    });

    it('el botón se deshabilita mientras se procesa el envío', async () => {
      // createAliclikOrder nunca resuelve para mantener el estado "sending"
      mockCreate.mockReturnValue(new Promise(() => {}));
      renderModal();
      const btn = await screen.findByRole('button', { name: /crear pedido en aliclik/i });
      await waitFor(() => expect(btn).not.toBeDisabled());

      const user = userEvent.setup();
      await user.click(btn);

      await waitFor(() => {
        expect(screen.getByText(/creando pedido.../i)).toBeInTheDocument();
      });
    });

    it('cambiar el courier actualiza el select y mantiene el botón habilitado', async () => {
      mockQuote.mockResolvedValue({
        ...MOCK_QUOTE_SINGLE_WAREHOUSE,
        warehouses: [
          {
            ...MOCK_QUOTE_SINGLE_WAREHOUSE.warehouses[0],
            couriers: [MOCK_COURIER, MOCK_COURIER_EXPRESS],
          },
        ],
      });
      renderModal();
      await screen.findByText('Almacén Principal');

      const user = userEvent.setup();
      const selects = screen.getAllByRole('combobox') as HTMLSelectElement[];
      // El primer select con opción '10' es el de courier
      const courierSelect = selects.find((s) =>
        Array.from(s.options).some((o) => o.value === '10'),
      )!;
      expect(courierSelect).toBeDefined();

      await user.selectOptions(courierSelect, '11');

      expect(courierSelect.value).toBe('11');
      const btn = screen.getByRole('button', { name: /crear pedido en aliclik/i });
      expect(btn).not.toBeDisabled();
    });
  });

  // ── 5. Crear pedido: payload y éxito ─────────────────────────────────────

  describe('crear pedido — éxito', () => {
    it('llama a createAliclikOrder con companyId, orderId y shipments correctos', async () => {
      renderModal();
      await screen.findByRole('button', { name: /crear pedido en aliclik/i });

      const user = userEvent.setup();
      const btn = screen.getByRole('button', { name: /crear pedido en aliclik/i });
      await waitFor(() => expect(btn).not.toBeDisabled());
      await user.click(btn);

      await waitFor(() => {
        expect(mockCreate).toHaveBeenCalledWith(
          'fake-token',
          expect.objectContaining({
            companyId: 'company-1',
            orderId: 'order-abc',
            shipments: expect.arrayContaining([
              expect.objectContaining({
                warehouseId: 1,
                courier: expect.objectContaining({
                  transportId: MOCK_COURIER.transportId,
                  deliveryCost: MOCK_COURIER.deliveryCost,
                  returnCost: MOCK_COURIER.returnCost,
                  addDays: MOCK_COURIER.addDays,
                  flagDeliveryExpress: MOCK_COURIER.flagDeliveryExpress,
                }),
              }),
            ]),
          }),
        );
      });
    });

    it('el payload NO incluye "channel" cuando no se seleccionó canal', async () => {
      renderModal();
      await screen.findByRole('button', { name: /crear pedido en aliclik/i });

      const user = userEvent.setup();
      const btn = screen.getByRole('button', { name: /crear pedido en aliclik/i });
      await waitFor(() => expect(btn).not.toBeDisabled());
      await user.click(btn);

      await waitFor(() => {
        const [, payload] = mockCreate.mock.calls[0];
        expect(payload).not.toHaveProperty('channel');
      });
    });

    it('el payload incluye "channel" cuando se seleccionó un canal', async () => {
      renderModal();
      await screen.findByText('María García');

      const user = userEvent.setup();
      const selects = screen.getAllByRole('combobox') as HTMLSelectElement[];
      // Buscar el select con opción "instagram" (canal de venta)
      const channelSelect = selects.find((s) =>
        Array.from(s.options).some((o) => o.value === 'instagram'),
      )!;
      await user.selectOptions(channelSelect, 'instagram');

      const btn = screen.getByRole('button', { name: /crear pedido en aliclik/i });
      await waitFor(() => expect(btn).not.toBeDisabled());
      await user.click(btn);

      await waitFor(() => {
        const [, payload] = mockCreate.mock.calls[0];
        expect(payload).toHaveProperty('channel', 'instagram');
      });
    });

    it('muestra el externalOrderNumber tras éxito', async () => {
      renderModal();
      await screen.findByRole('button', { name: /crear pedido en aliclik/i });

      const user = userEvent.setup();
      const btn = screen.getByRole('button', { name: /crear pedido en aliclik/i });
      await waitFor(() => expect(btn).not.toBeDisabled());
      await user.click(btn);

      expect(await screen.findByText('ALI-12345')).toBeInTheDocument();
    });

    it('muestra el texto "Pedido creado" tras éxito', async () => {
      renderModal();
      await screen.findByRole('button', { name: /crear pedido en aliclik/i });

      const user = userEvent.setup();
      const btn = screen.getByRole('button', { name: /crear pedido en aliclik/i });
      await waitFor(() => expect(btn).not.toBeDisabled());
      await user.click(btn);

      expect(await screen.findByText(/pedido creado/i)).toBeInTheDocument();
    });

    it('llama a toast.success tras crear correctamente', async () => {
      renderModal();
      await screen.findByRole('button', { name: /crear pedido en aliclik/i });

      const user = userEvent.setup();
      const btn = screen.getByRole('button', { name: /crear pedido en aliclik/i });
      await waitFor(() => expect(btn).not.toBeDisabled());
      await user.click(btn);

      await waitFor(() => {
        expect(mockToast.success).toHaveBeenCalledWith(
          expect.stringContaining('Aliclik'),
        );
      });
    });

    it('llama a onSuccess tras crear correctamente', async () => {
      renderModal();
      await screen.findByRole('button', { name: /crear pedido en aliclik/i });

      const user = userEvent.setup();
      const btn = screen.getByRole('button', { name: /crear pedido en aliclik/i });
      await waitFor(() => expect(btn).not.toBeDisabled());
      await user.click(btn);

      await waitFor(() => {
        expect(BASE_PROPS.onSuccess).toHaveBeenCalled();
      });
    });
  });

  // ── 6. Editar el delivery ─────────────────────────────────────────────────

  describe('editar delivery de un almacén', () => {
    it('el delivery editado se envía en el payload', async () => {
      renderModal();
      await screen.findByText('Almacén Principal');

      const user = userEvent.setup();
      // El input de costo de envío tiene type="number" y un valor pre-rellenado
      const deliveryInput = screen.getByRole('spinbutton') as HTMLInputElement;
      await user.clear(deliveryInput);
      await user.type(deliveryInput, '99');

      const btn = screen.getByRole('button', { name: /crear pedido en aliclik/i });
      await waitFor(() => expect(btn).not.toBeDisabled());
      await user.click(btn);

      await waitFor(() => {
        const [, payload] = mockCreate.mock.calls[0] as [string, { shipments: { delivery: number }[] }];
        expect(payload.shipments[0].delivery).toBe(99);
      });
    });

    it('el input de delivery viene pre-rellenado con el costo del courier', async () => {
      renderModal();
      await screen.findByText('Almacén Principal');

      const deliveryInput = screen.getByRole('spinbutton') as HTMLInputElement;
      expect(deliveryInput.value).toBe(String(MOCK_COURIER.deliveryCost));
    });
  });

  // ── 7. Error de cotización ────────────────────────────────────────────────

  describe('error de cotización', () => {
    it('muestra estado de error cuando quoteAliclikOrder rechaza', async () => {
      mockQuote.mockRejectedValue({
        response: { data: { message: 'Sin stock para cotizar' } },
      });
      renderModal();
      expect(
        await screen.findByText('Sin stock para cotizar'),
      ).toBeInTheDocument();
    });

    it('llama a toast.error cuando quoteAliclikOrder rechaza', async () => {
      mockQuote.mockRejectedValue({
        response: { data: { message: 'Sin stock para cotizar' } },
      });
      renderModal();
      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith('Sin stock para cotizar');
      });
    });

    it('usa mensaje genérico si el error no tiene response.data.message', async () => {
      mockQuote.mockRejectedValue(new Error('network error'));
      renderModal();
      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith(
          'Error al cotizar el pedido en Aliclik',
        );
      });
    });

    it('muestra botón Cerrar en el estado de error', async () => {
      mockQuote.mockRejectedValue({
        response: { data: { message: 'Error' } },
      });
      renderModal();
      expect(
        await screen.findByRole('button', { name: /cerrar/i }),
      ).toBeInTheDocument();
    });

    it('no muestra el botón "Crear pedido" cuando hay error de cotización', async () => {
      mockQuote.mockRejectedValue({ response: { data: { message: 'Error' } } });
      renderModal();
      await screen.findByRole('button', { name: /cerrar/i });
      expect(
        screen.queryByRole('button', { name: /crear pedido en aliclik/i }),
      ).not.toBeInTheDocument();
    });
  });

  // ── 8. Error al crear ─────────────────────────────────────────────────────

  describe('error al crear pedido', () => {
    it('llama a toast.error cuando createAliclikOrder rechaza', async () => {
      mockCreate.mockRejectedValue({
        response: { data: { message: 'Credenciales inválidas en Aliclik' } },
      });
      renderModal();
      await screen.findByRole('button', { name: /crear pedido en aliclik/i });

      const user = userEvent.setup();
      const btn = screen.getByRole('button', { name: /crear pedido en aliclik/i });
      await waitFor(() => expect(btn).not.toBeDisabled());
      await user.click(btn);

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith('Credenciales inválidas en Aliclik');
      });
    });

    it('NO llama a onSuccess cuando createAliclikOrder rechaza', async () => {
      mockCreate.mockRejectedValue(new Error('fail'));
      renderModal();
      await screen.findByRole('button', { name: /crear pedido en aliclik/i });

      const user = userEvent.setup();
      const btn = screen.getByRole('button', { name: /crear pedido en aliclik/i });
      await waitFor(() => expect(btn).not.toBeDisabled());
      await user.click(btn);

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalled();
      });
      expect(BASE_PROPS.onSuccess).not.toHaveBeenCalled();
    });

    it('usa mensaje genérico si createAliclikOrder rechaza sin response.data.message', async () => {
      mockCreate.mockRejectedValue(new Error('generic'));
      renderModal();
      await screen.findByRole('button', { name: /crear pedido en aliclik/i });

      const user = userEvent.setup();
      const btn = screen.getByRole('button', { name: /crear pedido en aliclik/i });
      await waitFor(() => expect(btn).not.toBeDisabled());
      await user.click(btn);

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith(
          'Error al crear el pedido en Aliclik',
        );
      });
    });

    it('no muestra la pantalla de éxito cuando createAliclikOrder rechaza', async () => {
      mockCreate.mockRejectedValue(new Error('fail'));
      renderModal();
      await screen.findByRole('button', { name: /crear pedido en aliclik/i });

      const user = userEvent.setup();
      const btn = screen.getByRole('button', { name: /crear pedido en aliclik/i });
      await waitFor(() => expect(btn).not.toBeDisabled());
      await user.click(btn);

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalled();
      });
      expect(screen.queryByText(/pedido creado/i)).not.toBeInTheDocument();
    });
  });

  // ── 9. Fallback de coordenadas ────────────────────────────────────────────

  describe('fallback de coordenadas', () => {
    // ── Caso 1: quote CON coords válidas — NO muestra inputs de fallback ──

    it('NO muestra inputs de latitud/longitud cuando el quote tiene coords válidas', async () => {
      // MOCK_QUOTE_SINGLE_WAREHOUSE tiene lat:-12.0, lng:-77.0 (válidos)
      renderModal();
      await screen.findByText('María García');
      expect(screen.queryByLabelText(/latitud/i)).not.toBeInTheDocument();
      expect(screen.queryByLabelText(/longitud/i)).not.toBeInTheDocument();
    });

    it('NO llama a updateClient al confirmar cuando el quote tiene coords válidas', async () => {
      renderModal();
      const btn = await screen.findByRole('button', { name: /crear pedido en aliclik/i });
      await waitFor(() => expect(btn).not.toBeDisabled());

      const user = userEvent.setup();
      await user.click(btn);

      await waitFor(() => {
        expect(mockCreate).toHaveBeenCalled();
      });
      expect(mockUpdateClient).not.toHaveBeenCalled();
    });

    // ── Caso 2: quote SIN coords — muestra inputs y bloquea el botón ────

    it('muestra inputs de latitud y longitud cuando el quote no tiene coords (lat=0, lng=0)', async () => {
      mockQuote.mockResolvedValue(MOCK_QUOTE_NO_COORDS);
      renderModal();
      await screen.findByText('María García');
      // Los labels son "LATITUD *" y "LONGITUD *" (uppercase en CSS pero el texto DOM es minúscula)
      expect(screen.getByLabelText(/latitud/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/longitud/i)).toBeInTheDocument();
    });

    it('el botón queda deshabilitado con coords faltantes mientras no se ingresan valores', async () => {
      mockQuote.mockResolvedValue(MOCK_QUOTE_NO_COORDS);
      renderModal();
      const btn = await screen.findByRole('button', { name: /crear pedido en aliclik/i });
      // Sin inputs completados, canSubmit=false
      expect(btn).toBeDisabled();
    });

    it('el botón sigue deshabilitado si se ingresa latitud pero no longitud', async () => {
      mockQuote.mockResolvedValue(MOCK_QUOTE_NO_COORDS);
      renderModal();
      await screen.findByText('María García');

      const user = userEvent.setup();
      const latInput = screen.getByLabelText(/latitud/i);
      await user.type(latInput, '-12.046374');

      const btn = screen.getByRole('button', { name: /crear pedido en aliclik/i });
      expect(btn).toBeDisabled();
    });

    it('el botón se habilita cuando se ingresan lat y lng válidos', async () => {
      mockQuote.mockResolvedValue(MOCK_QUOTE_NO_COORDS);
      renderModal();
      await screen.findByText('María García');

      const user = userEvent.setup();
      await user.type(screen.getByLabelText(/latitud/i), '-12.046374');
      await user.type(screen.getByLabelText(/longitud/i), '-77.042793');

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /crear pedido en aliclik/i })).not.toBeDisabled();
      });
    });

    // ── Caso 3: coords faltantes + clientId presente → updateClient antes de create ──

    it('llama a updateClient con clientId, companyId, latitude y longitude antes de createAliclikOrder', async () => {
      mockQuote.mockResolvedValue(MOCK_QUOTE_NO_COORDS);
      renderModal({ clientId: 'client-42' });
      await screen.findByText('María García');

      const user = userEvent.setup();
      await user.type(screen.getByLabelText(/latitud/i), '-12.046374');
      await user.type(screen.getByLabelText(/longitud/i), '-77.042793');

      const btn = screen.getByRole('button', { name: /crear pedido en aliclik/i });
      await waitFor(() => expect(btn).not.toBeDisabled());
      await user.click(btn);

      await waitFor(() => {
        expect(mockUpdateClient).toHaveBeenCalledWith(
          'client-42',
          expect.objectContaining({
            companyId: 'company-1',
            latitude: -12.046374,
            longitude: -77.042793,
          }),
        );
      });
    });

    it('llama a createAliclikOrder después de updateClient cuando hay clientId y coords', async () => {
      mockQuote.mockResolvedValue(MOCK_QUOTE_NO_COORDS);
      renderModal({ clientId: 'client-42' });
      await screen.findByText('María García');

      const user = userEvent.setup();
      await user.type(screen.getByLabelText(/latitud/i), '-12.046374');
      await user.type(screen.getByLabelText(/longitud/i), '-77.042793');

      const btn = screen.getByRole('button', { name: /crear pedido en aliclik/i });
      await waitFor(() => expect(btn).not.toBeDisabled());
      await user.click(btn);

      await waitFor(() => {
        expect(mockCreate).toHaveBeenCalled();
      });

      // Verificar que updateClient fue invocado antes que createAliclikOrder
      const updateOrder = mockUpdateClient.mock.invocationCallOrder[0];
      const createOrder = mockCreate.mock.invocationCallOrder[0];
      expect(updateOrder).toBeLessThan(createOrder);
    });

    // ── Caso 4: coords faltantes + sin clientId → error toast, no createAliclikOrder ──

    it('muestra toast de error y NO llama a createAliclikOrder cuando faltan coords y no hay clientId', async () => {
      mockQuote.mockResolvedValue(MOCK_QUOTE_NO_COORDS);
      // No pasamos clientId
      renderModal({ clientId: undefined });
      await screen.findByText('María García');

      const user = userEvent.setup();
      await user.type(screen.getByLabelText(/latitud/i), '-12.046374');
      await user.type(screen.getByLabelText(/longitud/i), '-77.042793');

      const btn = screen.getByRole('button', { name: /crear pedido en aliclik/i });
      await waitFor(() => expect(btn).not.toBeDisabled());
      await user.click(btn);

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith(
          expect.stringMatching(/cliente/i),
        );
      });
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it('el botón no queda bloqueado en estado "enviando" después del error por clientId ausente', async () => {
      mockQuote.mockResolvedValue(MOCK_QUOTE_NO_COORDS);
      renderModal({ clientId: undefined });
      await screen.findByText('María García');

      const user = userEvent.setup();
      await user.type(screen.getByLabelText(/latitud/i), '-12.046374');
      await user.type(screen.getByLabelText(/longitud/i), '-77.042793');

      const btn = screen.getByRole('button', { name: /crear pedido en aliclik/i });
      await waitFor(() => expect(btn).not.toBeDisabled());
      await user.click(btn);

      // Tras el error, el botón debe volver a estar habilitado (sending=false)
      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalled();
      });
      // El texto "Creando pedido..." desaparece — el componente salió del estado sending
      expect(screen.queryByText(/creando pedido\.\.\./i)).not.toBeInTheDocument();
      // El botón vuelve a estar habilitado
      expect(btn).not.toBeDisabled();
    });
  });
});
