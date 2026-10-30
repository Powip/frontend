'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import type { GoogleTab } from '../../types';

export interface StoreOption {
  id: string;
  name: string;
}

interface Props {
  stores: StoreOption[];
  /** Pestañas del archivo. */
  tabs: GoogleTab[];
  loading: boolean;
  initialStoreId?: string | null;
  initialTabIds?: number[];
  onContinue: (storeId: string, tabIds: number[]) => void;
}

export function StepStoreTabs({
  stores,
  tabs,
  loading,
  initialStoreId,
  initialTabIds,
  onContinue,
}: Props) {
  const [storeId, setStoreId] = useState<string>(
    initialStoreId || (stores.length === 1 ? stores[0].id : ''),
  );
  const [tabIds, setTabIds] = useState<number[]>(initialTabIds ?? []);

  const toggle = (id: number, checked: boolean) =>
    setTabIds((prev) => (checked ? [...prev, id] : prev.filter((t) => t !== id)));

  const canContinue = !!storeId && tabIds.length > 0 && !loading;

  return (
    <>
      <CardHeader>
        <CardTitle>Tienda y pestañas</CardTitle>
        <CardDescription>
          Elige la tienda a la que se cargarán los pedidos y las pestañas del archivo que quieres
          sincronizar.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <label htmlFor="gs-store" className="text-sm font-medium">
            Tienda
          </label>
          <select
            id="gs-store"
            value={storeId}
            onChange={(e) => setStoreId(e.target.value)}
            className="w-full rounded-md border bg-background p-2 text-sm"
          >
            <option value="">Selecciona una tienda</option>
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Pestañas a sincronizar</legend>
          {tabs.length === 0 && (
            <p className="text-sm text-muted-foreground">El archivo no tiene pestañas disponibles.</p>
          )}
          {tabs.map((tab) => (
            <div key={tab.id} className="flex items-center gap-2">
              <Checkbox
                id={`gs-tab-${tab.id}`}
                checked={tabIds.includes(tab.id)}
                onCheckedChange={(c) => toggle(tab.id, c === true)}
              />
              <label htmlFor={`gs-tab-${tab.id}`} className="text-sm">
                {tab.name}
              </label>
            </div>
          ))}
          {tabIds.length === 0 && (
            <p className="text-xs text-muted-foreground">Marca al menos una pestaña para continuar.</p>
          )}
        </fieldset>
      </CardContent>
      <CardFooter>
        <Button className="w-full" disabled={!canContinue} onClick={() => onContinue(storeId, tabIds)}>
          Continuar
        </Button>
      </CardFooter>
    </>
  );
}
