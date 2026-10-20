import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CcGestionPanel } from '../CcGestionPanel';
import { SubEstadoCc } from '@/interfaces/IOrder';

/* ---------------------------------------------------------------
   Mocks de infraestructura
--------------------------------------------------------------- */
jest.mock('@/services/atencionClienteService', () => ({
  updateSubEstadoCC: jest.fn(),
  confirmarEntregaLima: jest.fn(),
  confirmarDespacho: jest.fn(),
}));

jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
    warning: jest.fn(),
  },
}));

import {
  updateSubEstadoCC,
  confirmarEntregaLima,
  confirmarDespacho,
} from '@/services/atencionClienteService';
import { toast } from 'sonner';

/* ---------------------------------------------------------------
   Helpers
--------------------------------------------------------------- */
interface RenderProps {
  subEstadoCc: SubEstadoCc;
  callAttempts?: number;
  datosCompletos?: boolean;
  beforeCancellation?: () => Promise<boolean>;
}

function renderPanel({ subEstadoCc, callAttempts = 0, datosCompletos = true, beforeCancellation }: RenderProps) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');
  const onUpdated = jest.fn();

  const utils = render(
    <QueryClientProvider client={queryClient}>
      <CcGestionPanel
        orderId="order-1"
        subEstadoCc={subEstadoCc}
        callAttempts={callAttempts}
        datosCompletos={datosCompletos}
        onUpdated={onUpdated}
        beforeCancellation={beforeCancellation}
      />
    </QueryClientProvider>,
  );

  return { ...utils, invalidateSpy, onUpdated };
}

const CHECKLIST_LABELS = [
  'DNI del cliente verificado',
  'Dirección de entrega confirmada',
  'Productos del pedido correctos',
  'Precio total acordado con el cliente',
];

async function checkAllChecklistItems() {
  for (const label of CHECKLIST_LABELS) {
    await userEvent.click(screen.getByRole('checkbox', { name: label }));
  }
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('CcGestionPanel — invalidación de queryKey ["orders"]', () => {
  it('al llegar a un estado terminal (anulado_cc) invalida ["orders"]', async () => {
    jest.mocked(updateSubEstadoCC).mockResolvedValue({ autoCanceled: false });

    const { invalidateSpy } = renderPanel({ subEstadoCc: 'por_confirmar' });

    await userEvent.click(screen.getByRole('button', { name: /anular pedido/i }));

    await waitFor(() => expect(toast.success).toHaveBeenCalled());
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['orders'] });
  });

  it('cuando el servicio responde autoCanceled=true (límite de intentos) invalida ["orders"] aunque el estado no sea terminal', async () => {
    jest.mocked(updateSubEstadoCC).mockResolvedValue({ autoCanceled: true });

    const { invalidateSpy } = renderPanel({ subEstadoCc: 'por_confirmar', callAttempts: 2 });

    await userEvent.click(screen.getByRole('button', { name: /no contesta/i }));

    await waitFor(() => expect(toast.warning).toHaveBeenCalled());
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['orders'] });
  });

  it('NO invalida ["orders"] cuando el nuevo estado no es terminal ni hay auto-cancelación', async () => {
    jest.mocked(updateSubEstadoCC).mockResolvedValue({ autoCanceled: false });

    const { invalidateSpy } = renderPanel({ subEstadoCc: 'por_confirmar' });

    await userEvent.click(screen.getByRole('button', { name: 'Contactado' }));

    await waitFor(() => expect(toast.success).toHaveBeenCalled());
    expect(invalidateSpy).not.toHaveBeenCalled();
  });

  it('al confirmar entrega Lima invalida ["orders"]', async () => {
    jest.mocked(confirmarEntregaLima).mockResolvedValue(undefined);

    const { invalidateSpy, container } = renderPanel({ subEstadoCc: 'entrega_lima' });

    await userEvent.click(screen.getByRole('button', { name: /confirmar entrega lima/i }));

    const dateInput = container.querySelector('input[type="datetime-local"]');
    expect(dateInput).not.toBeNull();
    // userEvent.type() no soporta bien inputs datetime-local (limitación conocida
    // de user-event) — se usa fireEvent.change como excepción justificada.
    fireEvent.change(dateInput as HTMLInputElement, {
      target: { value: '2026-08-25T10:00' },
    });

    await userEvent.click(screen.getByRole('button', { name: 'Confirmar entrega' }));

    // Se espera directo sobre invalidateSpy (no sobre la llamada al service):
    // confirmarEntregaLima ya fue invocado en cuanto se hizo click, pero
    // invalidateQueries recién se dispara DESPUÉS de que su promesa resuelve.
    await waitFor(() => expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['orders'] }));
    expect(confirmarEntregaLima).toHaveBeenCalledWith('order-1', expect.any(String));
  });

  it('al confirmar despacho (checklist COD) invalida ["orders"]', async () => {
    jest.mocked(confirmarDespacho).mockResolvedValue(undefined);

    const { invalidateSpy } = renderPanel({ subEstadoCc: 'por_confirmar' });

    await userEvent.click(screen.getByRole('button', { name: /confirmar despacho/i }));
    await checkAllChecklistItems();
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar' }));

    // Idem: se espera sobre invalidateSpy, que se dispara después de que
    // resuelve la promesa de confirmarDespacho.
    await waitFor(() => expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['orders'] }));
    expect(confirmarDespacho).toHaveBeenCalledWith('order-1');
    expect(confirmarDespacho).toHaveBeenCalledTimes(1);
    expect(updateSubEstadoCC).not.toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith('Venta confirmada como Pendiente. Revisa su estado antes de preparar o enviar.');
    expect(screen.queryByText(/selecci[oó]n de IMEI/i)).not.toBeInTheDocument();
  });
});


describe('CcGestionPanel — retorno físico antes de anular', () => {
  test.each(['Anular pedido', 'No contesta (3/3)'])('%s opens physical return and leaves the CC state unchanged', async (label) => {
    const beforeCancellation = jest.fn().mockResolvedValue(true);
    const { onUpdated, invalidateSpy } = renderPanel({ subEstadoCc: 'por_confirmar', callAttempts: 2, beforeCancellation });
    await userEvent.click(screen.getByRole('button', { name: label }));
    await waitFor(() => expect(beforeCancellation).toHaveBeenCalledTimes(1));
    expect(updateSubEstadoCC).not.toHaveBeenCalled();
    expect(onUpdated).not.toHaveBeenCalled();
    expect(invalidateSpy).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
  });
  test('NONE keeps the original CC cancellation after classification', async () => {
    const beforeCancellation = jest.fn().mockResolvedValue(false);
    jest.mocked(updateSubEstadoCC).mockResolvedValue({ autoCanceled: false });
    renderPanel({ subEstadoCc: 'por_confirmar', beforeCancellation });
    await userEvent.click(screen.getByRole('button', { name: 'Anular pedido' }));
    await waitFor(() => expect(updateSubEstadoCC).toHaveBeenCalledWith('order-1', 'anulado_cc', 'Anulado por CC'));
    expect(beforeCancellation).toHaveBeenCalledTimes(1);
  });
  test('a first unanswered call is still recorded without starting a return', async () => {
    const beforeCancellation = jest.fn().mockResolvedValue(true);
    jest.mocked(updateSubEstadoCC).mockResolvedValue({ autoCanceled: false });
    renderPanel({ subEstadoCc: 'por_confirmar', callAttempts: 0, beforeCancellation });
    await userEvent.click(screen.getByRole('button', { name: 'No contesta (1/3)' }));
    await waitFor(() => expect(updateSubEstadoCC).toHaveBeenCalled());
    expect(beforeCancellation).not.toHaveBeenCalled();
  });
  test('an unresolved cancellation preflight never falls through to CC mutation', async () => {
    const beforeCancellation = jest.fn().mockRejectedValue(new Error('unavailable'));
    renderPanel({ subEstadoCc: 'por_confirmar', beforeCancellation });
    await userEvent.click(screen.getByRole('button', { name: 'Anular pedido' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(updateSubEstadoCC).not.toHaveBeenCalled();
  });
});
