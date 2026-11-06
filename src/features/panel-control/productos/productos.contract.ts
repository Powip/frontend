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
  endpointActual: "GET /panel/productos (ms-ventas)",
  estado: "parcial",
  pantallas: ["canales"],
  roles: ROLES_GESTION,
  camposRestringidos: ["actual.productos[].costoUnitario", "actual.productos[].margen"],
  respuesta: "PanelEnvelope<ProductosPanel>",
  pendientes: [
    REGLA_VENTA_PENDIENTE,
    "CONECTADO: KPIs, ventas diarias, productos por variante, cupones y categorías. Σ productos = Σ categorías = Σ días = «Vendí». Descuentos = precio de lista − neto de la línea",
    "Cada variante es un producto propio (variante fusionada > variante > SKU); el producto base y la variante salen del nombre y de los atributos de la línea",
    "Cupones: salen de external_data de Shopify (los demás canales no tienen) y se normalizan: «QUANTITY DISCOUNT -39.00» y «UPSELL -30» son el mismo descuento",
    "Producto, cupón y categoría abren los PEDIDOS que contienen ese ítem; el porProducto del drawer trae la parte de cada producto",
    "PENDIENTE: stock (vive en ms-logistics); costo unitario y margen solo cuando TODAS las líneas del producto tienen costo (unit_cost solo desde octubre, ~24 % de las líneas)",
    "PENDIENTE: la categoría viene del import (muchas líneas sin categoría o con la categoría «Shopify»)",
    COMPARACION_PENDIENTE,
  ],
});
