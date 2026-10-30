# 08 · Indicador del último aviso en botones WhatsApp (X2)

Referencias: PDF §1.3, §6.5.1 ("Así se ve en Ventas"), §9.2 (`pedidos.wa_last_status`); mockup `.wa-act`, `.mini-ventas`.

**Estado (etapa 8, 2026-10-10):** implementado en los botones de WhatsApp de cada fila. Hoy no se ve en ninguna lista porque el dato no existe (C-29); cuando backend lo envíe en las listas, aparece sin más cambios.

| Campo | Detalle |
|---|---|
| Componente compartido | `WhatsAppLastNoticeIndicator` (`src/components/whatsapp/`); parser `parseWhatsAppLastNotice` (`src/features/whatsapp/utils/last-notice.util.ts`) |
| Dato | Campo opcional `OrderHeader.waLastNotice` (`src/interfaces/IOrder.ts`) con forma `{ status, templateName, at (ISO), reason }`. El parser exige un estado conocido y una fecha válida; ausente o inválido → no se muestra nada (ausencia no es fallo, D-73) |
| Presentación | Marca sobre el botón: ticks gris (enviado/entregado), azul (leído), reloj (en cola), persona (asistido), rojo (no enviado). El nombre accesible del botón suma "Último aviso {plantilla}: {estado} · {fecha} · {motivo}" |
| Lo que no cambia | El `onClick` (abre `wa.me` como hoy), validaciones de teléfono, permisos y los envíos masivos. Clic manual en el botón no se registra (D-02) |
| Rendimiento | Sin peticiones: se lee del objeto de la fila |

## Dónde está montado

| Pantalla | Archivo | Cambio |
|---|---|---|
| Ventas (dos tablas) | `src/app/ventas/page.tsx` | `Sale.waLastNotice` desde el mapper + indicador en los dos botones de fila |
| Gestión CC | `src/components/atencion-cliente/cc-v2/CcPedidosTable.tsx` | Indicador con `parseWhatsAppLastNotice(order.waLastNotice)` |
| Operaciones › Pedidos | `src/app/operaciones/pedidos/_components/types.ts` (`Sale.waLastNotice` en `mapOrderToSale`), `AtencionTab.tsx`, `EnCaminoTab.tsx`, `PorDespacharTab.tsx` | Indicador en el botón de fila |

Fuera de alcance: botones masivos, Clientes, Finanzas, Facturación, Shalom, Planificación y la barra masiva de Gestión CC.

## Contrato (C-29, propuesto)

Agregar `waLastNotice: { status: "queued|sent|delivered|read|failed|skipped|assisted", templateName, at, reason } | null` a cada pedido en las respuestas de lista que ya usan esas pantallas (ms-ventas: listado de ventas, pedidos de Operaciones, pedidos de Gestión CC). Sin consultas por fila. Debe coincidir con el último mensaje del Historial (C-24) para ese pedido.

## Criterios de aceptación

Con datos: el estado coincide con el Historial; filas sin aviso no muestran marca. Sin datos (tests): el botón queda idéntico y su clic sigue funcionando. La vista "Así se ve en las listas de pedidos" del Historial muestra un ejemplo ilustrativo sin pedidos ni fechas.
