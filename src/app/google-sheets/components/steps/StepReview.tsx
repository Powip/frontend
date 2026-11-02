'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import type { ReviewResult } from '../../types';

interface Props {
  review: ReviewResult;
  loading: boolean;
  onActivate: (acknowledgeHistory: boolean) => void;
  onBack?: () => void;
}

const TAB_REF = '(pestaña)';

function rowsText(rows: number[]): string {
  return `${rows.length === 1 ? 'Fila' : 'Filas'} ${rows.join(', ')}`;
}

export function StepReview({ review, loading, onActivate, onBack }: Props) {
  const [acknowledged, setAcknowledged] = useState(false);
  const blocked = review.overLimit && !acknowledged;
  const newTabNames = (review.newTabs ?? []).map((t) => t.name).join(', ');

  return (
    <>
      <CardHeader>
        <CardTitle>Revisa antes de activar</CardTitle>
        <CardDescription>Así se cargarían los pedidos de tu hoja.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-muted-foreground">Pedidos válidos</dt>
            <dd className="text-2xl font-semibold">{review.valid}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Pedidos con problemas</dt>
            <dd className="text-2xl font-semibold">{review.withProblems}</dd>
          </div>
        </dl>

        {review.problems.length > 0 && (
          <ul aria-label="Problemas encontrados" className="space-y-2 text-sm">
            {review.problems.map((p, i) => {
              const tabLevel = p.orderRef === TAB_REF || p.rowNumbers.length === 0;
              return (
                <li key={i} className="rounded-md border p-2">
                  {tabLevel ? (
                    <p className="font-medium">Problema de la pestaña</p>
                  ) : (
                    <p className="font-medium">
                      {rowsText(p.rowNumbers)}
                      {p.orderRef ? ` · Pedido ${p.orderRef}` : ''}
                    </p>
                  )}
                  <p className="text-muted-foreground">{p.message}</p>
                </li>
              );
            })}
          </ul>
        )}

        {review.reactivation && (
          <p role="note" className="rounded-md border p-3 text-sm text-muted-foreground">
            {newTabNames
              ? `Las pestañas que ya sincronizabas conservan su historial y siguen cargando sus ventas nuevas. Pestañas nuevas: ${newTabNames}.`
              : 'Las pestañas que ya sincronizabas conservan su historial y siguen cargando sus ventas nuevas.'}
          </p>
        )}

        {review.overLimit && (
          <div className="space-y-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            <p>
              {review.reactivation
                ? `Las pestañas nuevas (${newTabNames}) tienen ${review.dataRows} filas con datos y el límite para cargar de una vez es ${review.limit}. Si continúas, esas filas se tomarán como punto de partida y solo se cargarán las ventas que agregues después en esas pestañas.`
                : `Tu hoja tiene ${review.dataRows} filas con datos y el límite para cargar de una vez es ${review.limit}. Si continúas, se tomarán como punto de partida y solo se cargarán las ventas nuevas que agregues después.`}
            </p>
            <div className="flex items-center gap-2">
              <Checkbox
                id="gs-ack"
                checked={acknowledged}
                onCheckedChange={(c) => setAcknowledged(c === true)}
              />
              <label htmlFor="gs-ack">
                {review.reactivation
                  ? 'Entiendo que las ventas que ya están en las pestañas nuevas no se cargarán'
                  : 'Entiendo que mis ventas anteriores no se cargarán'}
              </label>
            </div>
          </div>
        )}
      </CardContent>
      <CardFooter className="gap-2">
        {onBack && (
          <Button variant="outline" onClick={onBack}>
            Volver
          </Button>
        )}
        <Button
          className="flex-1"
          disabled={blocked || loading}
          onClick={() => onActivate(review.overLimit && acknowledged)}
        >
          Confirmar y activar
        </Button>
      </CardFooter>
    </>
  );
}
