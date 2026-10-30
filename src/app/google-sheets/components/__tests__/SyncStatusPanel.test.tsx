import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SyncStatusPanel } from '../SyncStatusPanel';
import { googleSheetsApi } from '../../services/googleSheetsApi';
import type { GoogleConfigView, SyncIssue } from '../../types';

jest.mock('../../services/googleSheetsApi', () => ({
  googleSheetsApi: { getTabs: jest.fn() },
}));
const getTabs = googleSheetsApi.getTabs as jest.Mock;

const config: GoogleConfigView = {
  connected: true,
  status: 'READY',
  file: { id: 'f1', name: 'Pedidos 2026' },
  storeId: 's1',
  tabs: [{ id: 10, name: 'Enero' }],
  headerMapping: {},
  running: false,
  lastRun: {
    at: '2026-03-05T15:30:00.000Z',
    status: 'partial',
    summary: { created: 4, drafts: 2, duplicates: 1, problems: 3, tabsSkipped: 1 },
  },
  lastError: null,
  openIssues: 2,
};
const issues: SyncIssue[] = [
  { orderRef: 'V-100', rowNumbers: [12, 13], code: 'X', message: 'Falta el teléfono', firstSeenAt: '', lastSeenAt: '' },
  { orderRef: '(pestaña)', rowNumbers: [], code: 'Y', message: 'No tiene encabezados', firstSeenAt: '', lastSeenAt: '' },
];
const stores = [{ id: 's1', name: 'Mi tienda' }];

const setup = (over: Partial<React.ComponentProps<typeof SyncStatusPanel>> = {}) => {
  const props = {
    config,
    issues,
    stores,
    loading: false,
    onSyncNow: jest.fn(),
    onDisconnect: jest.fn(),
    onReconfigure: jest.fn(),
    onReconnect: jest.fn(),
    ...over,
  };
  render(<SyncStatusPanel {...props} />);
  return props;
};

beforeEach(() => {
  getTabs.mockReset();
  getTabs.mockResolvedValue([{ id: 10, name: 'Enero' }]);
});

it('muestra archivo, tienda por nombre, pestañas y última corrida con conteos', async () => {
  setup();
  expect(screen.getByText('Pedidos 2026')).toBeInTheDocument();
  expect(screen.getByText('Mi tienda')).toBeInTheDocument();
  expect(screen.getByText('Enero')).toBeInTheDocument();
  expect(screen.getByText(/Creadas: 4/)).toBeInTheDocument();
  expect(screen.getByText(/Borradores: 2/)).toBeInTheDocument();
  expect(screen.getByText(/Duplicadas: 1/)).toBeInTheDocument();
  expect(screen.getByText(/Con problemas: 3/)).toBeInTheDocument();
  expect(screen.getByText(/Pestañas omitidas: 1/)).toBeInTheDocument();
  await waitFor(() => expect(getTabs).toHaveBeenCalledWith('f1'));
});

it('lista los problemas con ID de venta, filas y motivo, y los de pestaña aparte', async () => {
  setup();
  expect(screen.getByText(/V-100/)).toBeInTheDocument();
  expect(screen.getByText('Fila 12, 13')).toBeInTheDocument();
  expect(screen.getByText('Falta el teléfono')).toBeInTheDocument();
  expect(screen.getByText(/Problema de la pestaña/)).toBeInTheDocument();
  expect(screen.getByText('No tiene encabezados')).toBeInTheDocument();
  expect(screen.queryByText(/\(pestaña\)/)).not.toBeInTheDocument();
  await waitFor(() => expect(getTabs).toHaveBeenCalled());
});

it('avisa de pestañas del archivo que no están marcadas', async () => {
  getTabs.mockResolvedValue([
    { id: 10, name: 'Enero' },
    { id: 11, name: 'Febrero' },
  ]);
  setup();
  const alert = await screen.findByRole('status');
  expect(alert).toHaveTextContent('Febrero');
  expect(alert).not.toHaveTextContent('Enero');
});

it('si getTabs falla no muestra aviso ni error', async () => {
  getTabs.mockRejectedValue(new Error('boom'));
  setup();
  await waitFor(() => expect(getTabs).toHaveBeenCalled());
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

it('Sincronizar ahora llama a onSyncNow', async () => {
  const p = setup();
  await userEvent.click(screen.getByRole('button', { name: 'Sincronizar ahora' }));
  expect(p.onSyncNow).toHaveBeenCalled();
});

it('mientras corre muestra "Sincronizando…" y deshabilita el botón', async () => {
  setup({ config: { ...config, running: true } });
  expect(screen.getByRole('button', { name: /Sincronizando…/ })).toBeDisabled();
  await waitFor(() => expect(getTabs).toHaveBeenCalled());
});

it('muestra el último error', async () => {
  setup({ config: { ...config, lastError: 'La hoja ya no existe' } });
  expect(screen.getByText('La hoja ya no existe')).toBeInTheDocument();
  await waitFor(() => expect(getTabs).toHaveBeenCalled());
});

it('con NEEDS_RECONNECT ofrece reconectar en vez de sincronizar', async () => {
  const p = setup({ config: { ...config, status: 'NEEDS_RECONNECT' } });
  expect(screen.queryByRole('button', { name: 'Sincronizar ahora' })).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Reconectar cuenta' }));
  expect(p.onReconnect).toHaveBeenCalled();
  await waitFor(() => expect(getTabs).toHaveBeenCalled());
});

it('Desconectar pide confirmación y recién ahí llama a onDisconnect', async () => {
  const p = setup();
  await userEvent.click(screen.getByRole('button', { name: 'Desconectar' }));
  expect(p.onDisconnect).not.toHaveBeenCalled();
  const dialog = await screen.findByRole('alertdialog');
  await userEvent.click(within(dialog).getByRole('button', { name: 'Desconectar' }));
  expect(p.onDisconnect).toHaveBeenCalledTimes(1);
});

it('cancelar la confirmación no desconecta', async () => {
  const p = setup();
  await userEvent.click(screen.getByRole('button', { name: 'Desconectar' }));
  const dialog = await screen.findByRole('alertdialog');
  await userEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
  expect(p.onDisconnect).not.toHaveBeenCalled();
});

it('Reconfigurar llama a onReconfigure', async () => {
  const p = setup();
  await userEvent.click(screen.getByRole('button', { name: 'Reconfigurar' }));
  expect(p.onReconfigure).toHaveBeenCalled();
  await waitFor(() => expect(getTabs).toHaveBeenCalled());
});
