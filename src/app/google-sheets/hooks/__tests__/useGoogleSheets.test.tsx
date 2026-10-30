import { renderHook, act, waitFor } from '@testing-library/react';
import { useGoogleSheets } from '../useGoogleSheets';
import { googleSheetsApi } from '../../services/googleSheetsApi';
import type { GoogleConfigView } from '../../types';

jest.mock('../../services/googleSheetsApi', () => ({
  googleSheetsApi: {
    getConfig: jest.fn(),
    getAuthUrl: jest.fn(),
    getAccessToken: jest.fn(),
    saveSheet: jest.fn(),
    getTabs: jest.fn(),
    preview: jest.fn(),
    saveConfig: jest.fn(),
    review: jest.fn(),
    activate: jest.fn(),
    syncNow: jest.fn(),
    getIssues: jest.fn(),
    disconnect: jest.fn(),
  },
}));

const api = googleSheetsApi as jest.Mocked<typeof googleSheetsApi>;

const baseConfig: GoogleConfigView = {
  connected: true,
  status: 'NEEDS_SETUP',
  file: null,
  storeId: null,
  tabs: [],
  headerMapping: null,
  running: false,
  lastRun: null,
  lastError: null,
  openIssues: 0,
};
const withFile = { ...baseConfig, file: { id: 'f1', name: 'Ventas' } };

const setup = async () => {
  const hook = renderHook(() => useGoogleSheets());
  await waitFor(() => expect(hook.result.current.loading).toBe(false));
  return hook;
};

describe('useGoogleSheets', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.history.replaceState({}, '', '/google-sheets');
    api.getIssues.mockResolvedValue([]);
  });

  it('arranca en CONNECT_ACCOUNT si no hay conexión', async () => {
    api.getConfig.mockResolvedValue({ ...baseConfig, connected: false });
    const { result } = await setup();
    expect(result.current.step).toBe('CONNECT_ACCOUNT');
  });

  it('en SELECT_FILE si está conectado sin archivo', async () => {
    api.getConfig.mockResolvedValue(baseConfig);
    const { result } = await setup();
    expect(result.current.step).toBe('SELECT_FILE');
  });

  it('en CONFIGURE si hay archivo y status NEEDS_SETUP', async () => {
    api.getConfig.mockResolvedValue(withFile);
    const { result } = await setup();
    expect(result.current.step).toBe('CONFIGURE');
  });

  it('en STATUS si READY', async () => {
    api.getConfig.mockResolvedValue({ ...withFile, status: 'READY' });
    const { result } = await setup();
    expect(result.current.step).toBe('STATUS');
  });

  it('muestra el mensaje de reconexión si NEEDS_RECONNECT', async () => {
    api.getConfig.mockResolvedValue({ ...withFile, status: 'NEEDS_RECONNECT' });
    const { result } = await setup();
    expect(result.current.step).toBe('CONNECT_ACCOUNT');
    expect(result.current.error).toMatch(/reconect/i);
  });

  it('?status=success recarga la config y sigue', async () => {
    window.history.replaceState({}, '', '/google-sheets?status=success');
    api.getConfig.mockResolvedValue(baseConfig);
    const { result } = await setup();
    expect(api.getConfig).toHaveBeenCalled();
    expect(result.current.step).toBe('SELECT_FILE');
    expect(result.current.error).toBeNull();
    expect(window.location.search).toBe('');
  });

  it('?status=error&message= fija el error', async () => {
    window.history.replaceState({}, '', '/google-sheets?status=error&message=Acceso%20denegado');
    api.getConfig.mockResolvedValue({ ...baseConfig, connected: false });
    const { result } = await setup();
    expect(result.current.error).toBe('Acceso denegado');
    expect(result.current.step).toBe('CONNECT_ACCOUNT');
  });

  it('selectFile guarda y pasa a CONFIGURE', async () => {
    api.getConfig.mockResolvedValue(baseConfig);
    api.saveSheet.mockResolvedValue();
    const { result } = await setup();
    await act(async () => {
      await result.current.selectFile({ id: 'f1', name: 'Ventas' });
    });
    expect(api.saveSheet).toHaveBeenCalledWith('f1', 'Ventas');
    expect(result.current.step).toBe('CONFIGURE');
    expect(result.current.config?.file).toEqual({ id: 'f1', name: 'Ventas' });
  });

  it('activate sin reconocimiento propaga el 409 como error legible', async () => {
    api.getConfig.mockResolvedValue(withFile);
    api.activate.mockRejectedValue({
      response: {
        status: 409,
        data: { statusCode: 409, message: 'La hoja tiene más de 100 filas con datos.', error: 'Conflict' },
      },
    });
    const { result } = await setup();
    await act(async () => {
      await result.current.activate();
    });
    expect(result.current.error).toBe('La hoja tiene más de 100 filas con datos.');
    expect(result.current.step).toBe('CONFIGURE');
  });

  it('une mensajes en arreglo y usa un texto genérico sin mensaje', async () => {
    api.getConfig.mockResolvedValue(withFile);
    api.saveConfig.mockRejectedValueOnce({ response: { data: { message: ['a', 'b'] } } });
    const { result } = await setup();
    await act(async () => {
      await result.current.saveConfig({ storeId: 's', tabIds: [1], headerMapping: {} });
    });
    expect(result.current.error).toBe('a. b');
    api.syncNow.mockRejectedValueOnce(new Error('boom'));
    await act(async () => {
      await result.current.syncNow();
    });
    expect(result.current.error).toMatch(/inténtalo|intenta/i);
  });

  it('savePreview pasa a MAP_FIELDS y saveConfig a REVIEW con la revisión', async () => {
    api.getConfig.mockResolvedValue(withFile);
    api.preview.mockResolvedValue({ fields: [], tabs: [] });
    api.saveConfig.mockResolvedValue();
    const review = { dataRows: 1, orders: 1, valid: 1, withProblems: 0, overLimit: false, limit: 100, problems: [] };
    api.review.mockResolvedValue(review);
    const { result } = await setup();
    await act(async () => {
      await result.current.savePreview([1]);
    });
    expect(result.current.step).toBe('MAP_FIELDS');
    await act(async () => {
      await result.current.saveConfig({ storeId: 's', tabIds: [1], headerMapping: {} });
    });
    expect(result.current.step).toBe('REVIEW');
    expect(result.current.review).toEqual(review);
  });
});
