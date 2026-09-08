"use client";

import { Loader2, Plus, Settings2, Star, Trash2 } from "lucide-react";
import { useState } from "react";
import { BetaBanner } from "@/app/facturacion/components/BetaBanner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { SunatDocumentType } from "@/features/sunat/sunat-document/enums/sunat-document.enums";
import {
  DEFAULT_SUNAT_DOCUMENT_SEQUENCES,
  SUNAT_DOCUMENT_TYPE_LABELS,
} from "@/features/sunat/sunat-document/enums/sunat-document.enums";
import { useSetDefaultSunatDocumentSequence } from "@/features/sunat/sunat-document-sequence/hooks/use-set-default-sunat-document-sequence";
import { useSunatDocumentSequences } from "@/features/sunat/sunat-document-sequence/hooks/use-sunat-document-sequences";
import type { SunatDocumentSequence } from "@/features/sunat/sunat-document-sequence/models/sunat-document-sequence";
import { DeleteSunatDocumentSequenceDialog } from "../modals/DeleteSunatDocumentSequenceDialog";
import { ManageSunatDocumentSequenceModal } from "../modals/ManageSunatDocumentSequenceModal";

/**
 * Deliberately wider than `(typeof DEFAULT_SUNAT_DOCUMENT_SEQUENCES)[number]`
 * (which TS narrows to a union of 4 exact literal shapes because the source
 * array is `as const`). Rows built from an arbitrary backend sequence -
 * e.g. a second invoice series a company configured beyond the 4 defaults -
 * need `series: string`, not one of 4 literal strings, or this won't
 * compile once list-driven "extra" rows are added below.
 */
interface SeriesRowDefinition {
  taxDocumentType: SunatDocumentType;
  series: string;
}

interface SeriesRow {
  definition: SeriesRowDefinition;
  sequence: SunatDocumentSequence | null;
}

function getDocumentTypeLabel(taxDocumentType: SunatDocumentType): string {
  return SUNAT_DOCUMENT_TYPE_LABELS[taxDocumentType];
}

/**
 * Builds the table rows: one per canonical series Powip provisions out of
 * the box (`DEFAULT_SUNAT_DOCUMENT_SEQUENCES`), always shown even when not
 * yet initialized, plus any *other* sequence the company has configured
 * (e.g. a second invoice series) so the table stays correct as companies
 * grow beyond the 4 defaults instead of silently hiding them.
 */
function buildRows(sequences: SunatDocumentSequence[]): SeriesRow[] {
  const bySeriesKey = new Map(
    sequences.map((sequence) => [`${sequence.taxDocumentType}-${sequence.series}`, sequence]),
  );

  const defaultKeys = new Set(
    DEFAULT_SUNAT_DOCUMENT_SEQUENCES.map(
      (definition) => `${definition.taxDocumentType}-${definition.series}`,
    ),
  );

  const canonicalRows: SeriesRow[] = DEFAULT_SUNAT_DOCUMENT_SEQUENCES.map((definition) => ({
    definition,
    sequence: bySeriesKey.get(`${definition.taxDocumentType}-${definition.series}`) ?? null,
  }));

  const extraRows: SeriesRow[] = sequences
    .filter((sequence) => !defaultKeys.has(`${sequence.taxDocumentType}-${sequence.series}`))
    .map((sequence) => ({
      definition: { taxDocumentType: sequence.taxDocumentType, series: sequence.series },
      sequence,
    }));

  return [...canonicalRows, ...extraRows];
}

export function SeriesTab() {
  const [selectedDefinition, setSelectedDefinition] = useState<SeriesRowDefinition | null>(null);
  const [isAddingSeries, setIsAddingSeries] = useState(false);
  const [sequenceToDelete, setSequenceToDelete] = useState<SunatDocumentSequence | null>(null);

  const { data: sequences = [], isLoading, isError } = useSunatDocumentSequences();

  const setDefaultSequence = useSetDefaultSunatDocumentSequence();

  const rows = buildRows(sequences);

  const selectedSequence: SunatDocumentSequence | null = selectedDefinition
    ? (rows.find(
        ({ definition }) =>
          definition.taxDocumentType === selectedDefinition.taxDocumentType &&
          definition.series === selectedDefinition.series,
      )?.sequence ?? null)
    : null;

  function closeManageModal() {
    setSelectedDefinition(null);
    setIsAddingSeries(false);
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold">Series y Correlativos</h2>

        <p className="text-sm text-muted-foreground">
          Mantén actualizado el último correlativo utilizado para cada serie.
        </p>
      </div>

      <BetaBanner>
        Si emites comprobantes fuera de Powip, debes actualizar manualmente el último correlativo
        utilizado.
      </BetaBanner>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Series configuradas</CardTitle>

          <Button size="sm" className="gap-2" onClick={() => setIsAddingSeries(true)}>
            <Plus className="h-4 w-4" />
            Agregar serie
          </Button>
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <div className="py-6 text-center text-sm text-muted-foreground">Cargando series...</div>
          ) : isError ? (
            <div className="py-6 text-center text-sm text-red-600">
              No se pudieron cargar las series. Intenta nuevamente en unos momentos.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Serie</TableHead>
                    <TableHead>Tipo de documento</TableHead>
                    <TableHead>Último correlativo</TableHead>
                    <TableHead>Siguiente</TableHead>
                    <TableHead>Predeterminada</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {rows.map(({ definition, sequence }) => {
                    const nextCorrelative = sequence?.nextCorrelative ?? null;

                    const lastCorrelative =
                      nextCorrelative !== null ? Math.max(0, nextCorrelative - 1) : null;

                    const isSettingThisDefault =
                      setDefaultSequence.isPending &&
                      setDefaultSequence.variables?.taxDocumentType ===
                        definition.taxDocumentType &&
                      setDefaultSequence.variables?.series === definition.series;

                    return (
                      <TableRow key={`${definition.taxDocumentType}-${definition.series}`}>
                        <TableCell className="font-bold">{definition.series}</TableCell>

                        <TableCell className="text-xs">
                          {getDocumentTypeLabel(definition.taxDocumentType)}
                        </TableCell>

                        <TableCell>
                          {lastCorrelative === null ? (
                            <span className="text-muted-foreground">No configurado</span>
                          ) : (
                            lastCorrelative
                          )}
                        </TableCell>

                        <TableCell className="font-mono text-xs">
                          {nextCorrelative === null ? (
                            <span className="text-muted-foreground">No configurado</span>
                          ) : (
                            `${definition.series}-${String(nextCorrelative).padStart(8, "0")}`
                          )}
                        </TableCell>

                        <TableCell>
                          {sequence?.isDefault ? (
                            <Badge variant="secondary">Predeterminada</Badge>
                          ) : sequence ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="gap-1.5 text-muted-foreground"
                              disabled={isSettingThisDefault}
                              onClick={() =>
                                setDefaultSequence.mutate({
                                  taxDocumentType: definition.taxDocumentType,
                                  series: definition.series,
                                })
                              }
                            >
                              {isSettingThisDefault ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Star className="h-3.5 w-3.5" />
                              )}
                              Marcar
                            </Button>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>

                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-2"
                              onClick={() => {
                                setIsAddingSeries(false);
                                setSelectedDefinition(definition);
                              }}
                            >
                              <Settings2 className="h-4 w-4" />
                              Gestionar
                            </Button>

                            <Button
                              variant="outline"
                              size="icon-sm"
                              disabled={!sequence}
                              title={
                                sequence
                                  ? "Eliminar serie"
                                  : "No hay nada que eliminar: esta serie no está configurada"
                              }
                              onClick={() => sequence && setSequenceToDelete(sequence)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <ManageSunatDocumentSequenceModal
        isOpen={selectedDefinition !== null || isAddingSeries}
        onClose={closeManageModal}
        sequence={isAddingSeries ? null : selectedSequence}
        definition={isAddingSeries ? null : selectedDefinition}
        existingSequences={sequences}
      />

      <DeleteSunatDocumentSequenceDialog
        isOpen={sequenceToDelete !== null}
        onClose={() => setSequenceToDelete(null)}
        sequence={sequenceToDelete}
        documentTypeLabel={
          sequenceToDelete ? getDocumentTypeLabel(sequenceToDelete.taxDocumentType) : ""
        }
      />
    </div>
  );
}
