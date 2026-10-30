'use client';

import { useCallback, useEffect, useState } from 'react';
import { googleSheetsApi } from '../services/googleSheetsApi';
import type {
  GoogleConfigView,
  GoogleFile,
  PreviewResponse,
  ReviewResult,
  SaveConfigPayload,
  SetupStep,
  SyncIssue,
} from '../types';

const GENERIC_ERROR = 'Algo salió mal. Inténtalo de nuevo en unos minutos.';
const RECONNECT_MESSAGE =
  'Tu conexión con Google venció o fue revocada. Reconecta tu cuenta para continuar.';
const OAUTH_ERROR = 'Error al vincular la cuenta de Google.';
const POLL_MS = 3000;

/** Convierte un error de axios/Nest en un mensaje legible en español. */
function toMessage(error: unknown): string {
  const message = (error as { response?: { data?: { message?: unknown } } })?.response?.data
    ?.message;
  if (Array.isArray(message)) {
    const joined = message.filter((m) => typeof m === 'string' && m).join('. ');
    if (joined) return joined;
  } else if (typeof message === 'string' && message) {
    return message;
  }
  return GENERIC_ERROR;
}

/** Paso de pantalla derivado del estado del servidor. */
function baseStep(
  config: GoogleConfigView | null,
  reconfiguring: boolean,
  changingFile: boolean,
): SetupStep {
  if (!config || !config.connected || config.status === 'NEEDS_RECONNECT') {
    return 'CONNECT_ACCOUNT';
  }
  if (!config.file || changingFile) return 'SELECT_FILE';
  if (config.status !== 'READY') return 'CONFIGURE';
  return reconfiguring ? 'CONFIGURE' : 'STATUS';
}

/**
 * Hook del asistente de Google Sheets. El paso sale del estado del servidor
 * (config); solo MAP_FIELDS y REVIEW son locales, dentro de NEEDS_SETUP.
 */
export const useGoogleSheets = () => {
  const [config, setConfig] = useState<GoogleConfigView | null>(null);
  const [localStep, setLocalStep] = useState<'MAP_FIELDS' | 'REVIEW' | null>(null);
  const [reconfiguring, setReconfiguring] = useState(false);
  /** "Cambiar archivo": vuelve al selector sin tocar el servidor hasta elegir otro. */
  const [changingFile, setChangingFile] = useState(false);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [review, setReview] = useState<ReviewResult | null>(null);
  const [issues, setIssues] = useState<SyncIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const next = await googleSheetsApi.getConfig();
      setConfig(next);
      // La marca solo vale mientras el servidor sigue en READY.
      if (next.status !== 'READY') setReconfiguring(false);
      if (next.status === 'NEEDS_RECONNECT') {
        setError(next.lastError || RECONNECT_MESSAGE);
      }
      if (next.status === 'READY') {
        setIssues(await googleSheetsApi.getIssues().catch(() => []));
      }
    } catch (e) {
      setError(toMessage(e));
    }
  }, []);

  // Carga inicial y retorno del callback OAuth (?status=success|error).
  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams(window.location.search);
    const status = params.get('status');
    const message = params.get('message');
    if (status) window.history.replaceState({}, '', window.location.pathname);

    (async () => {
      await refresh();
      if (cancelled) return;
      if (status === 'error') setError(message || OAUTH_ERROR);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  // Mientras corre una sincronización, se vuelve a consultar la config.
  // pollTick re-arma el temporizador aunque una consulta falle.
  const running = config?.running === true;
  const [pollTick, setPollTick] = useState(0);
  useEffect(() => {
    if (!running) return;
    const timer = setTimeout(async () => {
      await refresh();
      setPollTick((t) => t + 1);
    }, POLL_MS);
    return () => clearTimeout(timer);
  }, [running, pollTick, refresh]);

  /** Ejecuta una acción mostrando loading y traduciendo errores. */
  const run = useCallback(async <T,>(action: () => Promise<T>): Promise<T | undefined> => {
    setLoading(true);
    setError(null);
    try {
      return await action();
    } catch (e) {
      setError(toMessage(e));
      return undefined;
    } finally {
      setLoading(false);
    }
  }, []);

  const connectAccount = useCallback(
    () =>
      run(async () => {
        const { url } = await googleSheetsApi.getAuthUrl();
        window.location.href = url;
      }),
    [run],
  );

  const selectFile = useCallback(
    (file: GoogleFile) =>
      run(async () => {
        // Con una sincronización en curso el servidor responde 409: se muestra y se sigue en el selector.
        await googleSheetsApi.saveSheet(file.id, file.name);
        setLocalStep(null);
        setChangingFile(false);
        setReconfiguring(false);
        // Al cambiar de archivo el servidor reinicia el estado: manda el servidor.
        await refresh();
      }),
    [run, refresh],
  );

  const goConfigure = useCallback(() => setLocalStep(null), []);

  /** Abre el selector de archivos (desde CONFIGURE o STATUS). */
  const changeFile = useCallback(() => {
    setLocalStep(null);
    setError(null);
    setChangingFile(true);
  }, []);

  /** Vuelve de "Cambiar archivo" sin elegir otro. */
  const cancelChangeFile = useCallback(() => setChangingFile(false), []);

  /** Desde STATUS (READY): abre la configuración sin cambiar el estado del servidor. */
  const reconfigure = useCallback(() => {
    setLocalStep(null);
    setReconfiguring(true);
  }, []);

  /** Vuelve a STATUS: la integración sigue READY. */
  const cancelReconfigure = useCallback(() => {
    setLocalStep(null);
    setReconfiguring(false);
  }, []);

  const savePreview = useCallback(
    (tabIds: number[]) =>
      run(async () => {
        setPreview(await googleSheetsApi.preview(tabIds));
        setLocalStep('MAP_FIELDS');
      }),
    [run],
  );

  const saveConfig = useCallback(
    (payload: SaveConfigPayload) =>
      run(async () => {
        await googleSheetsApi.saveConfig(payload);
        setReview(await googleSheetsApi.review());
        setLocalStep('REVIEW');
        await refresh();
      }),
    [run, refresh],
  );

  const activate = useCallback(
    (acknowledgeHistory = false) =>
      run(async () => {
        await googleSheetsApi.activate(acknowledgeHistory);
        setLocalStep(null);
        setReconfiguring(false);
        // La primera importación no espera al cron (hasta 15 min). Un 409 (ya hay una
        // corrida en curso) se ignora; cualquier otro error se muestra.
        try {
          await googleSheetsApi.syncNow();
        } catch (e) {
          if ((e as { response?: { status?: number } })?.response?.status !== 409) {
            setError(toMessage(e));
          }
        }
        await refresh();
      }),
    [run, refresh],
  );

  const syncNow = useCallback(
    () =>
      run(async () => {
        await googleSheetsApi.syncNow();
        await refresh();
      }),
    [run, refresh],
  );

  const disconnect = useCallback(
    () =>
      run(async () => {
        await googleSheetsApi.disconnect();
        setLocalStep(null);
        setReconfiguring(false);
        setChangingFile(false);
        setPreview(null);
        setReview(null);
        setIssues([]);
        await refresh();
      }),
    [run, refresh],
  );

  const getAccessToken = useCallback(() => googleSheetsApi.getAccessToken(), []);

  const isReconfiguring = reconfiguring && config?.status === 'READY';
  const isChangingFile = changingFile && !!config?.file;
  const base = baseStep(config, isReconfiguring, isChangingFile);
  const step: SetupStep = base === 'CONFIGURE' && localStep ? localStep : base;

  return {
    step,
    config,
    preview,
    review,
    issues,
    loading,
    error,
    connectAccount,
    selectFile,
    goConfigure,
    reconfigure,
    cancelReconfigure,
    reconfiguring: isReconfiguring,
    changingFile: isChangingFile,
    changeFile,
    cancelChangeFile,
    savePreview,
    saveConfig,
    activate,
    syncNow,
    disconnect,
    refresh,
    getAccessToken,
  };
};
