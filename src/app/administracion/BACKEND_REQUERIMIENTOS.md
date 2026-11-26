# Administración — qué falta del lado del backend

> Actualizado: 2026-11-26 (FEAT-34). Reemplaza la versión del 2026-09-02, que estaba desactualizada (decía que no
> existían `order_items.category_id/category_name` ni `order_items.unit_cost`, y sí existen).

## Cómo calcula hoy el módulo (Fase 2 de FEAT-34, front)

- Todas las pestañas salen de `_lib/useResultados.ts` y de resultados (`_lib/resultados.ts`). Para el mismo periodo,
  todas dan lo mismo.
- Las ventas llegan calculadas de ms-ventas: `GET /administracion/resultados` (totales, por día, canal, día × canal y
  producto; adelantos de pedidos en curso) y `GET /administracion/en-transito` (saldo en calle). `_lib/servidor.ts`
  solo suma y agrupa (grafías de canal, meses). El front ya no baja pedidos crudos.
- Venta = pedido ENTREGADO que no es LEAD, contada en el **día de entrega** (hora Lima, D1). Las que no tienen la
  entrada a ENTREGADO en el historial se fechan por su creación y la pantalla lo avisa.
- Envíos = flete por pedido (D9), con la nota de en cuántas entregas se conoce. Ya no se pide
  `shipping-guides/cost` a ms-courier.
- Costo = Σ `order_items.unit_cost × quantity` si todas las líneas lo tienen; si ninguna, `orderHeader.cost_amount`
  (> 0); con costo parcial o sin ninguno, la venta queda «sin costo» y la pantalla lo avisa.
- Gastos mensuales repartidos por los días del periodo. Publicidad = consumo conectado (módulo de publicidad) +
  Gastos › Publicidad.

## Fase 2 — backend (un PR por servicio)

1. **`order-header/company` en hora Lima** (`buildPeruDateRangeUTC`, como `findByStoreId`). El front ya lo compensa;
   con esto deja de pedir un día de más.
2. **Resultados calculados en el servidor** por **fecha de entrega** (`order_status_history`, `to_status =
   'ENTREGADO'`, D1), con agregados por mes, día, canal y producto. Reutiliza el repositorio del Panel v5
   (`panel.repository.ts`: zona horaria y costos null bien tratados). Administración deja de bajar pedidos crudos.
   Hay que rotular en pantalla que Administración (por entrega) y Panel › Finanzas (por creación) difieren a propósito.
3. **`cost_amount`**: calcularlo también en `createDraft` (YaVendió, Aliclik, Shopify INCOMPLETE, Sheets), en la
   importación Excel y en Live combinado; recalcularlo con el costo real al despachar (hoy solo se pisa
   `order_items.unit_cost`). **Backfill** desde el precio de compra de la variante (D7, con OK aparte). Medido el
   26-11: 1.730 entregados de 90 días con costo 0 y **ninguna** línea con `unit_cost`.
4. **`advertising_delivered_at`**: backfill desde el historial de estados (D7, con OK aparte) y que el conteo de
   «entregados sin fecha» que bloquea la base Entregados se limite al periodo.
5. **Flete (D9)**: `carrier_shipping_cost` del pedido, con la cotización de Shalom como respaldo y sin guías
   CANCELADA ni FALLIDA (hoy `shipping-guides/cost` solo suma Shalom e incluye anuladas).
6. **Merma**: que las mermas aprobadas en Almacén (ajustes `kind: 'merma'`) lleguen a `inventory_shrinkage`.

## Fase 3 — lo que todavía vive en el navegador

- Metas anuales (`_lib/metasStorage.ts`) → backend. `ventas.panel_metas` no tiene metas anuales de ventas, utilidad
  ni margen: hay que agregarlas.
- Retirar la inversión manual de publicidad (`_lib/pautaStorage.ts`, D2). Ya no entra en ningún cálculo.
- Capital y ROI, cuentas por pagar y objetivos diarios por canal (`capitalStorage`, `cuentasStorage`,
  `objetivoStorage`): fuera del menú hasta tener backend (D6).

## Seguridad (fuera de alcance, lista de FEAT-23)

Sin guard: `GET company/:id/gastos`, `company/:id/marketplace-config`, `shipping-guides/cost`, `product-variant/:id`.
