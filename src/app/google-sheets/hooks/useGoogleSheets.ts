'use client';

import { useState, useEffect, useCallback } from 'react';
import { SetupStep, GoogleSheetsState, GoogleFile, SaveMappingPayload, SheetPreview } from '../types';
import { googleSheetsApi } from '../services/googleSheetsApi';

/**
 * Hook principal del wizard de Google Sheets.
 *
 * Flujo OAuth completo:
 * 1. connectAccount() → llama a /integrations/google/auth-url
 *    → redirige con window.location.href (full-page redirect a Google)
 * 2. Google hace callback al backend → backend redirige a /google-sheets?status=success
 * 3. useEffect detecta ?status=success en la URL → avanza al step SELECT_SHEET
 * 4. handleOpenPicker() → llama a /integrations/google/access-token → abre Google Picker
 */
export const useGoogleSheets = (companyId: string) => {
  const [state, setState] = useState<GoogleSheetsState>({
    currentStep: 'CONNECT_ACCOUNT',
    loading: false,
    error: null,
    authUrl: null,
    selectedFile: null,
    mapping: {},
    syncResult: null,
    sheetPreview: null,
    availableSheets: [],
  });

  const setStep = useCallback((step: SetupStep) => {
    setState((prev) => ({ ...prev, currentStep: step, error: null }));
  }, []);

  // ---------------------------------------------------------------------------
  // Detectar retorno del callback OAuth2 de Google
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const params = new URLSearchParams(window.location.search);
    const status = params.get('status');
    const message = params.get('message');

    if (status === 'success') {
      // Limpiar los query params de la URL sin recargar la página
      const cleanUrl = window.location.pathname;
      window.history.replaceState({}, '', cleanUrl);
      setStep('SELECT_SHEET');
    } else if (status === 'error') {
      const cleanUrl = window.location.pathname;
      window.history.replaceState({}, '', cleanUrl);
      setState((prev) => ({
        ...prev,
        error: message || 'Error al vincular la cuenta de Google.',
      }));
    }
  }, [setStep]);

  // ---------------------------------------------------------------------------
  // Verificar si ya está vinculado al cargar (para reanudar sesiones)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!companyId) return;

    const checkStatus = async () => {
      try {
        const { connected } = await googleSheetsApi.getStatus(companyId);
        if (connected) {
          // Si ya tiene token guardado y no venimos de un callback, ir a SELECT_SHEET
          const params = new URLSearchParams(window.location.search);
          if (!params.get('status')) {
            setStep('SELECT_SHEET');
          }
        }
      } catch {
        // Si falla la verificación, comenzar desde el paso inicial silenciosamente
      }
    };

    checkStatus();
  }, [companyId, setStep]);

  // ---------------------------------------------------------------------------
  // STEP 1 — Conectar cuenta Google
  // ---------------------------------------------------------------------------
  const connectAccount = useCallback(async () => {
    if (!companyId) {
      setState((prev) => ({
        ...prev,
        error: 'No se pudo identificar tu empresa. Intenta recargar la página.',
      }));
      return;
    }

    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const { url } = await googleSheetsApi.getAuthUrl(companyId);
      // Redirigir a Google para el consentimiento OAuth2.
      // No usamos window.open() porque Google bloquea popups para OAuth.
      window.location.href = url;
    } catch (error: any) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error:
          error?.response?.data?.message ||
          'Error al obtener la URL de autorización. Intenta de nuevo.',
      }));
    }
  }, [companyId]);

  // ---------------------------------------------------------------------------
  // STEP 2 — Seleccionar archivo en Google Drive (vía Google Picker)
  // ---------------------------------------------------------------------------
  const selectFile = useCallback(async (file: GoogleFile, preview: SheetPreview = { headers: [], sampleRows: [] }) => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      await googleSheetsApi.saveSelectedSheet(companyId, file.id, file.name);
      setState((prev) => ({ ...prev, selectedFile: file, sheetPreview: preview, loading: false }));
      setStep('MAP_FIELDS');
    } catch (error: any) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: 'Error al guardar la selección del archivo.',
      }));
    }
  }, [companyId, setStep]);

  // ---------------------------------------------------------------------------
  // Obtener access_token para el Google Picker
  // ---------------------------------------------------------------------------
  const getAccessToken = useCallback(async (): Promise<string> => {
    if (!companyId) throw new Error('companyId no disponible');
    return googleSheetsApi.getAccessToken(companyId);
  }, [companyId]);

  // ---------------------------------------------------------------------------
  // STEP 3 — Guardar mapeo de columnas
  // ---------------------------------------------------------------------------
  const saveMapping = useCallback(async (payload: Omit<SaveMappingPayload, 'companyId'>) => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      // Inyectar companyId en el payload antes de enviarlo al backend
      await googleSheetsApi.saveFieldMapping({ ...payload, companyId });
      setState((prev) => ({ ...prev, loading: false }));
      setStep('READY');
    } catch (error: any) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: 'Error al guardar el mapeo de columnas.',
      }));
    }
  }, [companyId, setStep]);

  // ---------------------------------------------------------------------------
  // Cargar nombres de hojas disponibles en el spreadsheet
  // ---------------------------------------------------------------------------
  const loadSheetNames = useCallback(async (spreadsheetId: string) => {
    if (!companyId || !spreadsheetId) return;
    try {
      const sheets = await googleSheetsApi.getSheetNames(companyId, spreadsheetId);
      setState((prev) => ({ ...prev, availableSheets: sheets }));
    } catch {
      // No bloqueante: si falla, el usuario opera con la primera hoja por defecto
      setState((prev) => ({ ...prev, availableSheets: [] }));
    }
  }, [companyId]);

  // ---------------------------------------------------------------------------
  // STEP 4 — Sincronización manual
  // ---------------------------------------------------------------------------
  const syncNow = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const result = await googleSheetsApi.triggerSync(companyId);
      setState((prev) => ({ ...prev, syncResult: result, loading: false }));
    } catch (error: any) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: 'Error al ejecutar la sincronización.',
      }));
    }
  }, [companyId]);

  return {
    ...state,
    setStep,
    connectAccount,
    selectFile,
    saveMapping,
    syncNow,
    getAccessToken,
    loadSheetNames,
  };
};
