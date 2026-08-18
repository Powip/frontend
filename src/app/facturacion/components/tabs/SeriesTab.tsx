"use client";

import { Settings2 } from "lucide-react";
import { useState } from "react";
import { BetaBanner } from "@/app/facturacion/components/BetaBanner";
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
import {
  DEFAULT_SUNAT_DOCUMENT_SEQUENCES,
  SUNAT_DOCUMENT_TYPES,
} from "@/features/sunat/sunat-document/enums/sunat-document.enums";
import { useSunatDocumentSequence } from "@/features/sunat/sunat-document-sequence/hooks/use-sunat-document-sequence";
import type { SunatDocumentSequence } from "@/features/sunat/sunat-document-sequence/models/sunat-document-sequence";
import { ManageSunatDocumentSequenceModal } from "../modals/ManageSunatDocumentSequenceModal";

const SUNAT_DOCUMENT_TYPE_LABELS: Record<string, string> = {
  "01": "Factura",
  "03": "Boleta de venta",
  "07": "Nota de crédito",
  "08": "Nota de débito",
};

export function SeriesTab() {
  const [selectedDefinition, setSelectedDefinition] = useState<
    (typeof DEFAULT_SUNAT_DOCUMENT_SEQUENCES)[number] | null
  >(null);

  const invoiceQuery = useSunatDocumentSequence({
    taxDocumentType: SUNAT_DOCUMENT_TYPES.INVOICE,
    series: "F001",
  });

  const salesReceiptQuery = useSunatDocumentSequence({
    taxDocumentType: SUNAT_DOCUMENT_TYPES.SALES_RECEIPT,
    series: "B001",
  });

  const creditNoteQuery = useSunatDocumentSequence({
    taxDocumentType: SUNAT_DOCUMENT_TYPES.CREDIT_NOTE,
    series: "FC01",
  });

  const debitNoteQuery = useSunatDocumentSequence({
    taxDocumentType: SUNAT_DOCUMENT_TYPES.DEBIT_NOTE,
    series: "FD01",
  });

  const queries = [invoiceQuery, salesReceiptQuery, creditNoteQuery, debitNoteQuery];

  const rows = DEFAULT_SUNAT_DOCUMENT_SEQUENCES.map((definition, index) => ({
    definition,
    sequence: queries[index].data ?? null,
    isError: queries[index].isError,
  }));

  const isLoading = queries.some((query) => query.isLoading);

  const selectedSequence: SunatDocumentSequence | null = selectedDefinition
    ? (rows.find(
        ({ definition }) =>
          definition.taxDocumentType === selectedDefinition.taxDocumentType &&
          definition.series === selectedDefinition.series,
      )?.sequence ?? null)
    : null;

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
        <CardHeader>
          <CardTitle className="text-base">Series configuradas</CardTitle>
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <div className="py-6 text-center text-sm text-muted-foreground">Cargando series...</div>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Serie</TableHead>
                    <TableHead>Tipo de documento</TableHead>
                    <TableHead>Último correlativo</TableHead>
                    <TableHead>Siguiente</TableHead>
                    <TableHead className="text-right">Acción</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {rows.map(({ definition, sequence, isError }) => {
                    const nextCorrelative = sequence ? Number(sequence.nextCorrelative) : null;

                    const lastCorrelative =
                      nextCorrelative !== null ? Math.max(0, nextCorrelative - 1) : null;

                    return (
                      <TableRow key={`${definition.taxDocumentType}-${definition.series}`}>
                        <TableCell className="font-bold">{definition.series}</TableCell>

                        <TableCell className="text-xs">
                          {SUNAT_DOCUMENT_TYPE_LABELS[definition.taxDocumentType]}
                        </TableCell>

                        <TableCell>
                          {isError ? (
                            <span className="text-red-600">Error</span>
                          ) : lastCorrelative === null ? (
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

                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-2"
                            onClick={() => setSelectedDefinition(definition)}
                          >
                            <Settings2 className="h-4 w-4" />
                            Gestionar
                          </Button>
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
        isOpen={selectedDefinition !== null}
        onClose={() => setSelectedDefinition(null)}
        sequence={selectedSequence}
        definition={selectedDefinition}
      />
    </div>
  );
}
