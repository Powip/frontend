import { StrictMode } from 'react';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useGoogleSheets } from '../useGoogleSheets';
import { googleSheetsApi } from '../../services/googleSheetsApi';
import type { GoogleConfigView } from '../../types';

jest.mock('../../services/googleSheetsApi', () => ({
  googleSheetsApi: {
    getConfig: jest.fn(),
    getAuthUrl: jest.fn(),
    connect: jest.fn(),
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

  describe('retorno de Google: confirma la vinculación con la sesión (I3)', () => {
    const FRAGMENT = '#code=4%2Fabc&state=payload.firma';

    it('lee code y state del fragmento, los saca de la URL y confirma con connect', async () => {
      window.history.replaceState({}, '', `/google-sheets${FRAGMENT}`);
      api.connect.mockResolvedValue();
      api.getConfig.mockResolvedValue(baseConfig);
      const { result } = await setup();
      expect(api.connect).toHaveBeenCalledTimes(1);
      expect(api.connect).toHaveBeenCalledWith('4/abc', 'payload.firma');
      expect(window.location.hash).toBe('');
      expect(result.current.error).toBeNull();
      expect(result.current.step).toBe('SELECT_FILE');
    });

    it('confirma ANTES de consultar la config, para que ya aparezca conectada', async () => {
      window.history.replaceState({}, '', `/google-sheets${FRAGMENT}`);
      api.connect.mockResolvedValue();
      api.getConfig.mockResolvedValue(baseConfig);
      await setup();
      expect(api.connect.mock.invocationCallOrder[0]).toBeLessThan(
        api.getConfig.mock.invocationCallOrder[0],
      );
    });

    it('si el servidor rechaza la confirmación (403) muestra su mensaje y no deja el code en la URL', async () => {
      window.history.replaceState({}, '', `/google-sheets${FRAGMENT}`);
      api.connect.mockRejectedValue({
        response: { data: { message: 'Este enlace fue iniciado desde otra sesión.' } },
      });
      api.getConfig.mockResolvedValue({ ...baseConfig, connected: false });
      const { result } = await setup();
      expect(result.current.error).toBe('Este enlace fue iniciado desde otra sesión.');
      expect(result.current.step).toBe('CONNECT_ACCOUNT');
      expect(window.location.hash).toBe('');
    });

    it('si falla sin mensaje usa el texto genérico', async () => {
      window.history.replaceState({}, '', `/google-sheets${FRAGMENT}`);
      api.connect.mockRejectedValue(new Error('network'));
      api.getConfig.mockResolvedValue({ ...baseConfig, connected: false });
      const { result } = await setup();
      expect(result.current.error).toMatch(/algo salió mal/i);
    });

    it('sin fragmento no llama a connect', async () => {
      api.getConfig.mockResolvedValue(baseConfig);
      await setup();
      expect(api.connect).not.toHaveBeenCalled();
    });

    it('un fragmento ajeno (sin code y state) no llama a connect y no se toca', async () => {
      window.history.replaceState({}, '', '/google-sheets#otra-seccion');
      api.getConfig.mockResolvedValue(baseConfig);
      await setup();
      expect(api.connect).not.toHaveBeenCalled();
      expect(window.location.hash).toBe('#otra-seccion');
    });

    it('en StrictMode (el efecto corre dos veces) confirma una sola vez y muestra el resultado', async () => {
      window.history.replaceState({}, '', `/google-sheets${FRAGMENT}`);
      api.connect.mockResolvedValue();
      api.getConfig.mockResolvedValue(baseConfig);
      const hook = renderHook(() => useGoogleSheets(), { wrapper: StrictMode });
      await waitFor(() => expect(hook.result.current.loading).toBe(false));
      expect(api.connect).toHaveBeenCalledTimes(1);
      expect(hook.result.current.step).toBe('SELECT_FILE');
      expect(hook.result.current.error).toBeNull();
    });

    it('en StrictMode el rechazo también llega a la pantalla', async () => {
      window.history.replaceState({}, '', `/google-sheets${FRAGMENT}`);
      api.connect.mockRejectedValue({ response: { data: { message: 'Enlace de otra sesión.' } } });
      api.getConfig.mockResolvedValue({ ...baseConfig, connected: false });
      const hook = renderHook(() => useGoogleSheets(), { wrapper: StrictMode });
      await waitFor(() => expect(hook.result.current.loading).toBe(false));
      expect(hook.result.current.error).toBe('Enlace de otra sesión.');
    });
  });

  it('selectFile guarda y pasa a CONFIGURE', async () => {
    api.getConfig.mockResolvedValueOnce(baseConfig).mockResolvedValue(withFile);
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
    const review = {
      dataRows: 1,
      orders: 1,
      valid: 1,
      withProblems: 0,
      overLimit: false,
      limit: 100,
      reactivation: false,
      newTabs: [],
      problems: [],
    };
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

  it('cambiar de archivo en READY vuelve a CONFIGURE según el servidor', async () => {
    api.getConfig
      .mockResolvedValueOnce({ ...withFile, status: 'READY' })
      .mockResolvedValue({ ...baseConfig, file: { id: 'f2', name: 'Otra' } });
    api.saveSheet.mockResolvedValue();
    const { result } = await setup();
    expect(result.current.step).toBe('STATUS');
    await act(async () => {
      await result.current.selectFile({ id: 'f2', name: 'Otra' });
    });
    expect(result.current.step).toBe('CONFIGURE');
  });

  describe('cambiar archivo (I4)', () => {
    it('desde STATUS abre el selector y cancelar vuelve a STATUS', async () => {
      api.getConfig.mockResolvedValue({ ...withFile, status: 'READY' });
      const { result } = await setup();
      act(() => result.current.changeFile());
      expect(result.current.step).toBe('SELECT_FILE');
      expect(result.current.changingFile).toBe(true);
      act(() => result.current.cancelChangeFile());
      expect(result.current.step).toBe('STATUS');
    });

    it('desde CONFIGURE (también reconfigurando) abre el selector', async () => {
      api.getConfig.mockResolvedValue({ ...withFile, status: 'READY' });
      const { result } = await setup();
      act(() => result.current.reconfigure());
      expect(result.current.step).toBe('CONFIGURE');
      act(() => result.current.changeFile());
      expect(result.current.step).toBe('SELECT_FILE');
    });

    it('al elegir otro archivo llama a save-sheet, refresca y queda en CONFIGURE', async () => {
      api.getConfig
        .mockResolvedValueOnce({ ...withFile, status: 'READY' })
        .mockResolvedValue({ ...baseConfig, file: { id: 'f2', name: 'Otra' } });
      api.saveSheet.mockResolvedValue();
      const { result } = await setup();
      act(() => result.current.changeFile());
      await act(async () => {
        await result.current.selectFile({ id: 'f2', name: 'Otra' });
      });
      expect(api.saveSheet).toHaveBeenCalledWith('f2', 'Otra');
      expect(result.current.changingFile).toBe(false);
      expect(result.current.step).toBe('CONFIGURE');
      expect(result.current.config?.file).toEqual({ id: 'f2', name: 'Otra' });
    });

    it('con una sincronización en curso muestra el 409 y sigue en el selector', async () => {
      api.getConfig.mockResolvedValue({ ...withFile, status: 'READY' });
      api.saveSheet.mockRejectedValue({
        response: {
          status: 409,
          data: { message: 'Hay una sincronización en curso; espera a que termine e inténtalo de nuevo' },
        },
      });
      const { result } = await setup();
      act(() => result.current.changeFile());
      await act(async () => {
        await result.current.selectFile({ id: 'f2', name: 'Otra' });
      });
      expect(result.current.error).toBe(
        'Hay una sincronización en curso; espera a que termine e inténtalo de nuevo',
      );
      expect(result.current.step).toBe('SELECT_FILE');
    });
  });

  describe('activate dispara la primera sincronización (M2)', () => {
    it('después de activar llama a syncNow', async () => {
      api.getConfig.mockResolvedValue(withFile);
      api.activate.mockResolvedValue(undefined as never);
      api.syncNow.mockResolvedValue({ started: true });
      const { result } = await setup();
      api.getConfig.mockResolvedValue({ ...withFile, status: 'READY' });
      await act(async () => {
        await result.current.activate(false);
      });
      expect(api.activate).toHaveBeenCalledWith(false);
      expect(api.syncNow).toHaveBeenCalledTimes(1);
      expect(api.activate.mock.invocationCallOrder[0]).toBeLessThan(
        api.syncNow.mock.invocationCallOrder[0],
      );
      expect(result.current.step).toBe('STATUS');
      expect(result.current.error).toBeNull();
    });

    it('un 409 de syncNow se ignora en silencio', async () => {
      api.getConfig.mockResolvedValue(withFile);
      api.activate.mockResolvedValue(undefined as never);
      api.syncNow.mockRejectedValue({ response: { status: 409, data: { message: 'en curso' } } });
      const { result } = await setup();
      api.getConfig.mockResolvedValue({ ...withFile, status: 'READY' });
      await act(async () => {
        await result.current.activate(false);
      });
      expect(result.current.error).toBeNull();
      expect(result.current.step).toBe('STATUS');
    });

    it('si activate falla no llama a syncNow', async () => {
      api.getConfig.mockResolvedValue(withFile);
      api.activate.mockRejectedValue({ response: { status: 409, data: { message: 'más de 100 filas' } } });
      const { result } = await setup();
      await act(async () => {
        await result.current.activate(false);
      });
      expect(api.syncNow).not.toHaveBeenCalled();
    });
  });

  it('el polling sigue tras una consulta fallida mientras corre la sync', async () => {
    jest.useFakeTimers();
    try {
      const running = { ...withFile, status: 'READY' as const, running: true };
      api.getConfig
        .mockResolvedValueOnce(running)
        .mockRejectedValueOnce(new Error('red'))
        .mockResolvedValueOnce(running)
        .mockResolvedValue({ ...running, running: false });
      const { result } = renderHook(() => useGoogleSheets());
      await act(async () => {});
      expect(api.getConfig).toHaveBeenCalledTimes(1);
      await act(async () => {
        await jest.advanceTimersByTimeAsync(3000);
      });
      expect(api.getConfig).toHaveBeenCalledTimes(2);
      expect(result.current.error).toBeTruthy();
      await act(async () => {
        await jest.advanceTimersByTimeAsync(3000);
      });
      expect(api.getConfig).toHaveBeenCalledTimes(3);
      await act(async () => {
        await jest.advanceTimersByTimeAsync(3000);
      });
      expect(api.getConfig).toHaveBeenCalledTimes(4);
      expect(result.current.config?.running).toBe(false);
    } finally {
      jest.useRealTimers();
    }
  });

  describe('reconfigurar desde READY', () => {
    const ready = { ...withFile, status: 'READY' as const };

    it('reconfigure lleva a CONFIGURE y cancelReconfigure vuelve a STATUS', async () => {
      api.getConfig.mockResolvedValue(ready);
      const { result } = await setup();
      act(() => result.current.reconfigure());
      expect(result.current.step).toBe('CONFIGURE');
      expect(result.current.reconfiguring).toBe(true);
      act(() => result.current.cancelReconfigure());
      expect(result.current.step).toBe('STATUS');
      expect(result.current.reconfiguring).toBe(false);
    });

    it('al guardar, el servidor pasa a NEEDS_SETUP y se limpia la marca', async () => {
      api.getConfig.mockResolvedValue(ready);
      api.saveConfig.mockResolvedValue(undefined as never);
      api.review.mockResolvedValue({} as never);
      const { result } = await setup();
      act(() => result.current.reconfigure());
      api.getConfig.mockResolvedValue({ ...withFile, status: 'NEEDS_SETUP' });
      await act(async () => {
        await result.current.saveConfig({ storeId: 's1', tabIds: [1], headerMapping: {} });
      });
      expect(result.current.reconfiguring).toBe(false);
      expect(result.current.step).toBe('REVIEW');
    });

    it('si el servidor no está en READY ignora la marca', async () => {
      api.getConfig.mockResolvedValue(ready);
      const { result } = await setup();
      act(() => result.current.reconfigure());
      api.getConfig.mockResolvedValue({ ...withFile, status: 'NEEDS_RECONNECT' });
      await act(async () => {
        await result.current.refresh();
      });
      expect(result.current.reconfiguring).toBe(false);
      expect(result.current.step).toBe('CONNECT_ACCOUNT');
    });

    it('si review falla tras guardar, activar con el servidor READY termina en STATUS sin marca', async () => {
      api.getConfig.mockResolvedValue(ready);
      api.saveConfig.mockResolvedValue(undefined as never);
      api.review.mockRejectedValue(new Error('boom'));
      api.activate.mockResolvedValue(undefined as never);
      const { result } = await setup();
      act(() => result.current.reconfigure());
      await act(async () => {
        await result.current.saveConfig({ storeId: 's1', tabIds: [1], headerMapping: {} });
      });
      await act(async () => {
        await result.current.activate(true);
      });
      expect(result.current.reconfiguring).toBe(false);
      expect(result.current.step).toBe('STATUS');
    });

    it('si la consulta falla tras guardar, sigue en el flujo de configuración', async () => {
      api.getConfig.mockResolvedValue(ready);
      api.saveConfig.mockResolvedValue(undefined as never);
      api.review.mockResolvedValue({} as never);
      const { result } = await setup();
      act(() => result.current.reconfigure());
      api.getConfig.mockRejectedValue(new Error('boom'));
      await act(async () => {
        await result.current.saveConfig({ storeId: 's1', tabIds: [1], headerMapping: {} });
      });
      expect(result.current.step).toBe('REVIEW');
    });

    it('disconnect limpia la marca', async () => {
      api.getConfig.mockResolvedValue(ready);
      api.disconnect.mockResolvedValue(undefined as never);
      const { result } = await setup();
      act(() => result.current.reconfigure());
      api.getConfig.mockResolvedValue({ ...baseConfig, connected: false });
      await act(async () => {
        await result.current.disconnect();
      });
      expect(result.current.reconfiguring).toBe(false);
    });
  });
});
