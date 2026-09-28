import {
  COMPARACION_PENDIENTE,
  defineContract,
  REGLA_VENTA_PENDIENTE,
  ROLES_GESTION,
} from "../shared/data/contract-helpers";

export const PRODUCTOS_CONTRACT = defineContract({
  id: "productos",
  titulo: "Productos",
  metodo: "GET",
  endpoint: "/panel/productos",
  estado: "pendiente",
  pantallas: ["canales"],
  roles: ROLES_GESTION,
  camposRestringidos: ["actual.productos[].costoUnitario", "actual.productos[].margen"],
  respuesta: "PanelEnvelope<ProductosPanel>",
  pendientes: [
    REGLA_VENTA_PENDIENTE,
    "Precio neto real por ítem (precio − descuento − cupón); nunca precio de lista",
    "Costo unitario con vigencia y nullable: sin costo → null para mostrar «—»",
    COMPARACION_PENDIENTE,
  ],
});
