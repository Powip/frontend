'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Script from 'next/script';
import { useGoogleSheets } from '../hooks/useGoogleSheets';
import { useAuth } from '@/contexts/AuthContext';
import { SetupStep, SheetPreview, SaveMappingPayload } from '../types';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  AlertCircle,
  CheckCircle2,
  FileSpreadsheet,
  Link2,
  RefreshCw,
  Search,
  Wand2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// Declaración global para evitar errores de TS con las librerías de Google
declare global {
  interface Window {
    gapi: any;
    google: any;
  }
}

const STEPS: { label: string; value: SetupStep }[] = [
  { label: 'Conectar', value: 'CONNECT_ACCOUNT' },
  { label: 'Seleccionar', value: 'SELECT_SHEET' },
  { label: 'Mapear', value: 'MAP_FIELDS' },
  { label: 'Listo', value: 'READY' },
];

/** Columnas A-Z generadas dinámicamente. */
const COLUMNS = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i));

/** Campos requeridos reales de Powip para el mapeo de columnas. */
const REQUIRED_FIELDS: { key: string; label: string }[] = [
  { key: 'customer_name',   label: 'Nombre cliente' },
  { key: 'document_number', label: 'DNI / RUC Cliente' },
  { key: 'phone',           label: 'Teléfono' },
  { key: 'district',        label: 'Distrito' },
  { key: 'city',            label: 'Ciudad' },
  { key: 'province',        label: 'Provincia' },
  { key: 'address',         label: 'Dirección' },
  { key: 'sale_type',       label: 'Tipo Venta' },
  { key: 'receipt_type',    label: 'Comprobante' },
  { key: 'total_amount',    label: 'Total Venta' },
  { key: 'advance_payment', label: 'Adelanto' },
  { key: 'closing_channel', label: 'Canal Cierre' },
  { key: 'sales_channel',   label: 'Canal Venta' },
  { key: 'seller_name',     label: 'Vendedor' },
  { key: 'delivery_type',   label: 'Tipo Entrega' },
  { key: 'product_name',    label: 'Nombre producto' },
  { key: 'quantity',        label: 'Cantidad' },
  { key: 'unit_price',      label: 'Precio Unitario' },
  { key: 'payment_method',  label: 'Método de pago' },
];

/** Campos opcionales para pedidos programados/reprogramados (no bloquean la validación). */
const OPTIONAL_FIELDS: { key: string; label: string }[] = [
  { key: 'sale_status',   label: 'Estado de la Venta' },
  { key: 'delivery_date', label: 'Fecha de Entrega' },
];

/**
 * Diccionario de palabras clave para el Smart Mapping automático.
 * Se compara contra los encabezados del sheet normalizados (sin tildes, lowercase).
 */
const SMART_MAPPING_DICT: Record<string, string[]> = {
  // Ignoramos dni/ruc en el nombre para evitar falsos positivos
  customer_name:   ['cliente', 'nombre', 'comprador', 'destinatario', 'receptor'],
  document_number: ['dni', 'ruc', 'documento', 'identificacion', 'id cliente', 'nro doc'],
  phone:           ['telefono', 'celular', 'whatsapp', 'movil', 'tel'],
  district:        ['distrito', 'barrio'],
  city:            ['ciudad', 'localidad'],
  province:        ['provincia', 'region', 'departamento'],
  address:         ['direccion', 'domicilio', 'calle'],
  sale_type:       ['tipo venta', 'tipo de venta'],
  receipt_type:    ['comprobante', 'factura', 'boleta'],
  total_amount:    ['total', 'monto', 'importe'],
  closing_channel:   ['canal cierre', 'cierre'],
  sales_channel:     ['canal venta', 'canal de venta'],
  delivery_type:     ['entrega', 'tipo entrega', 'envio', 'despacho'],
  seller_name:       ['vendedor', 'asesor', 'comercial', 'user'],
  advance_payment:   ['adelanto', 'seña', 'anticipo', 'pago a cuenta'],
  product_name:      ['items', 'item', 'producto', 'articulo', 'nombre producto'],
  external_order_id: ['id', 'pedido', 'orden', 'nro'],
  quantity:          ['cantidad', 'cant', 'qty'],
  unit_price:        ['precio unit', 'p unitario', 'unit price', 'unitario'],
  payment_method:    ['pago', 'metodo pago', 'forma pago', 'medio pago'],
  sale_status:       ['estado', 'estado venta', 'estado pedido', 'estado de venta', 'status', 'condicion'],
  delivery_date:     ['fecha entrega', 'fecha de entrega', 'fecha reprogramada', 'fecha programada', 'fecha despacho'],
};

/**
 * Llama a la Google Sheets API directamente desde el frontend usando el
 * access_token del usuario para obtener encabezados y datos de muestra.
 */
async function fetchSheetPreview(
  fileId: string,
  accessToken: string,
): Promise<SheetPreview> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${fileId}/values/A1:Z5`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Sheets API error: ${res.status}`);
  const data = await res.json();
  const values: string[][] = data.values ?? [];
  return {
    headers: values[0] ?? [],
    sampleRows: values.slice(1, 4),
  };
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

export const GoogleSheetsConfigView = () => {
  const { auth } = useAuth();
  const companyId = auth?.company?.id ?? '';

  const {
    currentStep,
    loading,
    error,
    selectedFile,
    syncResult,
    sheetPreview,
    availableSheets,
    connectAccount,
    selectFile,
    saveMapping,
    syncNow,
    getAccessToken,
    loadSheetNames,
  } = useGoogleSheets(companyId);

  const [pickerApiLoaded, setPickerApiLoaded] = useState(false);

  // Cargar nombres de hojas automáticamente al entrar al paso MAP_FIELDS
  useEffect(() => {
    if (currentStep === 'MAP_FIELDS' && selectedFile?.id) {
      loadSheetNames(selectedFile.id);
    }
  }, [currentStep, selectedFile?.id, loadSheetNames]);

  const currentStepIndex = STEPS.findIndex((s) => s.value === currentStep);
  const progressValue = ((currentStepIndex + 1) / STEPS.length) * 100;

  // Inicializar GAPI Picker
  const onPickerApiLoad = useCallback(() => {
    setPickerApiLoaded(true);
  }, []);

  const handleOpenPicker = async () => {
    if (!pickerApiLoaded) {
      toast.error('La librería de Google aún no se ha cargado.');
      return;
    }

    try {
      const token = await getAccessToken();
      const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_API_KEY;

      if (!API_KEY) {
        toast.error('Google API Key no configurada en el servidor.');
        return;
      }

      const pickerCallback = async (data: any) => {
        if (data.action === window.google.picker.Action.PICKED) {
          const doc = data.docs[0];
          const toastId = toast.loading('Leyendo encabezados del archivo...');

          try {
            const preview = await fetchSheetPreview(doc.id, token);
            await selectFile({ id: doc.id, name: doc.name }, preview);
            toast.dismiss(toastId);
            const detected = Object.keys(preview.headers).length;
            toast.success(
              `Archivo seleccionado: ${doc.name} — ${detected} columnas detectadas`,
            );
          } catch (err) {
            console.error('Error fetching sheet preview:', err);
            toast.dismiss(toastId);
            await selectFile({ id: doc.id, name: doc.name });
            toast.warning(
              'Archivo seleccionado, pero no se pudieron leer los encabezados. Puedes mapear manualmente.',
            );
          }
        } else if (data.action === window.google.picker.Action.CANCEL) {
          console.log('Usuario canceló la selección');
        }
      };

      const view = new window.google.picker.DocsView(window.google.picker.ViewId.SPREADSHEETS);
      view.setMode(window.google.picker.DocsViewMode.GRID);

      const picker = new window.google.picker.PickerBuilder()
        .addView(view)
        .setOAuthToken(token)
        .setDeveloperKey(API_KEY)
        .setCallback(pickerCallback)
        .setTitle('Selecciona tu hoja de cálculos de Pedidos')
        .build();

      picker.setVisible(true);
    } catch (err) {
      console.error('Error al abrir Google Picker:', err);
      toast.error('No se pudo obtener el acceso a Google Drive.');
    }
  };

  return (
    // max-w-5xl para dar espacio a la tabla horizontal del Paso 3
    <div className="mx-auto max-w-5xl px-4 py-8">
      <Script
        src="https://apis.google.com/js/api.js"
        onLoad={() => {
          window.gapi.load('picker', { callback: onPickerApiLoad });
        }}
      />

      {/* Header & Stepper */}
      <div className="mb-8 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight">Integración de Google Sheets</h1>
          <span className="text-sm font-medium text-muted-foreground">
            Paso {currentStepIndex + 1} de {STEPS.length}
          </span>
        </div>
        <Progress value={progressValue} className="h-2" />
        <div className="flex justify-between">
          {STEPS.map((step, idx) => (
            <div
              key={step.value}
              className={cn(
                'text-xs font-semibold uppercase tracking-wider transition-colors',
                idx <= currentStepIndex ? 'text-primary' : 'text-muted-foreground',
              )}
            >
              {step.label}
            </div>
          ))}
        </div>
      </div>

      <Card className="shadow-lg border-primary/10">
        {currentStep === 'CONNECT_ACCOUNT' && (
          <StepConnect onConnect={connectAccount} loading={loading} />
        )}

        {currentStep === 'SELECT_SHEET' && (
          <StepSelect onOpenPicker={handleOpenPicker} loading={loading} />
        )}

        {currentStep === 'MAP_FIELDS' && (
          <StepMap
            onSave={saveMapping}
            loading={loading}
            sheetPreview={sheetPreview}
            availableSheets={availableSheets}
          />
        )}

        {currentStep === 'READY' && (
          <StepReady
            syncResult={syncResult}
            onSync={syncNow}
            loading={loading}
            selectedFile={selectedFile}
          />
        )}
      </Card>

      {error && (
        <div className="mt-4 flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Subcomponentes de Pasos
// ---------------------------------------------------------------------------

const StepConnect = ({ onConnect, loading }: { onConnect: () => void; loading: boolean }) => (
  <>
    <CardHeader className="text-center">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Link2 className="h-8 w-8" />
      </div>
      <CardTitle className="text-xl">Vincular Cuenta</CardTitle>
      <CardDescription>
        Powip necesita acceso a tus hojas de cálculo para sincronizar pedidos.
      </CardDescription>
    </CardHeader>
    <CardContent className="space-y-4 py-6">
      <div className="rounded-md border border-dashed p-4 text-center bg-muted/20">
        <p className="text-sm text-muted-foreground">
          Al vincular, autorizarás a Powip para leer tus archivos de Google Sheets.
        </p>
      </div>
    </CardContent>
    <CardFooter>
      <Button onClick={onConnect} disabled={loading} className="w-full">
        {loading ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : null}
        Vincular Cuenta de Google
      </Button>
    </CardFooter>
  </>
);

const StepSelect = ({ onOpenPicker, loading }: { onOpenPicker: () => void; loading: boolean }) => (
  <>
    <CardHeader>
      <CardTitle>Seleccionar Hoja de Cálculo</CardTitle>
      <CardDescription>
        Busca y selecciona el archivo que contiene los pedidos en tu Google Drive.
      </CardDescription>
    </CardHeader>
    <CardContent className="space-y-6 py-6">
      <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed bg-muted/30 p-12 transition-all hover:bg-muted/50">
        <div className="mb-4 rounded-full bg-background p-4 shadow-sm">
          <FileSpreadsheet className="h-10 w-10 text-green-600" />
        </div>
        <p className="mb-6 text-center text-sm text-muted-foreground max-w-xs">
          Se abrirá el selector oficial de Google para que elijas el archivo de forma segura.
        </p>
        <Button
          onClick={onOpenPicker}
          disabled={loading}
          className="gap-2"
          variant="default"
        >
          {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          Seleccionar Archivo en Google Drive
        </Button>
      </div>
    </CardContent>
  </>
);

// ---------------------------------------------------------------------------
// StepMap — Smart Mapping + Data Preview
// ---------------------------------------------------------------------------

const StepMap = ({
  onSave,
  loading,
  sheetPreview,
  availableSheets,
}: {
  /** El companyId es inyectado por el hook — el componente no lo conoce. */
  onSave: (payload: Omit<SaveMappingPayload, 'companyId'>) => void;
  loading: boolean;
  sheetPreview: SheetPreview | null;
  availableSheets: string[];
}) => {
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [useExternalOrderNumber, setUseExternalOrderNumber] = useState(false);
  const [selectedSheet, setSelectedSheet] = useState<string>('');
  /** Claves que fueron detectadas automáticamente por el smart mapping. */
  const [autoMappedKeys, setAutoMappedKeys] = useState<Set<string>>(new Set());

  // ---------------------------------------------------------------------------
  // Smart mapping: se ejecuta cuando llegan los encabezados del sheet
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const headers = sheetPreview?.headers;
    if (!headers?.length) return;

    const auto: Record<string, string> = {};
    const detected = new Set<string>();

    headers.forEach((header, idx) => {
      // Normalizar: lowercase + quitar tildes
      const norm = header
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

      for (const [field, keywords] of Object.entries(SMART_MAPPING_DICT)) {
        // Ignorar DNI/RUC explícitamente para customer_name
        if (field === 'customer_name' && (norm.includes('dni') || norm.includes('ruc') || norm.includes('doc'))) {
          continue;
        }

        if (!auto[field] && keywords.some((kw) => norm.includes(kw))) {
          auto[field] = COLUMNS[idx];
          detected.add(field);
        }
      }
    });

    setMapping(auto);
    setAutoMappedKeys(detected);
  }, [sheetPreview?.headers]);

  // ---------------------------------------------------------------------------
  // Validación
  // ---------------------------------------------------------------------------
  const requiredKeys = [
    ...REQUIRED_FIELDS.map((f) => f.key),
    ...(useExternalOrderNumber ? ['external_order_id'] : []),
  ];

  const isValid = requiredKeys.every((key) => !!mapping[key]);

  const handleMappingChange = (key: string, value: string) => {
    setMapping((prev) => ({ ...prev, [key]: value }));
    // Si el usuario cambia manualmente, quitar el badge auto
    setAutoMappedKeys((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  };

  const handleSave = () => {
    if (!isValid) {
      toast.error('Por favor, mapea todos los campos requeridos');
      return;
    }
    onSave({
      mapping,
      useExternalOrderNumber,
      sheetName: selectedSheet || undefined,
    });
  };

  // ---------------------------------------------------------------------------
  // Columnas de la tabla: external_order_id primero (si aplica) + 16 campos
  // ---------------------------------------------------------------------------
  const tableFields = [
    ...(useExternalOrderNumber
      ? [{ key: 'external_order_id', label: 'Nro. Pedido Externo', isExternal: true, isOptional: false }]
      : []),
    ...REQUIRED_FIELDS.map((f) => ({ ...f, isExternal: false, isOptional: false })),
    ...OPTIONAL_FIELDS.map((f) => ({ ...f, isExternal: false, isOptional: true })),
  ];

  const { headers = [], sampleRows = [] } = sheetPreview ?? {};

  // Helper: dada una clave de campo, devuelve el valor de muestra de una fila
  const getSampleCell = (row: string[], fieldKey: string): string => {
    const col = mapping[fieldKey];
    if (!col) return '—';
    const idx = col.charCodeAt(0) - 65;
    return row[idx] ?? '—';
  };

  const autoCount = autoMappedKeys.size;

  return (
    <>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle>Smart Mapping</CardTitle>
            <CardDescription>
              Revisá el mapeo automático y ajustá lo que necesites. Las filas de color muestran
              datos reales de tu archivo.
            </CardDescription>
          </div>
          {autoCount > 0 && (
            <div className="flex shrink-0 items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              <Wand2 className="h-3.5 w-3.5" />
              {autoCount} de {REQUIRED_FIELDS.length + OPTIONAL_FIELDS.length} detectados
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-5 py-4">
        {/* Selector de hoja — visible solo si el archivo tiene más de una */}
        {availableSheets.length > 0 && (
          <div className="space-y-2 rounded-lg border bg-muted/30 px-4 py-3">
            <p className="text-sm font-semibold">¿Qué hoja del archivo querés sincronizar?</p>
            <p className="text-xs text-muted-foreground">
              Tu archivo tiene {availableSheets.length} hoja{availableSheets.length !== 1 ? 's' : ''}.
              {availableSheets.length === 1
                ? ' Se usará automáticamente.'
                : ' Seleccioná la que contiene los pedidos.'}
            </p>
            {availableSheets.length > 1 && (
              <Select value={selectedSheet} onValueChange={setSelectedSheet}>
                <SelectTrigger className="w-full max-w-sm text-sm">
                  <SelectValue placeholder="Seleccionar hoja..." />
                </SelectTrigger>
                <SelectContent>
                  {availableSheets.map((name) => (
                    <SelectItem key={name} value={name} className="text-sm">
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        )}

        {/* Switch: numeración de pedido externa */}
        <div className="flex items-start justify-between gap-4 rounded-lg border bg-muted/30 px-4 py-3">
          <div className="space-y-0.5">
            <p className="text-sm font-semibold leading-snug">
              ¿Usar numeración de pedidos propia del archivo?
            </p>
            <p className="text-xs text-muted-foreground">
              {useExternalOrderNumber
                ? 'Deberás indicar la columna con el número de pedido de tu archivo.'
                : 'Powip generará automáticamente un ID interno (ej: ORD-001).'}
            </p>
          </div>
          <Switch
            id="external-order-switch"
            checked={useExternalOrderNumber}
            onCheckedChange={setUseExternalOrderNumber}
            className="mt-0.5 shrink-0"
          />
        </div>

        {/* Tabla con doble scroll */}
        <div className="overflow-auto rounded-lg border shadow-sm">
          <table className="w-full border-collapse text-sm">
            {/* ── ENCABEZADOS: campos de Powip ── */}
            <thead>
              <tr className="border-b bg-muted/60">
                {tableFields.map((field) => (
                  <th
                    key={field.key}
                    className={cn(
                      'min-w-[160px] whitespace-nowrap px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wider',
                      field.isExternal
                        ? 'text-primary'
                        : 'text-muted-foreground',
                    )}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>{field.label}</span>
                      {autoMappedKeys.has(field.key) && (
                        <Badge
                          variant="outline"
                          className="h-4 rounded-full border-primary/40 bg-primary/10 px-1.5 text-[9px] font-bold uppercase text-primary"
                        >
                          Auto ✓
                        </Badge>
                      )}
                      {field.isExternal && (
                        <Badge
                          variant="outline"
                          className="h-4 rounded-full border-amber-400/50 bg-amber-400/10 px-1.5 text-[9px] font-bold uppercase text-amber-600 dark:text-amber-400"
                        >
                          externo
                        </Badge>
                      )}
                      {field.isOptional && (
                        <Badge
                          variant="outline"
                          className="h-4 rounded-full border-muted-foreground/30 bg-muted/40 px-1.5 text-[9px] font-bold uppercase text-muted-foreground"
                        >
                          opcional
                        </Badge>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {/* ── FILA 1: Selects de mapeo ── */}
              <tr className="border-b bg-background">
                {tableFields.map((field) => (
                  <td key={field.key} className="px-2 py-2">
                    <Select
                      value={mapping[field.key] ?? ''}
                      onValueChange={(v) => handleMappingChange(field.key, v)}
                    >
                      <SelectTrigger
                        id={`col-${field.key}`}
                        className={cn(
                          'h-8 w-full min-w-[144px] text-xs',
                          !mapping[field.key] && !field.isOptional && 'border-destructive/50 text-muted-foreground',
                          mapping[field.key] && autoMappedKeys.has(field.key) &&
                            'border-primary/40 bg-primary/5',
                        )}
                      >
                        <SelectValue placeholder="Seleccionar..." />
                      </SelectTrigger>
                      <SelectContent>
                        {COLUMNS.map((col, idx) => (
                          <SelectItem key={col} value={col} className="text-xs">
                            <span className="font-mono font-bold">{col}</span>
                            {headers[idx] ? (
                              <span className="ml-1.5 text-muted-foreground">
                                — {headers[idx]}
                              </span>
                            ) : null}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                ))}
              </tr>

              {/* ── FILAS 2-4: datos de muestra ── */}
              {sampleRows.length > 0 ? (
                sampleRows.map((row, rowIdx) => (
                  <tr
                    key={rowIdx}
                    className={cn(
                      'border-b transition-colors',
                      rowIdx % 2 === 0
                        ? 'bg-muted/20 hover:bg-muted/40'
                        : 'bg-background hover:bg-muted/20',
                    )}
                  >
                    {tableFields.map((field) => {
                      const cell = getSampleCell(row, field.key);
                      const isEmpty = cell === '—';
                      return (
                        <td
                          key={field.key}
                          className={cn(
                            'max-w-[200px] truncate px-3 py-2 text-xs',
                            isEmpty ? 'text-muted-foreground/50' : 'text-foreground',
                          )}
                          title={isEmpty ? undefined : cell}
                        >
                          {cell}
                        </td>
                      );
                    })}
                  </tr>
                ))
              ) : (
                /* Sin preview: mostrar placeholder */
                <tr>
                  <td
                    colSpan={tableFields.length}
                    className="px-4 py-8 text-center text-xs text-muted-foreground"
                  >
                    No hay datos de muestra disponibles. Verifica que el archivo tenga datos desde
                    la fila 2.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Hint de validación */}
        {!isValid && Object.keys(mapping).length > 0 && (
          <p className="text-center text-xs text-muted-foreground">
            Aún hay campos sin mapear (resaltados en rojo). Asigna una columna a cada uno.
          </p>
        )}
      </CardContent>

      <CardFooter>
        <Button onClick={handleSave} disabled={loading} className="w-full gap-2">
          {loading ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : (
            <CheckCircle2 className="h-4 w-4" />
          )}
          Confirmar Sincronización
        </Button>
      </CardFooter>
    </>
  );
};

// ---------------------------------------------------------------------------
// StepReady
// ---------------------------------------------------------------------------

const StepReady = ({
  syncResult,
  onSync,
  loading,
  selectedFile,
}: {
  syncResult: any;
  onSync: () => void;
  loading: boolean;
  selectedFile: any;
}) => (
  <>
    <CardHeader className="text-center">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400">
        <CheckCircle2 className="h-8 w-8" />
      </div>
      <CardTitle className="text-xl">¡Integración Activa!</CardTitle>
      <CardDescription>
        Sincronizando desde: <span className="font-semibold text-foreground">{selectedFile?.name}</span>
      </CardDescription>
    </CardHeader>
    <CardContent className="space-y-6 py-6 text-center">
      {syncResult ? (
        <div className="rounded-lg border bg-muted/20 p-6 transition-all animate-in fade-in zoom-in duration-300">
          <p className="mb-4 text-xs font-bold uppercase tracking-widest text-muted-foreground">Estado de la Sincronización</p>
          <div className="grid grid-cols-2 gap-8">
            <div className="space-y-1">
              <span className="text-3xl font-extrabold text-primary">{syncResult.processed}</span>
              <p className="text-[10px] font-medium text-muted-foreground">PEDIDOS PROCESADOS</p>
            </div>
            <div className="space-y-1">
              <span className="text-3xl font-extrabold text-destructive">{syncResult.errors}</span>
              <p className="text-[10px] font-medium text-muted-foreground">CON ERRORES</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2">
          <div className="h-2 w-full max-w-[200px] overflow-hidden rounded-full bg-muted">
            <div className="h-full w-1/3 animate-pulse bg-primary/40" />
          </div>
          <p className="text-sm text-muted-foreground">
            Esperando la primera sincronización...
          </p>
        </div>
      )}
    </CardContent>
    <CardFooter>
      <Button
        onClick={onSync}
        disabled={loading}
        variant="secondary"
        className="w-full transition-all hover:bg-secondary/80"
      >
        {loading ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
        Forzar Sincronización Ahora
      </Button>
    </CardFooter>
  </>
);
