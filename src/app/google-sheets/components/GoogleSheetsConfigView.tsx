'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, Link2, RefreshCw } from 'lucide-react';
import { useGoogleSheets } from '../hooks/useGoogleSheets';
import { googleSheetsApi } from '../services/googleSheetsApi';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import type { GoogleTab, SetupStep } from '../types';
import { StepFile } from './steps/StepFile';
import { StepStoreTabs } from './steps/StepStoreTabs';
import { StepMap } from './steps/StepMap';
import { StepReview } from './steps/StepReview';
import { SyncStatusPanel } from './SyncStatusPanel';

const STEPS: { label: string; value: SetupStep }[] = [
  { label: 'Conectar', value: 'CONNECT_ACCOUNT' },
  { label: 'Archivo', value: 'SELECT_FILE' },
  { label: 'Tienda y pestañas', value: 'CONFIGURE' },
  { label: 'Mapeo', value: 'MAP_FIELDS' },
  { label: 'Revisión', value: 'REVIEW' },
  { label: 'Estado', value: 'STATUS' },
];

export function GoogleSheetsConfigView() {
  const { auth } = useAuth();
  const stores = auth?.company?.stores ?? [];
  const g = useGoogleSheets();
  const { step, config, preview, review, loading, error } = g;

  const [availableTabs, setAvailableTabs] = useState<GoogleTab[]>([]);
  const [tabsError, setTabsError] = useState<string | null>(null);
  const [storeId, setStoreId] = useState<string | null>(null);
  const [tabIds, setTabIds] = useState<number[]>([]);

  const fileId = config?.file?.id;
  useEffect(() => {
    if (step !== 'CONFIGURE' || !fileId) return;
    let cancelled = false;
    setTabsError(null);
    googleSheetsApi
      .getTabs(fileId)
      .then((tabs) => !cancelled && setAvailableTabs(tabs))
      .catch(() => !cancelled && setTabsError('No se pudieron leer las pestañas del archivo.'));
    return () => {
      cancelled = true;
    };
  }, [step, fileId]);

  const currentIndex = Math.max(
    0,
    STEPS.findIndex((s) => s.value === step),
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-8 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight">Integración de Google Sheets</h1>
          <span className="text-sm font-medium text-muted-foreground">
            Paso {currentIndex + 1} de {STEPS.length}
          </span>
        </div>
        <Progress value={((currentIndex + 1) / STEPS.length) * 100} className="h-2" />
        <ol className="flex justify-between">
          {STEPS.map((s, idx) => (
            <li
              key={s.value}
              aria-current={idx === currentIndex ? 'step' : undefined}
              className={cn(
                'text-xs font-semibold uppercase tracking-wider',
                idx <= currentIndex ? 'text-primary' : 'text-muted-foreground',
              )}
            >
              {s.label}
            </li>
          ))}
        </ol>
      </div>

      <Card className="border-primary/10 shadow-lg">
        {!config && loading && <CardContent className="py-10">Cargando...</CardContent>}

        {config && step === 'CONNECT_ACCOUNT' && (
          <>
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Link2 className="h-8 w-8" />
              </div>
              <CardTitle>Vincular cuenta</CardTitle>
              <CardDescription>
                Powip necesita acceso a tus hojas de cálculo para cargar tus pedidos.
              </CardDescription>
            </CardHeader>
            <CardFooter>
              <Button onClick={g.connectAccount} disabled={loading} className="w-full">
                {loading && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
                Vincular cuenta de Google
              </Button>
            </CardFooter>
          </>
        )}

        {config && step === 'SELECT_FILE' && (
          <StepFile loading={loading} getAccessToken={g.getAccessToken} onSelectFile={g.selectFile} />
        )}

        {config && step === 'CONFIGURE' && (
          <>
            {tabsError && (
              <p role="alert" className="px-6 pt-4 text-sm text-destructive">
                {tabsError}
              </p>
            )}
            <StepStoreTabs
              stores={stores}
              tabs={availableTabs}
              loading={loading}
              initialStoreId={storeId ?? config.storeId}
              initialTabIds={tabIds.length ? tabIds : config.tabs.map((t) => t.id)}
              onContinue={(sId, ids) => {
                setStoreId(sId);
                setTabIds(ids);
                g.savePreview(ids);
              }}
            />
          </>
        )}

        {step === 'MAP_FIELDS' && preview && storeId && (
          <StepMap
            preview={preview}
            storeId={storeId}
            tabIds={tabIds}
            loading={loading}
            initialMapping={config?.headerMapping}
            onSave={g.saveConfig}
            onBack={g.goConfigure}
          />
        )}

        {step === 'REVIEW' && review && (
          <StepReview review={review} loading={loading} onActivate={g.activate} onBack={g.goConfigure} />
        )}

        {config && step === 'STATUS' && (
          <SyncStatusPanel
            config={config}
            issues={g.issues}
            stores={stores}
            loading={loading}
            onSyncNow={g.syncNow}
            onDisconnect={g.disconnect}
            onReconfigure={g.goConfigure}
            onReconnect={g.connectAccount}
          />
        )}
      </Card>

      {error && (
        <div
          role="alert"
          className="mt-4 flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive"
        >
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}
    </div>
  );
}
