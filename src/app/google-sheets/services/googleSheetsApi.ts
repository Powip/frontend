import axiosAuth from "@/lib/axiosAuth";
import { GATEWAY } from "@/lib/gateway";
import {
  AuthUrlResponse,
  SyncStatusResponse,
  SaveMappingPayload,
} from "../types";

const BASE = GATEWAY.integrations;

export const googleSheetsApi = {
  getAuthUrl: async (companyId: string): Promise<AuthUrlResponse> => {
    const response = await axiosAuth.get(
      `${BASE}/integrations/google/auth-url`,
      {
        params: { companyId },
      },
    );
    return response.data;
  },

  getAccessToken: async (companyId: string): Promise<string> => {
    const response = await axiosAuth.get(
      `${BASE}/integrations/google/access-token`,
      {
        params: { companyId },
      },
    );
    return response.data.accessToken;
  },

  getStatus: async (companyId: string): Promise<{ connected: boolean }> => {
    const response = await axiosAuth.get(`${BASE}/integrations/google/status`, {
      params: { companyId },
    });
    return response.data;
  },

  saveSelectedSheet: async (
    companyId: string,
    fileId: string,
    fileName: string,
  ): Promise<void> => {
    await axiosAuth.post(`${BASE}/google/save-sheet`, {
      companyId,
      fileId,
      fileName,
    });
  },

  saveFieldMapping: async (payload: SaveMappingPayload): Promise<void> => {
    await axiosAuth.post(`${BASE}/google/save-mapping`, payload);
  },

  getSheetNames: async (
    companyId: string,
    spreadsheetId: string,
  ): Promise<string[]> => {
    const response = await axiosAuth.get(
      `${BASE}/google/spreadsheets/${spreadsheetId}/sheets`,
      { params: { companyId } },
    );
    return response.data.sheets as string[];
  },

  triggerSync: async (companyId: string): Promise<SyncStatusResponse> => {
    const response = await axiosAuth.post(`${BASE}/google/sync`, { companyId });
    return response.data;
  },
};
