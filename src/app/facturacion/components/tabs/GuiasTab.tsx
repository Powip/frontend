"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Plus, Truck } from "lucide-react";
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
import { ESTADOS_GUIA, MOTIVOS_TRASLADO } from "@/types/facturacion";
import { useFacturacionMock } from "@/hooks/useFacturacionMock";
import { ComprobanteRow } from "@/hooks/useComprobantesSunat";
import GuiaRemisionModal from "@/app/facturacion/components/modals/GuiaRemisionModal";

interface GuiasTabProps {
  mock: ReturnType<typeof useFacturacionMock>;
  comprobanteRows: ComprobanteRow[];
}

export function GuiasTab({ mock, comprobanteRows }: GuiasTabProps) {
  const { guias, almacenes, emitirGuia } = mock;
  const [modalOpen, setModalOpen] = useState(false);

  const pedidos = useMemo(
    () =>
      comprobanteRows.slice(0, 30).map((r) => ({
        id: r.sale.id,
        orderNumber: r.sale.orderNumber,
        cliente: r.sale.customer.fullName,
        fullNumber: r.fullNumber,
      })),
    [comprobanteRows]
  );

  const aceptadas = guias.filter((g) => g.estado === "ACEPTADA").length;
  const pendientes = guias.filter((g) => g.estado === "GENERADA" || g.estado === "ENVIADA_SUNAT").length;
  const rechazadas = guias.filter((g) => g.estado === "RECHAZADA").length;

  return (
    <div className="space-y-5">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">Guías de Remisión Electrónica</h2>
          <p className="text-sm text-muted-foreground">
            GRE-Remitente: sustenta el traslado de mercadería desde tu almacén hasta el cliente o entre tiendas.
          </p>
        </div>
        <Button className="bg-primary hover:bg-primary/90 text-white gap-1.5" onClick={() => setModalOpen(true)} disabled={!pedidos.length}>
          <Plus className="h-4 w-4" /> Emitir Guía de Remisión
        </Button>
      </div>

      <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40 px-4 py-3 text-sm">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
        <div>
          <span className="font-semibold">Se emite ANTES de que el paquete salga del almacén. </span>
          No al momento de la entrega. SUNAT sanciona su omisión desde el 1 de julio de 2026, y desde el 1 de junio de 2026 rigen
          validaciones más estrictas.
        </div>
      </div>

      <BetaBanner>
        Este módulo se muestra con fines de vista previa: las guías creadas aquí no se envían a SUNAT ni se guardan en el backend.
      </BetaBanner>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Aceptadas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{aceptadas}</div>
            <p className="text-[11px] text-muted-foreground mt-1">Válidas ante SUNAT</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Pendientes de envío</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{pendientes}</div>
            <p className="text-[11px] text-muted-foreground mt-1">Antes de que salga el paquete</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Rechazadas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{rechazadas}</div>
            <p className="text-[11px] text-muted-foreground mt-1">Requieren corrección</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total emitidas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{guias.length}</div>
            <p className="text-[11px] text-muted-foreground mt-1">Histórico de la sesión</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Guías Emitidas</CardTitle>
          <CardDescription>La guía queda ligada al comprobante cuando este ya fue emitido.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Pedido</TableHead>
                  <TableHead>Origen → Destino</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead>Modalidad</TableHead>
                  <TableHead>Doc. relacionado</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {guias.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center h-40 text-muted-foreground">
                      <Truck className="h-6 w-6 mx-auto mb-2 opacity-40" />
                      Aún no has emitido guías de remisión
                    </TableCell>
                  </TableRow>
                ) : (
                  guias.map((g) => {
                    const alm = almacenes.find((a) => a.id === g.almacenId);
                    const mot = MOTIVOS_TRASLADO.find((m) => m.code === g.motivo);
                    const estado = ESTADOS_GUIA[g.estado];
                    return (
                      <TableRow key={g.id}>
                        <TableCell className="text-xs whitespace-nowrap">{g.fecha}</TableCell>
                        <TableCell>
                          <div className="font-medium">{g.pedido}</div>
                          <div className="text-[10px] text-muted-foreground">{g.fullNumber || "Sin número"}</div>
                        </TableCell>
                        <TableCell className="text-xs">
                          {alm?.nombre || "—"} → {g.destino}
                        </TableCell>
                        <TableCell className="text-xs">{mot?.label || g.motivo}</TableCell>
                        <TableCell className="text-xs">{g.modalidad === "02" ? "Privado" : "Público"}</TableCell>
                        <TableCell className="text-xs">{g.docRelacionado || <span className="text-muted-foreground">Sin comprobante aún</span>}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`border-transparent font-semibold ${estado.badgeClassName}`}>
                            {estado.label}
                          </Badge>
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

      <GuiaRemisionModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        almacenes={almacenes}
        pedidos={pedidos}
        emitirGuia={emitirGuia}
      />
    </div>
  );
}
