# 05 · Pestaña Historial de envíos (`?tab=historial`)

Referencias: PDF §6.5, §8.1, §10.1.2, §13 casos 8-9, 27, §14.5; mockup `#p-historial`.

**Estado (etapa 6, 2026-10-09):** frontend completo y revisable en Storybook (`WhatsApp/Historial/HistoryView`). En la app, sin backend, muestra "Indicadores pendientes de integración" y "Mensajes pendientes de integración": sin ceros, porcentajes ni filas de ejemplo. Reenviar, exportar y paginar quedan bloqueados con explicación accesible. No hay llamadas a `/wa`.

## Componentes

| Componente | Archivo | Rol |
|---|---|---|
| `HistoryTab` | `src/app/configuracion/whatsapp/_components/historial/HistoryTab.tsx` | Contenedor: tiendas de `useAuth`, filtros en estado local, `OrderDetailModalProvider`, permisos efectivos sin confirmar, todo en "pendiente" |
| `HistoryView` | `…/HistoryView.tsx` | Periodo, tienda, exportar, indicadores, embudo, leyenda, filtros y tabla con sus estados |
| `HistoryKpis`, `HistoryFunnel` | `…/HistoryKpis.tsx` | Tarjetas y embudo |
| `HistoryMessagesTable` | `…/HistoryMessagesTable.tsx` | Tabla, línea de tiempo expandible, Reenviar, paginación |
| `DebouncedSearchInput` (compartido) | `src/components/whatsapp/DebouncedSearchInput.tsx` | Búsqueda con espera de 300 ms y mínimo de 2 caracteres (también en Conversaciones y Bajas) |

Dominio: `models/history.model.ts`, `utils/history.util.ts` (periodos en Lima, consulta, porcentajes, embudo, línea de tiempo), `constants/whatsapp-settings-catalog.ts` (periodos, filtros de estado).

## Alcance compartido

Indicadores, embudo, tabla y exportación usan **el mismo alcance**: periodo + tienda + búsqueda (`toHistoryQuery`). El filtro de **estado** solo acota la tabla y la exportación; los indicadores siempre muestran todos los estados del alcance (si filtraran por estado, "Entregados / Enviados" perdería sentido). Ningún total se calcula con la página visible: los conteos vienen de `metrics` y el total de filas de `page.total`.

| Campo | Detalle |
|---|---|
| Periodo | Hoy · Últimos 7 días (por defecto) · Este mes. Se calcula en `America/Lima` (`getLimaPeriodRange`): Hoy = 00:00 Lima de hoy → ahora; 7 días = 00:00 Lima de hace 6 días → ahora; Este mes = 00:00 Lima del día 1 → ahora. Tests: noche en Lima (UTC ya es el día siguiente), cambio de año y cambio de mes. El texto "Del 02/10/2026 al 08/10/2026 (hora de Lima)" muestra el rango |
| Tienda | "Todas las tiendas" + C-E1 por ID |
| Búsqueda | Pedido, cliente o teléfono; teléfono normalizado a dígitos |
| Consulta | `{ period, from, to (ISO UTC), storeId, q }` + `status` para la tabla |
| Filtros frente a preferencias | Estado local de la pestaña; no se guardan en la URL ni en `localStorage` |

## T5.S1 · Exportar Excel

| Campo | Detalle |
|---|---|
| Comportamiento | Botón "Exportar Excel" bloqueado con "Pendiente de integración… El permiso para exportar todavía no está definido." |
| Cómo exportar todo | No se exporta la página visible. Propuesta (D-17, decidida en D-64): `GET /wa/messages/export?<alcance>&status=` en servidor, que recorre todas las páginas con los mismos filtros y devuelve `xlsx` (o un `jobId` si supera un umbral, con `GET /wa/exports/:jobId` para descargar). Columnas: fecha y hora (Lima), pedido, cliente, teléfono, tienda, plantilla, courier, estado, motivo, enviado, entregado, leído, abrió rastreo, asistido por |
| Estados futuros | "Preparando el archivo con todos los mensajes filtrados…" y error con `role="alert"` |
| Permiso | Sin código definido en el PDF; propuesta `WA_HISTORY_EXPORT` (C-28). Mientras no exista, desconocido = bloqueado |

## T5.S2 · Indicadores y T5.S3 · Embudo

| Indicador | Valor | Porcentaje y denominador |
|---|---|---|
| Enviados | `metrics.sent`: aceptados por la API de Meta (`sent`, `delivered`, `read`), **sin asistidos** | — |
| Entregados | `metrics.delivered` (incluye leídos) | entregados / enviados |
| Leídos | `metrics.read` | leídos / entregados (PDF) |
| Abrieron el rastreo | `metrics.trackingOpened` | abrieron / **enviados** (D-63: el PDF usa leídos, pero un clic no prueba lectura y podría superar el 100%) |
| No enviados | `failed` + `skipped`, desglose por motivo | — |
| Asistidos | `assisted` | No cuentan como enviados, entregados ni leídos (D-02) |

Reglas: `null` = "Sin dato" (no "0"); base 0 = "Sin envíos en el periodo" / "Sin entregas en el periodo" (sin dividir); datos parciales muestran "Porcentaje sin dato". El embudo usa siempre % sobre enviados y lo dice. Leyenda de 5 estados, con la nota de confirmaciones de lectura y "Asistido".

## T5.S6 · Tabla de mensajes

| Campo | Detalle |
|---|---|
| Filtros | Todos · Enviado · Entregado · Leído · No enviado (`failed` + `skipped`) · Asistido. Sin contadores en los filtros (no coinciden con los acumulados de los indicadores) |
| Columnas | Fecha y hora (botón que expande la línea de tiempo, `aria-expanded`), Pedido + tienda, Cliente + teléfono, Plantilla, Courier, Estado (motivo debajo si no se envió; "Número de contingencia · marcado por {asesora}" en asistidos), Rastreo ("Abrió HH:MM"), Reenviar |
| Línea de tiempo | Enviado → Entregado → Leído (pasos sin fecha: "· sin confirmar") → Abrió el rastreo; fallidos: "Meta no pudo entregarlo" / "POWIP no lo envió"; asistidos: "Marcado como enviado por…" y "Sin confirmación de entrega ni de lectura". "Ver pedido {número}" abre la ficha con el ID real; sin pedido, "Este mensaje no tiene un pedido asociado" |
| Rastreo | Un clic se muestra aparte y nunca cambia el estado a Leído |
| Reenviar | Solo en No enviado. Bloqueado si backend dice `canResend: false` (con su motivo, p. ej. "Corrige el dato en el pedido"), sin permiso `WA_REPLY` confirmado o sin backend. Con manejador: "Reenviando…", error en la fila y estado sin cambios hasta que backend responda (D-21) |
| Paginación | `pageSize` 50; "Página N de M · X mensajes" solo con `total` de backend; bloqueada sin backend |
| Estados | Pendiente, cargando, sin permisos, error con Reintentar, vacío ("Todavía no se enviaron avisos en este periodo"), sin coincidencias ("No hay mensajes con estos filtros" + Limpiar filtros, que conserva el periodo) |

## Contratos propuestos (C-24)

- `GET /wa/messages/metrics?period&from&to&storeId&q` → `{ "sent", "delivered", "read", "trackingOpened", "notSent", "notSentBreakdown": [{ "reason", "label", "count" }], "assisted", "computedAt" }`. Cualquier campo puede ser `null` si no se pudo calcular. `sent/delivered/read` excluyen asistidos.
- `GET /wa/messages?<alcance>&status=all|sent|delivered|read|not_sent|assisted&page&pageSize=50&sort=createdAt:desc` → `{ "items": [{ "id", "createdAt", "orderId", "orderNumber", "storeId", "storeName", "customerName", "phone", "templateName", "courierName", "status", "reason", "timeline": { "queuedAt", "sentAt", "deliveredAt", "readAt", "failedAt", "clickedAt" }, "assistedBy", "canResend", "resendBlockedReason" }], "page", "pageSize", "total", "hasMore" }`.
- `POST /wa/messages/:id/resend` + `Idempotency-Key` → mensaje reencolado (`queued`). Errores: `409 WA_OPTED_OUT`, `409 WA_MISSING_DATA`, `409 WA_NOT_CONNECTED`, `409 WA_NOT_RESENDABLE`, `429`.
- `GET /wa/messages/export?<alcance>&status` → `xlsx` o `202 { jobId }`.
- Tenant: empresa del token; `storeId` validado contra la empresa. Auditoría: reenvíos y exportaciones registrados con usuario.

## Responsabilidades de backend

Nunca bajar de estado (caso 27); `read` solo con confirmación de lectura de Meta; `clickedAt` por el redirect de `powip.lat/r`, sin tocar el estado; excluir asistidos de los conteos de Meta; calcular conteos y totales globales para el alcance; exportar todas las filas filtradas.

## Criterios de aceptación

§14.5: indicadores y tabla coinciden con el mismo alcance; el export trae las mismas filas que la tabla filtrada (todas las páginas). Caso 9: quedarse en Entregado no es error. Sin backend (tests): sin ceros ni porcentajes inventados, sin divisiones por cero, asistidos fuera de entregados/leídos, clic de rastreo sin lectura, reenvío y exportación bloqueados.
