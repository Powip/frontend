'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import type {
  FieldDef,
  FieldGroup,
  FieldKey,
  HeaderMapping,
  PreviewResponse,
  SaveConfigPayload,
} from '../../types';

/** Grupos visibles; 'identity' (ID de venta) se muestra junto a Cliente. */
const GROUPS: { label: string; groups: FieldGroup[] }[] = [
  { label: 'Cliente', groups: ['identity', 'customer'] },
  { label: 'Producto', groups: ['product'] },
  { label: 'Financiero', groups: ['financial'] },
  { label: 'Entrega', groups: ['delivery'] },
];

interface Props {
  preview: PreviewResponse;
  storeId: string;
  tabIds: number[];
  loading: boolean;
  initialMapping?: HeaderMapping | null;
  onSave: (payload: SaveConfigPayload) => void;
  onBack?: () => void;
}

/** Sugerencia inicial: la primera pestaña que sugiera cada campo; sin encabezados repetidos. */
function initialFrom(preview: PreviewResponse, saved?: HeaderMapping | null): HeaderMapping {
  const result: HeaderMapping = {};
  const used = new Set<string>();
  const sources: HeaderMapping[] = saved ? [saved] : preview.tabs.map((t) => t.suggestedMapping);
  for (const source of sources) {
    for (const [key, header] of Object.entries(source) as [FieldKey, string][]) {
      if (!header || result[key] || used.has(header)) continue;
      result[key] = header;
      used.add(header);
    }
  }
  return result;
}

export function StepMap({ preview, storeId, tabIds, loading, initialMapping, onSave, onBack }: Props) {
  const [mapping, setMapping] = useState<HeaderMapping>(() => initialFrom(preview, initialMapping));

  const allHeaders = useMemo(() => {
    const seen = new Set<string>();
    for (const tab of preview.tabs) tab.headers.forEach((h) => h && seen.add(h));
    return [...seen];
  }, [preview.tabs]);

  const usedBy = (header: string, exceptKey: FieldKey) =>
    (Object.entries(mapping) as [FieldKey, string][]).some(
      ([k, h]) => k !== exceptKey && h === header,
    );

  const setField = (key: FieldKey, header: string) =>
    setMapping((prev) => {
      const next = { ...prev };
      if (header) next[key] = header;
      else delete next[key];
      return next;
    });

  const groupOf = (field: FieldDef) =>
    GROUPS.find((g) => g.groups.includes(field.group))?.label ?? 'Cliente';

  // Obligatorios sin asignar, por grupo.
  const missingByGroup = GROUPS.map((g) => ({
    label: g.label,
    count: preview.fields.filter(
      (f) => f.required && groupOf(f) === g.label && !mapping[f.key],
    ).length,
  })).filter((g) => g.count > 0);
  const missingTotal = missingByGroup.reduce((n, g) => n + g.count, 0);

  // Encabezados elegidos que no existen en alguna pestaña seleccionada.
  const tabProblems = preview.fields.flatMap((f) => {
    const header = mapping[f.key];
    if (!header) return [];
    return preview.tabs
      .filter((t) => !t.headers.includes(header))
      .map((t) => ({ field: f, header, tab: t.name }));
  });
  const requiredTabProblems = tabProblems.filter((p) => p.field.required);

  const canContinue = missingTotal === 0 && requiredTabProblems.length === 0 && !loading;

  const handleSave = () =>
    onSave({
      storeId,
      tabIds,
      headerMapping: Object.fromEntries(
        Object.entries(mapping).filter(([, h]) => !!h),
      ) as Record<string, string>,
    });

  return (
    <>
      <CardHeader>
        <CardTitle>Relaciona tus columnas</CardTitle>
        <CardDescription>
          Indica qué encabezado de tu hoja corresponde a cada dato de Powip. El mismo mapeo se aplica
          a todas las pestañas elegidas.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {GROUPS.map((g) => {
          const fields = preview.fields.filter((f) => groupOf(f) === g.label);
          if (fields.length === 0) return null;
          return (
            <section key={g.label} aria-label={g.label} className="space-y-3">
              <h3 className="text-sm font-semibold uppercase tracking-wide">{g.label}</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                {fields.map((f) => (
                  <div key={f.key} className="space-y-1">
                    <label htmlFor={`gs-map-${f.key}`} className="text-sm font-medium">
                      {f.label}
                    </label>
                    {f.required && (
                      <span className="ml-2 text-xs text-muted-foreground">Obligatorio</span>
                    )}
                    <select
                      id={`gs-map-${f.key}`}
                      value={mapping[f.key] ?? ''}
                      onChange={(e) => setField(f.key, e.target.value)}
                      className="w-full rounded-md border bg-background p-2 text-sm"
                    >
                      <option value="">Sin asignar</option>
                      {allHeaders
                        .filter((h) => !usedBy(h, f.key))
                        .map((h) => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        ))}
                    </select>
                  </div>
                ))}
              </div>
            </section>
          );
        })}

        {tabProblems.length > 0 && (
          <ul role="alert" className="space-y-1 text-sm text-destructive">
            {tabProblems.map((p) => (
              <li key={`${p.field.key}-${p.tab}`}>
                {`El encabezado "${p.header}" (${p.field.label}) no existe en la pestaña "${p.tab}".`}
              </li>
            ))}
          </ul>
        )}

        <section aria-label="Vista previa" className="space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide">Vista previa</h3>
          {preview.tabs.map((tab) => {
            const cols = preview.fields.filter((f) => mapping[f.key] && tab.headers.includes(mapping[f.key]!));
            return (
              <div key={tab.id} className="overflow-x-auto">
                <p className="mb-1 text-xs font-medium text-muted-foreground">{tab.name}</p>
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr>
                      {cols.map((f) => (
                        <th key={f.key} className="p-1">
                          {f.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tab.sampleRows.slice(0, 3).map((row, i) => (
                      <tr key={i}>
                        {cols.map((f) => (
                          <td key={f.key} className="p-1">
                            {row[tab.headers.indexOf(mapping[f.key]!)] ?? ''}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}
        </section>

        {missingTotal > 0 && (
          <p className="text-sm text-muted-foreground">
            {`Faltan ${missingTotal} campos obligatorios: `}
            {missingByGroup.map((g) => `${g.label} (${g.count})`).join(', ')}
          </p>
        )}
      </CardContent>
      <CardFooter className="gap-2">
        {onBack && (
          <Button variant="outline" onClick={onBack}>
            Volver
          </Button>
        )}
        <Button className="flex-1" disabled={!canContinue} onClick={handleSave}>
          Continuar
        </Button>
      </CardFooter>
    </>
  );
}
