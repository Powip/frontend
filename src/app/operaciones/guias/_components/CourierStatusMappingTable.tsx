"use client";

/* -----------------------------------------------------------------------
   Mapeo de estados courier → Powip — tabla de referencia (solo lectura).
   Documenta cómo se traduce HOY el estado de Shalom a un badge de Powip,
   según la lógica ya hardcodeada en
   src/app/centro-envios/components/shipmentUtils.tsx (ShipmentBadge /
   IntegrationBadge). No es una pantalla de configuración: ese mapeo hoy
   vive embebido en el frontend, no es editable ni consultable desde
   backend — ver BACKEND GAP al pie.
------------------------------------------------------------------------ */

interface MappingRow {
  estadoOrden: string;
  shalomStatus: string;
  badgePowip: string;
  descripcion: string;
}

const ROWS: MappingRow[] = [
  {
    estadoOrden: "PREPARADO / LLAMADO",
    shalomStatus: "—",
    badgePowip: "Preparado",
    descripcion: "Aún no despachado a ningún courier.",
  },
  {
    estadoOrden: "ASIGNADO_A_GUIA",
    shalomStatus: "—",
    badgePowip: "Asignado a guía",
    descripcion: "Tiene guía creada pero la guía todavía no fue aprobada/enviada.",
  },
  {
    estadoOrden: "EN_ENVIO",
    shalomStatus: "(sin dato / EN_TRANSITO)",
    badgePowip: "En tránsito",
    descripcion: "Despachado, sin estado específico reportado por Shalom todavía.",
  },
  {
    estadoOrden: "EN_ENVIO",
    shalomStatus: "EN_DESTINO",
    badgePowip: "En agencia",
    descripcion: "Paquete llegó a la agencia de destino, pendiente de recojo/reparto.",
  },
  {
    estadoOrden: "EN_ENVIO",
    shalomStatus: "ENTREGADO",
    badgePowip: "Entregado (courier)",
    descripcion: "Shalom reporta entrega, pero el pedido de Powip sigue en EN_ENVIO hasta confirmarse.",
  },
  {
    estadoOrden: "EN_ENVIO",
    shalomStatus: "DEVUELTO",
    badgePowip: "Devuelto ⚠️",
    descripcion: "Entrega fallida — dispara \"Necesita Atención\" en Pedidos y el Tablero.",
  },
  {
    estadoOrden: "ENTREGADO",
    shalomStatus: "ENTREGADO / EXITOSO",
    badgePowip: "Entregado ✅",
    descripcion: "Confirmado en Powip (no solo reportado por el courier).",
  },
];

export default function CourierStatusMappingTable() {
  return (
    <div className="space-y-3">
      <div>
        <h3 className="font-bold">Mapeo de estados courier → Powip</h3>
        <p className="text-xs text-muted-foreground">
          Referencia de solo lectura — cómo se traduce hoy el estado de Shalom al badge que ven Operaciones y el
          Tablero.
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2">Estado pedido (Powip)</th>
                <th className="px-3 py-2">Estado Shalom</th>
                <th className="px-3 py-2">Badge mostrado</th>
                <th className="px-3 py-2">Qué significa</th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row, idx) => (
                <tr key={idx} className="border-t">
                  <td className="px-3 py-2 font-mono text-xs">{row.estadoOrden}</td>
                  <td className="px-3 py-2 font-mono text-xs">{row.shalomStatus}</td>
                  <td className="px-3 py-2 font-semibold">{row.badgePowip}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{row.descripcion}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
