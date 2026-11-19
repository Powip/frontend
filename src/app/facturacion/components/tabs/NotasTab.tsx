"use client";

import { FileMinus, Plus, Printer } from "lucide-react";
import { BetaBanner } from "@/app/facturacion/components/BetaBanner";
import {
  imprimirNotaCreditoPdf,
  type NotaIssuer,
} from "@/app/facturacion/lib/imprimir-nota-credito-pdf";
import { formatMotivoNota } from "@/app/facturacion/lib/motivos-nota-credito";
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
import type { useFacturacionMock } from "@/hooks/useFacturacionMock";
import type { Nota } from "@/types/facturacion";

interface NotasTabProps {
  mock: ReturnType<typeof useFacturacionMock>;
  hasAceptados: boolean;
  onNuevaNota: () => void;
  /** RUC emisor con el que se imprime cada nota. */
  getIssuer: (nota: Nota) => NotaIssuer | undefined;
}

export function NotasTab({ mock, hasAceptados, onNuevaNota, getIssuer }: NotasTabProps) {
  const { notas } = mock;

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

      <BetaBanner>
        Las notas que emitas aquí quedan solo en esta sesión de vista previa; no se envían a SUNAT.
      </BetaBanner>

      <Card>
        <CardHeader>
          <CardTitle>Historial de Notas</CardTitle>
          <CardDescription>BC01 = NC sobre boletas · FC01 = NC sobre facturas</CardDescription>
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
                    const notaKey = [nota.num, nota.original, nota.fecha, nota.motivo].join("-");

                    return (
                      <TableRow key={notaKey}>
                        <TableCell className="text-xs whitespace-nowrap">{nota.fecha}</TableCell>

                        <TableCell className="font-medium">{nota.num}</TableCell>

                        <TableCell className="text-xs">{nota.original}</TableCell>

                        <TableCell className="text-xs">{nota.cliente}</TableCell>

                        <TableCell className="text-xs">{formatMotivoNota(nota)}</TableCell>

                        <TableCell className="text-right font-bold">
                          S/ {nota.monto.toFixed(2)}
                        </TableCell>

                        <TableCell>
                          <Badge className="bg-green-100 text-green-700 hover:bg-green-100 dark:bg-green-950 dark:text-green-300">
                            {nota.estado}
                          </Badge>
                        </TableCell>

                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 gap-1 text-xs"
                            onClick={() => imprimirNotaCreditoPdf(nota, getIssuer(nota))}
                            title={`Imprimir PDF de ${nota.num}`}
                          >
                            <Printer className="h-3.5 w-3.5" />
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
