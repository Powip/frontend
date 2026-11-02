'use client';

import { useCallback, useEffect, useState } from 'react';
import { FileSpreadsheet, RefreshCw, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { GoogleFile } from '../../types';

declare global {
  interface Window {
    gapi: any;
    google: any;
  }
}

const GAPI_SRC = 'https://apis.google.com/js/api.js';

export const FILE_WARNING =
  'Deja en la hoja solo las ventas que quieres cargar ahora. No subas tu historial.';
export const MISSING_API_KEY_NOTICE =
  'Falta configurar la clave de Google (NEXT_PUBLIC_GOOGLE_API_KEY). No se puede abrir el selector de archivos hasta que se configure.';

interface Props {
  loading: boolean;
  getAccessToken: () => Promise<string>;
  onSelectFile: (file: GoogleFile) => void;
}

export function StepFile({ loading, getAccessToken, onSelectFile }: Props) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_API_KEY;
  const [pickerReady, setPickerReady] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  // Carga gapi + módulo picker solo si hay clave.
  useEffect(() => {
    if (!apiKey) return;
    const loadPicker = () => window.gapi.load('picker', { callback: () => setPickerReady(true) });
    if (window.gapi) {
      loadPicker();
      return;
    }
    const script = document.createElement('script');
    script.src = GAPI_SRC;
    script.async = true;
    script.onload = loadPicker;
    document.body.appendChild(script);
  }, [apiKey]);

  const openPicker = useCallback(async () => {
    if (!apiKey) return;
    setLocalError(null);
    if (!pickerReady) {
      setLocalError('La librería de Google aún se está cargando. Inténtalo en unos segundos.');
      return;
    }
    try {
      const token = await getAccessToken();
      const view = new window.google.picker.DocsView(window.google.picker.ViewId.SPREADSHEETS);
      view.setMode(window.google.picker.DocsViewMode.GRID);
      const picker = new window.google.picker.PickerBuilder()
        .addView(view)
        .setOAuthToken(token)
        .setDeveloperKey(apiKey)
        .setCallback((data: any) => {
          if (data.action === window.google.picker.Action.PICKED) {
            const doc = data.docs[0];
            onSelectFile({ id: doc.id, name: doc.name });
          }
        })
        .setTitle('Selecciona tu hoja de cálculo de pedidos')
        .build();
      picker.setVisible(true);
    } catch {
      setLocalError('No se pudo obtener el acceso a Google Drive. Inténtalo de nuevo.');
    }
  }, [apiKey, pickerReady, getAccessToken, onSelectFile]);

  return (
    <>
      <CardHeader>
        <CardTitle>Seleccionar hoja de cálculo</CardTitle>
        <CardDescription>
          Busca y selecciona el archivo con tus pedidos en Google Drive.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 py-6">
        <p role="note" className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          {FILE_WARNING}
        </p>
        {!apiKey && (
          <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {MISSING_API_KEY_NOTICE}
          </p>
        )}
        {localError && (
          <p role="alert" className="text-sm text-destructive">
            {localError}
          </p>
        )}
        <div className="flex flex-col items-center rounded-xl border-2 border-dashed bg-muted/30 p-10">
          <FileSpreadsheet className="mb-4 h-10 w-10 text-green-600" />
          <Button onClick={openPicker} disabled={loading || !apiKey} className="gap-2">
            {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Seleccionar archivo en Google Drive
          </Button>
        </div>
      </CardContent>
    </>
  );
}
