# 08 · Indicador del último aviso en botones WhatsApp (X2)

Referencias: PDF §1.3 ("El botón de WhatsApp de cada pedido muestra el último estado del aviso"), §6.5.1 ("Así se ve en Ventas"), §9.2 (`pedidos.wa_last_status`, "Ventas y Gestión CC"); mockup `.wa-act`, `.mini-ventas`.

## X2 · Mini indicador

| Campo | Detalle |
|---|---|
| Qué es | Una marca pequeña sobre el botón verde de WhatsApp de cada pedido: ticks gris (enviado/entregado), ticks azul (leído), botón rojo si no se envió. Tooltip "Último aviso: {plantilla} · {estado} · {hora}" y motivo si falló |
| Qué no es | No cambia lo que hace el clic (sigue abriendo `wa.me`); no refleja los clics manuales en ese botón (D-02) |
| Componente | Propuesto: `WhatsAppNoticeButton` (`src/components/whatsapp/`) que envuelve el botón actual o agrega el indicador como hijo posicionado; `MessageStatusTicks` en tamaño mini |
| Datos | `waLastNotice: { status, templateName, at, reason } | null` en cada fila (C-29). `null` → sin indicador |
| Estados | Sin contrato o campo ausente → sin indicador (no se infiere nada). `queued` → reloj gris. `failed`/`skipped` → botón rojo + tooltip con motivo. `assisted` → ícono de persona |
| Accesibilidad | El nombre accesible del botón suma el estado: "WhatsApp, último aviso leído" |
| Lecturas | Ninguna nueva: el dato viaja en las listas que ya cargan esas pantallas (evita N+1) |
| Actualización | La de cada lista (sus propios refetch) |
| Permisos | Visible para quien ve la lista; no requiere `WA_VIEW` (PROPUESTA) |
| Criterios de aceptación | El estado coincide con el del Historial para ese pedido; filas sin aviso no muestran marca |
| Contrato | C-29 SPEC (campo), ruta de lista existente en ms-ventas a extender |

## Lugares donde aplicar

Prioridad según el PDF (Ventas, Gestión CC, Operaciones › Pedidos):

| Pantalla | Archivo | Botón actual |
|---|---|---|
| Comercial › Ventas | `src/app/ventas/page.tsx` (filas, p. ej. `:1305-1316`; masivos `:1850`, `:1938`, `:2035` quedan sin indicador) | `handleWhatsApp(phone, orderNumber, clientName)` |
| Atención al cliente › Gestión CC | `src/components/atencion-cliente/cc-v2/CcPedidosTable.tsx` (`onWhatsApp`, `:70`, `:333`) | Callback del padre |
| Operaciones › Pedidos | `src/app/operaciones/pedidos/_components/AtencionTab.tsx` (`:267`, `:426`), `EnCaminoTab.tsx` (`:294`, `:405`), `PorDespacharTab.tsx`, `PedidosContent.tsx` | `openWhatsApp` (`types.ts:232`) |
| Ficha del pedido | `src/components/modals/CustomerServiceModal.tsx` (`:1268`, `:2897`) | `handleWhatsApp` (`:581`) |

Fuera de alcance (no son pedidos con avisos de envío o son acciones masivas): Clientes, Finanzas (cobranza), Facturación (envío de comprobante por `wa.me`), Shalom (documento y envío), Planificación de guías, barra de Gestión CC (WhatsApp masivo).

## Dependencia de backend

Las respuestas de lista de pedidos de ms-ventas que usan esas pantallas deben incluir `waLastNotice`. **SIN DEFINIR** cuáles endpoints exactamente (las pantallas usan `useVentas`, `useCcPedidos`, servicios de Operaciones); backend debe agregarlo a todos para no hacer consultas por fila.
