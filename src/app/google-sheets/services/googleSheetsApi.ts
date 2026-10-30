import axiosAuth from '@/lib/axiosAuth';
import type {
  ActivateResponse,
  AuthUrlResponse,
  GoogleConfigView,
  GoogleTab,
  PreviewResponse,
  ReviewResult,
  SaveConfigPayload,
  SyncIssue,
} from '../types';

const API_INTEGRATIONS = process.env.NEXT_PUBLIC_API_INTEGRATIONS || 'http://localhost:3007';
const BASE = `${API_INTEGRATIONS}/integrations/google`;

/**
 * Cliente de ms-integrations para Google Sheets. La empresa sale del token
 * en el backend: ninguna llamada envía companyId.
 */
export const googleSheetsApi = {
  getConfig: async (): Promise<GoogleConfigView> =>
    (await axiosAuth.get<GoogleConfigView>(`${BASE}/config`)).data,

  getAuthUrl: async (): Promise<AuthUrlResponse> =>
    (await axiosAuth.get<AuthUrlResponse>(`${BASE}/auth-url`)).data,

  /** Token corto de Google para el Picker. */
  getAccessToken: async (): Promise<string> =>
    (await axiosAuth.get<{ accessToken: string }>(`${BASE}/access-token`)).data.accessToken,

  saveSheet: async (fileId: string, fileName: string): Promise<void> => {
    await axiosAuth.post(`${BASE}/save-sheet`, { fileId, fileName });
  },

  getTabs: async (spreadsheetId: string): Promise<GoogleTab[]> =>
    (
      await axiosAuth.get<{ tabs: GoogleTab[] }>(
        `${BASE}/spreadsheets/${encodeURIComponent(spreadsheetId)}/tabs`,
      )
    ).data.tabs,

  preview: async (tabIds: number[]): Promise<PreviewResponse> =>
    (await axiosAuth.post<PreviewResponse>(`${BASE}/preview`, { tabIds })).data,

  saveConfig: async (payload: SaveConfigPayload): Promise<void> => {
    await axiosAuth.post(`${BASE}/save-config`, payload);
  },

  review: async (): Promise<ReviewResult> =>
    (await axiosAuth.post<ReviewResult>(`${BASE}/review`)).data,

  activate: async (acknowledgeHistory = false): Promise<ActivateResponse> =>
    (await axiosAuth.post<ActivateResponse>(`${BASE}/activate`, { acknowledgeHistory })).data,

  /** 202: la sincronización corre en segundo plano; se consulta con getConfig. */
  syncNow: async (): Promise<{ started: true }> =>
    (await axiosAuth.post<{ started: true }>(`${BASE}/sync`)).data,

  getIssues: async (): Promise<SyncIssue[]> =>
    (await axiosAuth.get<{ issues: SyncIssue[] }>(`${BASE}/issues`)).data.issues,

  disconnect: async (): Promise<void> => {
    await axiosAuth.post(`${BASE}/disconnect`);
  },
};
