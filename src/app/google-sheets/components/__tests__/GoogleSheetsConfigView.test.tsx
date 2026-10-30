import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GoogleSheetsConfigView } from '../GoogleSheetsConfigView';
import { useGoogleSheets } from '../../hooks/useGoogleSheets';
import { googleSheetsApi } from '../../services/googleSheetsApi';
import type { GoogleConfigView } from '../../types';

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ auth: { company: { stores: [{ id: 's1', name: 'Mi tienda' }] } } }),
}));
jest.mock('../../hooks/useGoogleSheets', () => ({ useGoogleSheets: jest.fn() }));
jest.mock('../../services/googleSheetsApi', () => ({ googleSheetsApi: { getTabs: jest.fn() } }));

const useHook = useGoogleSheets as jest.Mock;
const getTabs = googleSheetsApi.getTabs as jest.Mock;

const config: GoogleConfigView = {
  connected: true,
  status: 'NEEDS_SETUP',
  file: { id: 'f1', name: 'Ventas' },
  storeId: 's1',
  tabs: [],
  headerMapping: null,
  running: false,
  lastRun: null,
  lastError: null,
  openIssues: 0,
};

function hookState(over: Record<string, unknown> = {}) {
  return {
    step: 'CONFIGURE',
    config,
    preview: null,
    review: null,
    issues: [],
    loading: false,
    error: null,
    reconfiguring: false,
    changingFile: false,
    changeFile: jest.fn(),
    cancelChangeFile: jest.fn(),
    cancelReconfigure: jest.fn(),
    savePreview: jest.fn(),
    selectFile: jest.fn(),
    getAccessToken: jest.fn(),
    ...over,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

it('en CONFIGURE ofrece "Cambiar archivo" y llama a changeFile (I4)', async () => {
  getTabs.mockResolvedValue([{ id: 1, name: 'Enero' }]);
  const state = hookState();
  useHook.mockReturnValue(state);
  render(<GoogleSheetsConfigView />);
  await userEvent.click(screen.getByRole('button', { name: 'Cambiar archivo' }));
  expect(state.changeFile).toHaveBeenCalled();
});

it('mientras se cambia de archivo, el selector ofrece volver', async () => {
  const state = hookState({ step: 'SELECT_FILE', changingFile: true });
  useHook.mockReturnValue(state);
  render(<GoogleSheetsConfigView />);
  await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
  expect(state.cancelChangeFile).toHaveBeenCalled();
});

it('al cambiar de archivo descarta las pestañas del anterior', async () => {
  getTabs.mockResolvedValueOnce([{ id: 1, name: 'Enero' }]);
  useHook.mockReturnValue(hookState());
  const view = render(<GoogleSheetsConfigView />);
  expect(await screen.findByText('Enero')).toBeInTheDocument();

  // El otro archivo todavía no respondió: no deben quedar las pestañas del anterior.
  getTabs.mockReturnValueOnce(new Promise(() => undefined));
  useHook.mockReturnValue(hookState({ config: { ...config, file: { id: 'f2', name: 'Otra' } } }));
  await act(async () => {
    view.rerender(<GoogleSheetsConfigView />);
  });
  await waitFor(() => expect(getTabs).toHaveBeenLastCalledWith('f2'));
  expect(screen.queryByText('Enero')).not.toBeInTheDocument();
});
