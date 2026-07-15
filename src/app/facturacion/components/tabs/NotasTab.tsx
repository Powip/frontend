"use client";

import { FileMinus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BetaBanner } from "@/app/facturacion/components/BetaBanner";
import { useFacturacionMock } from "@/hooks/useFacturacionMock";

interface NotasTabProps {
  mock: ReturnType<typeof useFacturacionMock>;
  hasAceptados: boolean;
  onNuevaNota: () => void;
}

export function NotasTab({ mock, hasAceptados, onNuevaNota }: NotasTabProps) {
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
        <Button className="bg-primary hover:bg-primary/90 text-white gap-1.5" onClick={onNuevaNota} disabled={!hasAceptados}>
          <Plus className="h-4 w-4" /> Nueva Nota de Crédito
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
                </TableRow>
              </TableHeader>
              <TableBody>
                {notas.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center h-40 text-muted-foreground">
                      <FileMinus className="h-6 w-6 mx-auto mb-2 opacity-40" />
                      Aún no has emitido notas de crédito
                    </TableCell>
                  </TableRow>
                ) : (
                  notas.map((n, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-xs whitespace-nowrap">{n.fecha}</TableCell>
                      <TableCell className="font-medium">{n.num}</TableCell>
                      <TableCell className="text-xs">{n.original}</TableCell>
                      <TableCell className="text-xs">{n.cliente}</TableCell>
                      <TableCell className="text-xs">{n.motivo}</TableCell>
                      <TableCell className="text-right font-bold">S/ {n.monto.toFixed(2)}</TableCell>
                      <TableCell>
                        <Badge className="bg-green-100 text-green-700 hover:bg-green-100 dark:bg-green-950 dark:text-green-300">
                          {n.estado}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
