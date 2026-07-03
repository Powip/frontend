export type SetupStep = 'CONNECT_ACCOUNT' | 'SELECT_SHEET' | 'MAP_FIELDS' | 'READY';

export interface AuthUrlResponse {
  url: string;
}

/** Datos extraídos de las primeras filas del Google Sheet seleccionado. */
export interface SheetPreview {
  /** Primera fila del sheet (encabezados). */
  headers: string[];
  /** Filas 2-4 del sheet (datos de muestra para validación visual). */
  sampleRows: string[][];
}

export interface SyncStatusResponse {
  status: string;
  processed: number;
  errors: number;
}

/** Mapeo plano de campo → columna, usado en el estado del hook. */
export interface FieldMapping {
  [key: string]: string;
}

/** Payload completo que se envía al servicio al guardar el mapeo. */
export interface SaveMappingPayload {
  /** UUID del tenant — requerido por el backend para identificar la integración. */
  companyId: string;
  mapping: Record<string, string>;
  useExternalOrderNumber: boolean;
  /** UUID del store en ms-ventas donde se crearán los pedidos. */
  storeId?: string;
  /** Nombre de la hoja del spreadsheet a sincronizar. Null = primera hoja por defecto. */
  sheetName?: string;
}

export interface GoogleFile {
  id: string;
  name: string;
}

export interface GoogleSheetsState {
  currentStep: SetupStep;
  loading: boolean;
  error: string | null;
  authUrl: string | null;
  selectedFile: GoogleFile | null;
  mapping: FieldMapping;
  syncResult: SyncStatusResponse | null;
  /** Preview de encabezados y datos de muestra del sheet seleccionado. */
  sheetPreview: SheetPreview | null;
  /** Nombres de las hojas (tabs) disponibles en el spreadsheet seleccionado. */
  availableSheets: string[];
}
