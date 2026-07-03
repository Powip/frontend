import axios from 'axios';
import { AuthUrlResponse, SyncStatusResponse, SaveMappingPayload } from '../types';

/**
 * Cliente HTTP para el microservicio ms-integrations.
 * Envía automáticamente el JWT de Powip en cada request.
 */
const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_INTEGRATIONS || 'http://localhost:3007',
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Interceptor: adjunta el access token JWT de Powip al header Authorization.
 * El token se lee de localStorage (clave 'accessToken'), que es donde
 * el flujo de login de Powip lo almacena actualmente.
 */
apiClient.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// ---------------------------------------------------------------------------
// API de Google Sheets / Google OAuth2
// ---------------------------------------------------------------------------

export const googleSheetsApi = {
  /**
   * Solicita al backend la URL de autorización de Google OAuth2.
   * El companyId identifica al tenant; el backend lo embebe en el `state`.
   */
  getAuthUrl: async (companyId: string): Promise<AuthUrlResponse> => {
    const response = await apiClient.get('/integrations/google/auth-url', {
      params: { companyId },
    });
    return response.data; // { url: "https://accounts.google.com/o/oauth2/auth?..." }
  },

  /**
   * Solicita al backend un access_token fresco usando el refresh_token guardado.
   * El token se usa para inicializar el Google Picker nativo.
   */
  getAccessToken: async (companyId: string): Promise<string> => {
    const response = await apiClient.get('/integrations/google/access-token', {
      params: { companyId },
    });
    return response.data.accessToken;
  },

  /**
   * Verifica si la compañía ya tiene Google vinculado.
   * Útil para decidir en qué step del wizard iniciar.
   */
  getStatus: async (companyId: string): Promise<{ connected: boolean }> => {
    const response = await apiClient.get('/integrations/google/status', {
      params: { companyId },
    });
    return response.data;
  },

  /**
   * Persiste el archivo de Google Sheets seleccionado por el usuario.
   * Se llama inmediatamente después de que el Google Picker devuelve el fileId.
   *
   * @param companyId UUID del tenant (viene del hook)
   * @param fileId    ID del archivo en Google Drive
   * @param fileName  Nombre del archivo para display
   */
  saveSelectedSheet: async (
    companyId: string,
    fileId: string,
    fileName: string,
  ): Promise<void> => {
    await apiClient.post('/integrations/google/save-sheet', {
      companyId,
      fileId,
      fileName,
    });
  },

  /**
   * Persiste el mapeo de columnas configurado por el usuario en el Paso 3.
   *
   * @param payload Incluye companyId, mapping, useExternalOrderNumber y storeId opcional
   */
  saveFieldMapping: async (payload: SaveMappingPayload): Promise<void> => {
    await apiClient.post('/integrations/google/save-mapping', payload);
  },

  /**
   * Retorna los nombres de todas las hojas (tabs) de un spreadsheet.
   * El backend usa las credenciales guardadas del tenant — no requiere token extra.
   *
   * @param companyId     UUID del tenant
   * @param spreadsheetId ID del archivo en Google Drive
   */
  getSheetNames: async (companyId: string, spreadsheetId: string): Promise<string[]> => {
    const response = await apiClient.get(
      `/integrations/google/spreadsheets/${spreadsheetId}/sheets`,
      { params: { companyId } },
    );
    return response.data.sheets as string[];
  },

  /**
   * Dispara una sincronización manual de pedidos desde Google Sheets.
   * Llama al endpoint real en ms-integrations.
   *
   * @param companyId UUID del tenant
   */
  triggerSync: async (companyId: string): Promise<SyncStatusResponse> => {
    const response = await apiClient.post('/integrations/google/sync', { companyId });
    return response.data;
  },
};
