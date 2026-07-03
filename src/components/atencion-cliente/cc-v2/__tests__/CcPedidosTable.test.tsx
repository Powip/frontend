import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CcPedidosTable } from '../CcPedidosTable';
import { OrderHeader } from '@/interfaces/IOrder';

/* ---------------------------------------------------------------
   Mock mínimo de OrderHeader
   Solo los campos obligatorios + los relevantes para los tests.
--------------------------------------------------------------- */
function makeOrder(overrides: Partial<OrderHeader> = {}): OrderHeader {
  return {
    id: 'order-1',
    orderNumber: 'ORD-001',
    receiptType: 'BOLETA',
    orderType: 'VENTA',
    storeId: 'store-1',
    customer: {
      id: 'client-1',
      companyId: 'company-1',
      fullName: 'Juan Pérez',
      phoneNumber: '999111222',
      clientType: 'TRADICIONAL',
      province: 'Lima',
      city: 'Lima',
      district: 'Miraflores',
      address: 'Av. Test 123',
      isActive: true,
    },
    salesChannel: 'WHATSAPP',
    closingChannel: 'WHATSAPP',
    deliveryType: 'DOMICILIO',
    courierId: null,
    courier: null,
    subtotal: '100.00',
    taxTotal: '0.00',
    shippingTotal: '0.00',
    discountTotal: '0.00',
    grandTotal: '100.00',
    status: 'PENDIENTE',
    salesRegion: 'LIMA',
    cancellationReason: null,
    notes: null,
    items: [],
    payments: [],
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    subEstadoCc: 'por_confirmar',
    ...overrides,
  };
}

/* ---------------------------------------------------------------
   Props base mínimas
--------------------------------------------------------------- */
const baseProps = {
  tipoGestion: 'cod' as const,
  selectedIds: new Set<string>(),
  onToggle: jest.fn(),
  onToggleAll: jest.fn(),
  onVerPedido: jest.fn(),
  onWhatsApp: jest.fn(),
  onGestionarPago: jest.fn(),
};

function renderTable(
  data: OrderHeader[],
  extra: Partial<typeof baseProps & { onRecuperar?: (o: OrderHeader) => void }> = {},
) {
  return render(
    <CcPedidosTable
      data={data}
      {...baseProps}
      {...extra}
    />,
  );
}

describe('CcPedidosTable — botón "Recuperar venta"', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('(sanity) renderiza el orderNumber del pedido', () => {
    renderTable([makeOrder()]);
    expect(screen.getByText('ORD-001')).toBeInTheDocument();
  });

  it('muestra el botón cuando subEstadoCc=anulado_cc y onRecuperar está provisto', () => {
    const order = makeOrder({ subEstadoCc: 'anulado_cc' });
    const onRecuperar = jest.fn();

    renderTable([order], { onRecuperar });

    expect(screen.getByTitle('Recuperar venta')).toBeInTheDocument();
  });

  it('al hacer click en "Recuperar venta" llama onRecuperar con el order correcto', async () => {
    const order = makeOrder({ subEstadoCc: 'anulado_cc' });
    const onRecuperar = jest.fn();

    renderTable([order], { onRecuperar });

    await userEvent.click(screen.getByTitle('Recuperar venta'));

    expect(onRecuperar).toHaveBeenCalledTimes(1);
    expect(onRecuperar).toHaveBeenCalledWith(order);
  });

  it('NO renderiza el botón cuando subEstadoCc=por_confirmar (no anulado)', () => {
    const order = makeOrder({ subEstadoCc: 'por_confirmar' });
    const onRecuperar = jest.fn();

    renderTable([order], { onRecuperar });

    expect(screen.queryByTitle('Recuperar venta')).toBeNull();
  });

  it('NO renderiza el botón cuando subEstadoCc=anulado_cc pero onRecuperar no está provisto', () => {
    const order = makeOrder({ subEstadoCc: 'anulado_cc' });

    // onRecuperar ausente (no se pasa la prop)
    renderTable([order]);

    expect(screen.queryByTitle('Recuperar venta')).toBeNull();
  });
});
