import {
  defineContract,
  REGLA_VENTA_PENDIENTE,
  ROLES_GESTION,
} from "../shared/data/contract-helpers";

export const CLIENTES_ZONAS_CONTRACT = defineContract({
  id: "clientes-zonas",
  titulo: "Clientes y zonas",
  metodo: "GET",
  endpoint: "/panel/clientes",
  endpointActual: "GET /panel/clientes (ms-ventas)",
  estado: "parcial",
  pantallas: ["canales"],
  roles: ROLES_GESTION,
  respuesta: "PanelEnvelope<ClientesZonasPanel>",
  pendientes: [
    "CONECTADO: clientes con compra, nuevos, recurrentes (nuevos + recurrentes = con compra), recompra, valor histórico, lista negra, zonas, departamentos, métodos de pago y los 10 mejores clientes",
    "El historial cubre desde el primer pedido de la empresa (historial.desde); un rechazo también cuenta como compra",
    "Lista negra = cliente con un rechazo anterior al pedido; RECHAZADO se reconoce como venta despachada que se anuló (salvo falta de stock) mientras no exista el estado",
    "Método de pago = el método que más suma entre los pagos que no se perdieron; los pedidos sin pagos van a «Sin pago registrado»",
    "Departamento: sale de la ciudad del cliente, unificada (mayúsculas, tildes); sin dato → «Sin dato». Zona: salesRegion",
    "Producto, cupón y categoría de otras subpestañas no aplican aquí; el historial de un cliente abre todas sus ventas de siempre",
    REGLA_VENTA_PENDIENTE,
  ],
});
