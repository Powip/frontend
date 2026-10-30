'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { googleSheetsApi } from '../services/googleSheetsApi';
import type { GoogleConfigView, GoogleTab, RunStatus, SyncIssue } from '../types';

interface Props {
  config: GoogleConfigView;
  issues: SyncIssue[];
  stores: { id: string; name: string }[];
  loading: boolean;
  onSyncNow: () => void;
  onDisconnect: () => void;
  onReconfigure: () => void;
  onReconnect: () => void;
}

const RUN_STATUS: Record<RunStatus, string> = {
  success: 'Correcta',
  partial: 'Con problemas',
  error: 'Con error',
};

const TAB_ORDER_REF = '(pestaña)';

export function SyncStatusPanel({
  config,
  issues,
  stores,
  loading,
  onSyncNow,
  onDisconnect,
  onReconfigure,
  onReconnect,
}: Props) {
  const [confirming, setConfirming] = useState(false);
  const [fileTabs, setFileTabs] = useState<GoogleTab[]>([]);

  const fileId = config.file?.id;
  useEffect(() => {
    if (!fileId) return;
    let cancelled = false;
    googleSheetsApi
      .getTabs(fileId)
      .then((tabs) => !cancelled && setFileTabs(tabs))
      .catch(() => !cancelled && setFileTabs([]));
    return () => {
      cancelled = true;
    };
  }, [fileId]);

  const trackedIds = new Set(config.tabs.map((t) => t.id));
  const untracked = fileTabs.filter((t) => !trackedIds.has(t.id));
  const storeName = stores.find((s) => s.id === config.storeId)?.name ?? '—';
  const needsReconnect = config.status === 'NEEDS_RECONNECT';
  const run = config.lastRun;
  const s = run?.summary;

  return (
    <>
      <CardHeader>
        <CardTitle>La integración está activa</CardTitle>
        <CardDescription>Powip revisa tu hoja de cálculo y carga los pedidos nuevos.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Archivo</dt>
            <dd className="font-medium">{config.file?.name}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Tienda</dt>
            <dd className="font-medium">{storeName}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-muted-foreground">Pestañas</dt>
            <dd>
              <ul className="flex flex-wrap gap-2">
                {config.tabs.map((t) => (
                  <li key={t.id} className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium">
                    {t.name}
                  </li>
                ))}
              </ul>
            </dd>
          </div>
        </dl>

        {untracked.length > 0 && (
          <p role="status" className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Hay pestañas en el archivo que no están marcadas y no se sincronizan:{' '}
              {untracked.map((t) => t.name).join(', ')}. Usa «Reconfigurar» para incluirlas.
            </span>
          </p>
        )}

        <section aria-label="Última sincronización" className="space-y-2">
          <h3 className="text-sm font-semibold">Última sincronización</h3>
          {run && s ? (
            <>
              <p className="text-sm text-muted-foreground">
                {new Date(run.at).toLocaleString('es-PE', { dateStyle: 'medium', timeStyle: 'short' })} ·{' '}
                {RUN_STATUS[run.status]}
              </p>
              <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                <li>Creadas: {s.created}</li>
                <li>Borradores: {s.drafts}</li>
                <li>Duplicadas: {s.duplicates}</li>
                <li>Con problemas: {s.problems}</li>
                <li>Pestañas omitidas: {s.tabsSkipped}</li>
              </ul>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Todavía no se ha sincronizado.</p>
          )}
          {config.lastError && <p className="text-sm text-destructive">{config.lastError}</p>}
        </section>

        {issues.length > 0 && (
          <section aria-label="Problemas abiertos" className="space-y-2">
            <h3 className="text-sm font-semibold">Problemas abiertos ({issues.length})</h3>
            <ul className="divide-y rounded-lg border text-sm">
              {issues.map((i, idx) => {
                const isTab = i.orderRef === TAB_ORDER_REF;
                return (
                  <li key={`${i.orderRef}-${i.code}-${idx}`} className="space-y-0.5 p-3">
                    <p className="font-medium">
                      {isTab ? 'Problema de la pestaña' : `Venta ${i.orderRef ?? 'sin ID'}`}
                      {!isTab && i.rowNumbers.length > 0 && (
                        <span className="ml-2 font-normal text-muted-foreground">
                          Fila {i.rowNumbers.join(', ')}
                        </span>
                      )}
                    </p>
                    <p className="text-muted-foreground">{i.message}</p>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </CardContent>
      <CardFooter className="flex flex-wrap justify-between gap-2">
        <div className="flex gap-2">
          {needsReconnect ? (
            <Button onClick={onReconnect} disabled={loading}>
              Reconectar cuenta
            </Button>
          ) : (
            <Button onClick={onSyncNow} disabled={loading || config.running}>
              <RefreshCw className={`mr-2 h-4 w-4 ${config.running ? 'animate-spin' : ''}`} />
              {config.running ? 'Sincronizando…' : 'Sincronizar ahora'}
            </Button>
          )}
          <Button variant="outline" onClick={onReconfigure} disabled={loading}>
            Reconfigurar
          </Button>
        </div>
        <Button variant="outline" className="text-destructive" onClick={() => setConfirming(true)} disabled={loading}>
          Desconectar
        </Button>
      </CardFooter>

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Desconectar Google Sheets?</AlertDialogTitle>
            <AlertDialogDescription>
              Se dejará de sincronizar tu hoja de cálculo. Los pedidos ya cargados se conservan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={onDisconnect}>Desconectar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
