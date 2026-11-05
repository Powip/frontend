import { defineContract, ROLES_GESTION } from "../shared/data/contract-helpers";

export const EXPORTACION_LIBRO_CONTRACT = defineContract({
  id: "exportacion-libro",
  titulo: "Excel completo",
  metodo: "GET",
  endpoint: "/panel/export.xlsx",
  estado: "conectado",
  pantallas: [
    "resumen",
    "canales",
    "callcenter",
    "operaciones",
    "finanzas",
    "equipo",
    "configuracion",
  ],
  roles: ROLES_GESTION,
  capacidadRequerida: "exportar_libro",
  camposRestringidos: ["columnas de costo, margen, ganancia y comisión (solo Dueño)"],
  respuesta: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pendientes: [
    "CONECTADO: GET /panel/export.xlsx genera en el servidor el libro de 9 hojas (Resumen, Canales, Pedidos, Productos, Vendedoras, Confirmadoras, Couriers, Departamentos, Cuadres); solo Dueño",
    "El nombre viene del Content-Disposition (powip_panel_AAAA-MM-DD_AAAA-MM-DD.xlsx); los errores 403/400/503 llegan como JSON dentro del blob",
  ],
});

export const COMPARTIR_REPORTE_CONTRACT = defineContract({
  id: "compartir-reporte",
  titulo: "Compartir reporte (WhatsApp)",
  metodo: "GET",
  endpoint: "/panel/compartir",
  estado: "conectado",
  pantallas: ["resumen"],
  roles: ROLES_GESTION,
  camposRestringidos: ["producto", "envios", "gananciaSobreEntregado"],
  respuesta: "CompartirReporteResponse",
  pendientes: [
    "CONECTADO: GET /panel/compartir (solo Dueño), objeto plano con el texto listo para pegar; una sola ganancia (sobre lo entregado)",
    "Publicidad y CPA salen sin dato mientras Publicidad sea «Próximamente»; «Me deben» es la deuda con couriers (Cobranza)",
  ],
});
