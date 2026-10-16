import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AxiosAdapter } from 'axios';
import axiosAuth from '@/lib/axiosAuth';
import { tokenStore } from '@/lib/tokenStore';
import PaymentProofUploadModal from '../PaymentProofUploadModal';

jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
jest.mock('@/components/ui/dialog', () => ({
  Dialog: ({ open, children }: { open: boolean; children: React.ReactNode }) => open ? <div>{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
}));

it('envía el comprobante con el Bearer de la sesión y notifica éxito después de guardarlo', async () => {
  const originalAdapter = axiosAuth.defaults.adapter;
  const adapter = jest.fn<ReturnType<AxiosAdapter>, Parameters<AxiosAdapter>>(async (config) => ({
    data: { paymentProofUrl: 'https://proof.example.com/comprobante.pdf' },
    status: 200,
    statusText: 'OK',
    headers: {},
    config,
  }));
  axiosAuth.defaults.adapter = adapter;
  tokenStore.set('test-session-token');
  process.env.NEXT_PUBLIC_API_VENTAS = 'http://ventas';

  try {
    const onSuccess = jest.fn();
    const onClose = jest.fn();
    const { container } = render(<PaymentProofUploadModal open paymentId="payment-1" onClose={onClose} onSuccess={onSuccess} />);
    const file = new File(['receipt'], 'comprobante.pdf', { type: 'application/pdf' });
    await userEvent.upload(container.querySelector('input[type="file"]') as HTMLInputElement, file);
    await userEvent.click(screen.getByRole('button', { name: 'Subir Comprobante' }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
    expect(adapter).toHaveBeenCalledTimes(1);
    const config = adapter.mock.calls[0][0];
    expect(config.url).toBe('http://ventas/payments/payments/payment-1/upload-proof');
    expect(config.headers.get('Authorization')).toBe('Bearer test-session-token');
    expect((config.data as FormData).get('file')).toBe(file);
    expect(onClose).toHaveBeenCalledTimes(1);
  } finally {
    axiosAuth.defaults.adapter = originalAdapter;
    tokenStore.set(null);
  }
});
