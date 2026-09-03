# Requerimientos de Backend — Módulo Administración

> Fecha: 2026-09-02
> Frontend: `src/app/administracion/`
> Referencia funcional: `POWIP_Administracion_DocTecnica_Devs_v1.pdf`

Este documento junta dos cosas distintas que se suelen mezclar pero necesitan trabajo diferente:

1. **Rendimiento** — endpoints que hay que construir para que el módulo no se caiga de rendimiento con volumen real de datos. Hoy funciona porque se prueba con pocos pedidos; con miles de pedidos/mes se vuelve pesado.
2. **Datos faltantes** — funcionalidad que hoy vive en `localStorage` del navegador (puente temporal, sin backend) o que está directamente bloqueada/oculta porque no hay ninguna fuente de datos de la que partir.

Todo lo de la sección 2 que dice "puente en localStorage" **ya funciona en el frontend** — no es trabajo de frontend pendiente, es trabajo de backend para centralizarlo y que se comparta entre usuarios/dispositivos.

---

## 1. Rendimiento — qué mover a backend

El patrón que domina el módulo hoy: **traer pedidos crudos (`OrderHeader[]`, con `items` y `payments` anidados) para un rango de fechas, y agregarlos en el navegador**. Funciona con poco volumen; no escala.

### 1.1 Agregado mensual de P&L (prioridad más alta)

Usado por `_lib/useMonthlyPnl.ts` → **Flujo de Caja, Resumen Anual, Capital & ROI**. Cada carga de página hoy hace:
- 1 fetch de **todos los pedidos de los 12 meses** (con items+payments anidados) — Resumen Anual lo hace **dos veces** (año actual + año anterior)
- **12 llamadas HTTP separadas** a `getCourierCost` (una por mes, N+1 clásico)

**Pedido:**
```
GET /reports/company/:id/monthly-pnl?anio=2026
```
```json
[
  { "mes": 1, "ventas": 25420, "cogs": 6350, "unidades": 254, "gastosFijos": 10450, "courierCost": 4128, "profit": 875 },
  { "mes": 2, "...": "..." }
]
```
Reemplaza el fetch de un año completo de pedidos + las 12 llamadas de courier por una sola respuesta liviana.

### 1.2 Ventas agregadas por canal / producto / día

Usado por `_lib/realData.ts` (`agruparPorCanal`, `agruparPorDia`, `ventasPorProductoEnCanal`) → **Control diario, Pauta por canal, Canales & Marketplaces**. Hoy se descarga el pedido completo con todos sus `items` solo para sumar por SKU/canal/día.

**Pedido:**
```
GET /reports/company/:id/ventas?groupBy=canal,dia&from=&to=
GET /reports/company/:id/ventas?groupBy=canal,producto&from=&to=
```
Filas ya sumadas en vez de pedidos crudos.

### 1.2b Costo de variante en batch (Margen x Producto)

`margen-producto/page.tsx` hace **un `fetch` por cada SKU distinto vendido en el periodo** contra `NEXT_PUBLIC_API_PRODUCTOS/product-variant/:id` — con catálogos grandes, decenas o cientos de llamadas HTTP en paralelo solo para esta página.

**Pedido:**
```
GET /product-variant/batch?ids=id1,id2,id3,...
```
Una sola llamada que devuelva `priceBase` de todas las variantes pedidas.

### 1.3 Balance por courier

Usado por `agruparPorCourier` → **Cuentas x Cobrar/Pagar, Liquidaciones**. Recorre 60-90 días de pedidos para calcular cuánto debe cada courier. **Ya está especificado** en `src/components/finanzas/BACKEND_REQUERIMIENTOS.md`:
```
GET /shipping-guides/store/:storeId/couriers/resumen
```
Solo falta que se implemente — ver ese archivo para el shape completo.

### 1.4 Saldos COD en tránsito / adelantos pendientes

Usado en **Cuentas, Reporte rápido, Flujo de Caja** (`enTransito`, cálculo de adelantos). Escanea 45-90 días de pedidos para sumar montos que el backend podría mantener como total corriente.

**Pedido:**
```
GET /reports/company/:id/saldo-cod-transito
GET /reports/company/:id/adelantos-pendientes
```

### 1.5 P&L agregado por periodo (menor urgencia)

**Resumen, Gastos, Utilidad, Equilibrio, Margen x Producto** — mismo patrón, menor severidad porque el rango suele ser un mes. Resumen lo hace **dos veces** (periodo actual + anterior para las flechas de variación).

**Pedido (a mediano plazo):**
```
GET /reports/company/:id/pnl?from=&to=
```

### Prioridad
| # | Endpoint | Elimina |
|---|---|---|
| 1 | `monthly-pnl` | 2 fetches de año completo + 12-24 llamadas de courier |
| 2 | Ventas agregadas por canal/producto/día | Descargar `items` de cada pedido solo para sumarlos |
| 3 | Balance por courier (ya especificado) | Recorrer 60-90 días de pedidos en 2 pantallas |
| 4 | Saldos en tránsito / adelantos | Recorrer pedidos en 2-3 pantallas más |
| 5 | `pnl` por periodo | El doble-fetch de Resumen y las sumas en JS del resto |

---

## 2. Datos faltantes — entidades que no existen

### 2.1 Ya bridgeadas en `localStorage` (funcionan hoy, pero solo en este navegador — no se comparten entre usuarios ni dispositivos)

| Entidad real que falta | Dónde vive el puente hoy | Desbloquea |
|---|---|---|
| `pauta_registro` + `pauta_linea` (§20 doc) | `_lib/pautaStorage.ts` | Pauta por canal, Control diario (inversión/CPO/CPV/ROAS), Reporte rápido (publicidad/CPA/ROAS), Flujo de Caja (fila Publicidad), Resumen Anual (CPV/ROAS), Resumen (hero + semáforo) |
| `meta` (ventas/profit/margen por año) | `_lib/metasStorage.ts` | Resumen Anual, Reporte rápido (meta mensual), Resumen (avance del mes) |
| `capital_entry` + `prestamo_cuota` | `_lib/capitalStorage.ts` | Capital & ROI (arranca vacío, ya no muestra datos de ejemplo) |
| `cuenta_cxcp` + `movimiento` (para lo manual) | `_lib/cuentasStorage.ts` | Cuentas x Cobrar/Pagar (entradas manuales, confirmaciones, historial) |
| Confirmaciones de liquidación de courier | `_lib/liquidacionesStorage.ts` (compartido con Cuentas x Cobrar/Pagar — antes cada página tenía su propio set y confirmar en una no se reflejaba en la otra) | Liquidaciones, Cuentas x Cobrar/Pagar |
| Objetivo de CPV / presupuesto / meta de ventas por canal | `_lib/objetivoStorage.ts` | Control diario ("Cumplimiento vs objetivo") |

**Riesgo de reconciliación — gasto publicitario con dos caminos posibles:** "Publicidad" existe como categoría seleccionable tanto en Gastos & Costos (`IGastoOperativo`, categoria `PUBLICIDAD`) como en Pauta por canal (`pauta_registro`, vía `localStorage`). Son dos fuentes independientes que nada obliga a mantener sincronizadas — si una empresa carga el mismo gasto en ambos lugares, Flujo de Caja lo sumaba dos veces (bug ya corregido en `flujo/page.tsx`, restando la categoría `PUBLICIDAD` de `gastosFijos` antes de sumar la fila de Pauta). Resumen y Utilidad & Margen no duplican el total (cada uno usa una sola fuente por número), pero sí pueden mostrar dos cifras de "publicidad" no reconciliadas entre sí (una en el P&L vía Gastos, otra en el hero/semáforo vía Pauta). La resolución real es de producto/backend: decidir una sola fuente de verdad para gasto publicitario — lo más consistente con el resto del módulo es que `PUBLICIDAD` deje de ser una categoría de `IGastoOperativo` y todo pase por `pauta_registro`.

**Para centralizar cualquiera de estos:** reemplazar el hook de `localStorage` por queries/mutations de React Query contra el endpoint real — el resto de cada página no cambia, porque ya está separado en `_lib/*Storage.ts`.

### 2.2 Genuinamente bloqueadas — no hay ni un puente posible sin backend

| Falta | Por qué | Dónde se nota |
|---|---|---|
| Estado "confirmado" distinto en `OrderStatus` | Solo existe `INCOMPLETE\|PREVENTA\|PENDIENTE\|PREPARADO\|LLAMADO\|ASIGNADO_A_GUIA\|EN_ENVIO\|ENTREGADO\|ANULADO\|PAGADO` — nada mapea a "confirmado" del modelo COD del doc (§3) | Tasa de confirmación (semáforo COD de Resumen — **card quitada de la UI**, no se puede mostrar ni con puente) |
| Campo `estado` (Pagado/Pendiente/Vencido) en `IGastoOperativo` | La respuesta de `getGastos` no lo trae | "Por pagar" automático en Cuentas x Cobrar/Pagar — solo funciona lo que se agrega manual |
| Campo de tienda en `IGastoOperativo` | Los gastos no dicen a qué tienda pertenecen | "Profit por tienda" en Resumen Anual (solo "ventas por tienda" es real, por `storeId` en pedidos) |
| Entidad de comisiones/metas por vendedor | No existe nada — ni una tabla remotamente parecida | Liquidaciones → Vendedoras (**sección quitada de la UI**, no hay nada de lo que partir) |
| `SalesChannel` con más valores | Solo hay 7 genéricos (`TIENDA_FISICA\|WHATSAPP\|INSTAGRAM\|FACEBOOK\|MARKETPLACE\|MERCADOLIBRE\|OTRO`) — sin TikTok, sin Falabella/Ripley por separado, sin distinguir Web Pasarela de Web COD | Control diario, Pauta por canal, Canales — funcionan, pero con canales más gruesos que los 8 del doc |
| Categoría de producto en `OrderItem` — **⚠ revisar, puede que ya no aplique** | El comentario original de `realData.ts`/`pauta.ts` dice que no existe, pero `OrderItemResponseDto` (`src/api/sales/dto/order.dto.ts:59-60`) sí declara `categoryId`/`categoryName` — es el DTO de un endpoint hermano (`order-header/store/:id`), no confirmado todavía que `getOrdersByCompany` (`order-header/company/:id`) devuelva esos campos poblados. Vale la pena loguear una respuesta real y confirmar antes de asumir que sigue bloqueado | Pauta por canal — si el campo viene poblado, la atribución por categoría (§8 doc) podría implementarse sin ningún cambio de backend |
| Costo por ítem en `OrderItem` | Solo existe `costAmount` a nivel de pedido completo (`models/sales/order.ts`), no desglosado por SKU/variante | Margen x Producto — no puede calcular el costo real al momento de la venta, usa el costo *actual* del catálogo (`ms-products`) como proxy, lo que desalinea el margen si el costo cambió después de vender |
| 8 endpoints de liquidación de courier (detalle de guía, registrar pago, reasignar, etc.) | Ver `src/components/finanzas/BACKEND_REQUERIMIENTOS.md` | Liquidaciones — "Confirmar" solo oculta la fila en este dispositivo, no registra el cobro real |
| Validación de `channel` en `IMarketplaceConfig` contra el enum real de `SalesChannel` | El DTO de creación/actualización acepta cualquier string — el frontend ahora restringe el selector a los 7 valores reales, pero un config creado por otro cliente/script contra la API puede quedar huérfano (nunca hace match con ningún pedido) | Canales & Marketplaces — configs de fee que nunca aplican, sin ningún aviso |

---

## Apéndice — qué depende de qué, por página

| Página | Real (backend actual) | Puente localStorage | Bloqueado sin backend |
|---|---|---|---|
| Reporte rápido | Ventas, COGS, envíos, alertas de courier/tránsito | Publicidad, CPA, ROAS, meta mensual | — |
| Resumen | Cascada de utilidad completa | Inversión ADS, CPV, ROAS, avance del mes | Tasa de confirmación (quitada) |
| Control diario | Órdenes, unidades, venta por canal/día | Inversión, CPO, CPV, ROAS, objetivo por canal | Canales más finos |
| Gastos & Costos | Todo | — | — |
| Utilidad & Margen | Todo | — | — |
| Canales & Marketplaces | Todo | — | Canales más finos, validación de `channel` en `IMarketplaceConfig` |
| Pauta por canal | Ventas por producto en cada canal | Inversión registrada (ledger fechado) | Atribución por categoría, canales más finos |
| Punto de Equilibrio | Todo | — | — |
| Margen x Producto | Ventas por producto | — | Costo real al momento de la venta (usa costo actual del catálogo como proxy) |
| Merma | Todo | — | — |
| Cuentas x Cobrar/Pagar | Saldos en tránsito, liquidación pendiente de courier | Cuentas manuales, confirmaciones, historial | "Por pagar" automático |
| Flujo de Caja | Ventas/COGS/gastos/courier por mes, adelantos pendientes (foto de hoy) | Fila Publicidad | Histórico mensual de adelantos (necesita ledger + estados NO_ENTREGADO/CANCELADO reales) |
| Liquidaciones | Courier (recaudado/adelantos/neto) | Confirmaciones de courier | Vendedoras (sección oculta) |
| Capital & ROI | Utilidad acumulada, tiempo de recupero | Capital registrado, préstamo, ROI | — |
| Resumen Anual | KPIs mes a mes, ventas por tienda, comparativo año vs año | Metas | Profit por tienda |
