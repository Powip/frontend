"use client";

import { FileMinus, Loader2, Plus, Printer } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  formatNotaFecha,
  getNotaEstado,
  getNotaMotivo,
  getNotaNumero,
  getNotaOriginal,
  isNotaImprimible,
} from "@/app/facturacion/lib/notas-credito";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { SunatDocument } from "@/features/sunat/sunat-document/models/sunat-document.model";

interface NotasTabProps {
  /** Notas de crédito reales (tipo 07) guardadas en el backend, más nuevas primero. */
  notas: SunatDocument[];
  /** Todos los documentos SUNAT de la empresa, para mostrar el comprobante original. */
  documents: readonly SunatDocument[];
  hasAceptados: boolean;
  onNuevaNota: () => void;
  /** Abre el PDF real de la nota (representación impresa del backend). */
  onImprimir: (nota: SunatDocument) => Promise<void>;
}

export function NotasTab({
  notas,
  documents,
  hasAceptados,
  onNuevaNota,
  onImprimir,
}: NotasTabProps) {
  const [printingId, setPrintingId] = useState<string | null>(null);

  const imprimir = async (nota: SunatDocument) => {
    setPrintingId(nota.id);
    try {
      await onImprimir(nota);
    } catch (error) {
      console.error("Error al abrir el PDF de la nota de crédito:", error);
      toast.error("No se pudo abrir el PDF de la nota. Intenta nuevamente.");
    } finally {
      setPrintingId(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">Notas de Crédito y Débito</h2>
          <p className="text-sm text-muted-foreground">
            Anula, corrige o modifica un comprobante ya emitido y aceptado por SUNAT.
          </p>
        </div>

        <Button
          className="bg-primary hover:bg-primary/90 text-white gap-1.5"
          onClick={onNuevaNota}
          disabled={!hasAceptados}
        >
          <Plus className="h-4 w-4" />
          Nueva Nota de Crédito
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Historial de Notas</CardTitle>
          <CardDescription>
            Se envían a SUNAT y quedan guardadas. FC = NC sobre facturas · BC = NC sobre boletas
          </CardDescription>
        </CardHeader>

        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>N° Nota</TableHead>
                  <TableHead>Comprobante Original</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {notas.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center h-40 text-muted-foreground">
                      <FileMinus className="h-6 w-6 mx-auto mb-2 opacity-40" />
                      Aún no has emitido notas de crédito
                    </TableCell>
                  </TableRow>
                ) : (
                  notas.map((nota) => {
                    const estado = getNotaEstado(nota);
                    const numero = getNotaNumero(nota);

                    return (
                      <TableRow key={nota.id}>
                        <TableCell className="text-xs whitespace-nowrap">
                          {formatNotaFecha(nota.issueDate)}
                        </TableCell>

                        <TableCell className="font-medium">{numero}</TableCell>

                        <TableCell className="text-xs">
                          {getNotaOriginal(nota, documents)}
                        </TableCell>

                        <TableCell className="text-xs">
                          {nota.taxDocumentPayload?.customer?.name ?? "—"}
                        </TableCell>

                        <TableCell className="text-xs">{getNotaMotivo(nota)}</TableCell>

                        <TableCell className="text-right font-bold">
                          S/ {Number(nota.taxDocumentPayload?.totals?.grandTotal ?? 0).toFixed(2)}
                        </TableCell>

                        <TableCell>
                          <Badge className={estado.className} title={estado.detalle}>
                            {estado.label}
                          </Badge>
                        </TableCell>

                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 gap-1 text-xs"
                            onClick={() => imprimir(nota)}
                            disabled={!isNotaImprimible(nota) || printingId === nota.id}
                            title={
                              isNotaImprimible(nota)
                                ? `Imprimir PDF de ${numero}`
                                : "Disponible cuando SUNAT acepte la nota"
                            }
                          >
                            {printingId === nota.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Printer className="h-3.5 w-3.5" />
                            )}
                            Imprimir PDF
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
